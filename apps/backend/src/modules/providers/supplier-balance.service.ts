import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  CurrencyCode,
  SupplierAccountType,
  SupplierDepositDto,
} from '@digital-topup/shared';
import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';

export interface InMemorySupplierAccount {
  id: string;
  providerId: string;
  providerCode: string;
  currency: CurrencyCode;
  balance: number;
  creditLimit: number;
  accountType: SupplierAccountType;
  lastReconciledAt?: Date | null;
  updatedAt: Date;
}

export interface InMemorySupplierTransaction {
  id: string;
  providerCode: string;
  type: string;
  currency: CurrencyCode;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string | null;
  ledgerTxId?: string | null;
  notes?: string | null;
  createdAt: Date;
}

@Injectable()
export class SupplierBalanceService {
  private readonly logger = new Logger(SupplierBalanceService.name);
  private memoryAccounts: Map<string, InMemorySupplierAccount> = new Map();
  private memoryTransactions: InMemorySupplierTransaction[] = [];

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {
    // Seed mock balances for local demo only. Tenant requests never share this store.
    if (process.env.NODE_ENV !== 'production') {
      this.seedDefaultAccounts();
    }
  }

  private seedDefaultAccounts() {
    this.seedAccount('MOCK', 'prov-mock', CurrencyCode.USD, 10000, 5000);
    this.seedAccount('MANUAL', 'prov-manual', CurrencyCode.USD, 999999, 0);
    this.seedAccount('EXTERNAL_API', 'prov-ext', CurrencyCode.USD, 1450.5, 2000);
    this.seedAccount('MOCK', 'prov-mock-yer', CurrencyCode.YER, 5000000, 1000000);
  }

  private seedAccount(
    providerCode: string,
    providerId: string,
    currency: CurrencyCode,
    balance: number,
    creditLimit: number,
  ) {
    const key = `${providerCode.toUpperCase()}_${currency}`;
    this.memoryAccounts.set(key, {
      id: `sa-${key.toLowerCase()}`,
      providerId,
      providerCode: providerCode.toUpperCase(),
      currency,
      balance,
      creditLimit,
      accountType: SupplierAccountType.PREPAID,
      updatedAt: new Date(),
    });
  }

  private getAccountKey(providerCode: string, currency: CurrencyCode): string {
    return `${providerCode.toUpperCase()}_${currency}`;
  }

  private assertDatabaseForFinancialOperation(): void {
    if (process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
      throw new ServiceUnavailableException(
        'Supplier commercial balances require an available tenant-scoped database.',
      );
    }
  }

  async getAllSupplierAccounts(): Promise<InMemorySupplierAccount[]> {
    try {
      const dbAccounts = await this.prisma.supplierAccount.findMany({
        include: { provider: true },
        orderBy: [{ provider: { code: 'asc' } }, { currency: 'asc' }],
      });
      return dbAccounts.map((account) => ({
        id: account.id,
        providerId: account.providerId,
        providerCode: account.provider.code,
        currency: account.currency as CurrencyCode,
        balance: Number(account.balance),
        creditLimit: Number(account.creditLimit),
        accountType: account.accountType as SupplierAccountType,
        lastReconciledAt: account.lastReconciledAt,
        updatedAt: account.updatedAt,
      }));
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
        this.logger.error(`Supplier account listing failed: ${error?.message || error}`);
        this.assertDatabaseForFinancialOperation();
      }
      this.logger.warn(`Local development supplier accounts fallback: ${error?.message || error}`);
      return Array.from(this.memoryAccounts.values());
    }
  }

  async getSupplierBalance(
    providerCode: string,
    currency: CurrencyCode,
  ): Promise<{ balance: number; creditLimit: number; available: number }> {
    const tenantId = getCurrentTenantId();
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { code: providerCode.toUpperCase() },
      });
      if (!provider) throw new NotFoundException(`Provider ${providerCode} was not found`);

      const account = await this.prisma.supplierAccount.findFirst({
        where: { providerId: provider.id, currency },
      });
      if (account) {
        const balance = Number(account.balance);
        const creditLimit = Number(account.creditLimit);
        return { balance, creditLimit, available: balance + creditLimit };
      }

      // Legacy provider.balance is platform-wide and must never be used by a tenant.
      if (!tenantId && provider.currency === currency) {
        const balance = Number(provider.balance);
        return { balance, creditLimit: 0, available: balance };
      }

      if (tenantId) return { balance: 0, creditLimit: 0, available: 0 };

      const memory = this.memoryAccounts.get(this.getAccountKey(providerCode, currency));
      if (memory) {
        return {
          balance: memory.balance,
          creditLimit: memory.creditLimit,
          available: memory.balance + memory.creditLimit,
        };
      }
      return { balance: 0, creditLimit: 0, available: 0 };
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production' || tenantId) {
        this.logger.error(`Supplier balance read failed: ${error?.message || error}`);
        throw error instanceof NotFoundException
          ? error
          : new ServiceUnavailableException('Supplier commercial balance is unavailable.');
      }

      this.logger.warn(`Local development supplier balance fallback: ${error?.message || error}`);
      const memory = this.memoryAccounts.get(this.getAccountKey(providerCode, currency));
      return memory
        ? {
            balance: memory.balance,
            creditLimit: memory.creditLimit,
            available: memory.balance + memory.creditLimit,
          }
        : { balance: 0, creditLimit: 0, available: 0 };
    }
  }

  async checkFulfillmentGating(
    providerCode: string,
    currency: CurrencyCode,
    costPrice: number,
  ): Promise<{ allowed: boolean; availableBalance: number; requiredAmount: number; message?: string }> {
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      return {
        allowed: false,
        availableBalance: 0,
        requiredAmount: costPrice,
        message: 'Invalid supplier cost.',
      };
    }
    if (costPrice === 0) {
      return { allowed: true, availableBalance: 999999, requiredAmount: 0 };
    }

    const { available, balance } = await this.getSupplierBalance(providerCode, currency);
    if (available < costPrice) {
      this.logger.warn(
        `[FulfillmentGating] Insufficient commercial balance for provider ${providerCode} in tenant ${getCurrentTenantId() || 'platform'}.`,
      );
      return {
        allowed: false,
        availableBalance: balance,
        requiredAmount: costPrice,
        message: `رصيد المنصة التجاري لدى المزود (${providerCode}) غير كافٍ. المتاح: ${available} ${currency}، المطلوب: ${costPrice} ${currency}.`,
      };
    }
    return { allowed: true, availableBalance: balance, requiredAmount: costPrice };
  }

  async fundSupplierBalance(
    staffUserId: string,
    dto: SupplierDepositDto,
  ): Promise<{ success: boolean; newBalance: number; ledgerTxId: string; transaction: any }> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('مبلغ التغذية يجب أن يكون أكبر من صفر');
    }

    const providerCode = dto.providerId.toUpperCase();
    const tenantId = getCurrentTenantId();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const provider = await tx.provider.findFirst({
          where: { OR: [{ id: dto.providerId }, { code: providerCode }] },
        });
        if (!provider) throw new NotFoundException(`Provider ${dto.providerId} was not found`);

        const existing = await tx.supplierAccount.findFirst({
          where: { providerId: provider.id, currency: dto.currency },
        });
        const balanceBefore = existing ? Number(existing.balance) : 0;
        const balanceAfter = balanceBefore + dto.amount;

        const account = existing
          ? await tx.supplierAccount.update({
              where: { id: existing.id },
              data: { balance: new Prisma.Decimal(balanceAfter) },
            })
          : await tx.supplierAccount.create({
              data: {
                providerId: provider.id,
                currency: dto.currency,
                balance: new Prisma.Decimal(balanceAfter),
                creditLimit: new Prisma.Decimal(0),
                accountType: SupplierAccountType.PREPAID,
              },
            });

        // Legacy platform account balance is retained only for platform-scope operations.
        if (!tenantId) {
          await tx.provider.update({
            where: { id: provider.id },
            data: { balance: new Prisma.Decimal(balanceAfter) },
          });
        }

        const ledgerResult = await this.ledgerService.recordSupplierFunding({
          providerCode,
          currency: dto.currency,
          amount: dto.amount,
          referenceNumber: dto.referenceNumber,
          channelCode: undefined,
          performedByUserId: staffUserId,
          notes: dto.notes || `تغذية الرصيد التجاري للمزود ${providerCode}`,
        }, tx);

        const ledgerTxId = ledgerResult?.transaction?.id;
        if (!ledgerTxId) throw new ConflictException('Supplier funding ledger entry was not created');

        const transaction = await tx.supplierTransaction.create({
          data: {
            accountId: account.id,
            type: 'PREPAID_TOPUP',
            currency: dto.currency,
            amount: new Prisma.Decimal(dto.amount),
            balanceBefore: new Prisma.Decimal(balanceBefore),
            balanceAfter: new Prisma.Decimal(balanceAfter),
            referenceId: dto.referenceNumber,
            ledgerTxId,
            notes: dto.notes || `تغذية رصيد تجاري عبر السند ${dto.referenceNumber}`,
          },
        });

        return { account, transaction, ledgerTxId, balanceAfter };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return {
        success: true,
        newBalance: result.balanceAfter,
        ledgerTxId: result.ledgerTxId,
        transaction: result.transaction,
      };
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production' || tenantId) {
        this.logger.error(`Supplier funding failed: ${error?.message || error}`);
        throw error;
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }

      // Local unscoped mock-only development fallback.
      const key = this.getAccountKey(providerCode, dto.currency);
      const memory = this.memoryAccounts.get(key) || {
        id: `sa-${key.toLowerCase()}`,
        providerId: dto.providerId,
        providerCode,
        currency: dto.currency,
        balance: 0,
        creditLimit: 0,
        accountType: SupplierAccountType.PREPAID,
        updatedAt: new Date(),
      };
      const balanceBefore = memory.balance;
      memory.balance += dto.amount;
      memory.updatedAt = new Date();
      this.memoryAccounts.set(key, memory);
      const transaction: InMemorySupplierTransaction = {
        id: `stx-${Date.now()}`,
        providerCode,
        type: 'PREPAID_TOPUP',
        currency: dto.currency,
        amount: dto.amount,
        balanceBefore,
        balanceAfter: memory.balance,
        referenceId: dto.referenceNumber,
        notes: dto.notes || `Local demo funding ${dto.referenceNumber}`,
        createdAt: new Date(),
      };
      this.memoryTransactions.unshift(transaction);
      return {
        success: true,
        newBalance: memory.balance,
        ledgerTxId: 'LOCAL-DEMO-ONLY',
        transaction,
      };
    }
  }

  async deductOrderFulfillmentCost(
    orderId: string,
    providerCode: string,
    currency: CurrencyCode,
    costPrice: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new BadRequestException('Supplier fulfillment cost is invalid.');
    }
    if (costPrice === 0) return { success: true, newBalance: 0 };

    const tenantId = getCurrentTenantId();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const provider = await tx.provider.findUnique({
          where: { code: providerCode.toUpperCase() },
        });
        if (!provider) throw new NotFoundException(`Provider ${providerCode} was not found`);

        const account = await tx.supplierAccount.findFirst({
          where: { providerId: provider.id, currency },
        });

        if (!account) {
          if (tenantId) {
            throw new NotFoundException('Tenant supplier account has not been funded.');
          }
          const balanceBefore = Number(provider.balance);
          const balanceAfter = balanceBefore - costPrice;
          if (balanceAfter < 0) throw new BadRequestException('Supplier balance is insufficient.');
          await tx.provider.update({
            where: { id: provider.id },
            data: { balance: new Prisma.Decimal(balanceAfter) },
          });
          return { success: true, newBalance: balanceAfter };
        }

        const balanceBefore = Number(account.balance);
        const balanceAfter = balanceBefore - costPrice;
        if (balanceAfter + Number(account.creditLimit) < 0) {
          throw new BadRequestException('Supplier commercial balance and credit limit are insufficient.');
        }

        const update = await tx.supplierAccount.updateMany({
          where: {
            id: account.id,
            balance: { gte: new Prisma.Decimal(costPrice) },
          },
          data: { balance: { decrement: new Prisma.Decimal(costPrice) } },
        });
        if (update.count !== 1) {
          throw new ConflictException('Supplier balance changed concurrently. Retry the fulfillment.');
        }

        await tx.supplierTransaction.create({
          data: {
            accountId: account.id,
            type: 'ORDER_FULFILLMENT',
            currency,
            amount: new Prisma.Decimal(costPrice),
            balanceBefore: new Prisma.Decimal(balanceBefore),
            balanceAfter: new Prisma.Decimal(balanceAfter),
            referenceId: orderId,
            notes: `خصم تكلفة تنفيذ الطلب ${orderId}`,
          },
        });
        return { success: true, newBalance: balanceAfter };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production' || tenantId) {
        this.logger.error(`Supplier fulfillment deduction failed: ${error?.message || error}`);
        throw error;
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      const memory = this.memoryAccounts.get(this.getAccountKey(providerCode, currency));
      if (!memory) return { success: true, newBalance: 0 };
      if (memory.balance + memory.creditLimit < costPrice) {
        throw new BadRequestException('Local mock supplier balance is insufficient.');
      }
      const balanceBefore = memory.balance;
      memory.balance -= costPrice;
      memory.updatedAt = new Date();
      const transaction: InMemorySupplierTransaction = {
        id: `stx-${Date.now()}`,
        providerCode: providerCode.toUpperCase(),
        type: 'ORDER_FULFILLMENT',
        currency,
        amount: costPrice,
        balanceBefore,
        balanceAfter: memory.balance,
        referenceId: orderId,
        notes: `Local mock fulfillment cost ${orderId}`,
        createdAt: new Date(),
      };
      this.memoryTransactions.unshift(transaction);
      return { success: true, newBalance: memory.balance };
    }
  }

  async getSupplierTransactions(providerCode?: string): Promise<InMemorySupplierTransaction[]> {
    try {
      const where = providerCode
        ? { account: { provider: { code: providerCode.toUpperCase() } } }
        : undefined;
      const rows = await this.prisma.supplierTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { account: { include: { provider: true } } },
        take: 500,
      });
      return rows.map((row) => ({
        id: row.id,
        providerCode: row.account.provider.code,
        type: row.type,
        currency: row.currency as CurrencyCode,
        amount: Number(row.amount),
        balanceBefore: Number(row.balanceBefore),
        balanceAfter: Number(row.balanceAfter),
        referenceId: row.referenceId,
        ledgerTxId: row.ledgerTxId,
        notes: row.notes,
        createdAt: row.createdAt,
      }));
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
        this.logger.error(`Supplier transaction listing failed: ${error?.message || error}`);
        this.assertDatabaseForFinancialOperation();
      }
      return providerCode
        ? this.memoryTransactions.filter((row) => row.providerCode === providerCode.toUpperCase())
        : this.memoryTransactions;
    }
  }
}
