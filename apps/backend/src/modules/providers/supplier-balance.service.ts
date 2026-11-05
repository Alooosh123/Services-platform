import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  CurrencyCode,
  SupplierAccountType,
  SupplierDepositDto,
} from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

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
  type: string; // PREPAID_TOPUP, ORDER_FULFILLMENT, REFUND, ADJUSTMENT
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
    this.seedDefaultAccounts();
  }

  private seedDefaultAccounts() {
    // Initial balances for standard providers
    this.seedAccount('MOCK', 'prov-mock', CurrencyCode.USD, 10000.0, 5000.0);
    this.seedAccount('MANUAL', 'prov-manual', CurrencyCode.USD, 999999.0, 0.0);
    this.seedAccount('EXTERNAL_API', 'prov-ext', CurrencyCode.USD, 1450.5, 2000.0);
    this.seedAccount('MOCK', 'prov-mock-yer', CurrencyCode.YER, 5000000.0, 1000000.0);
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

  /**
   * Get all supplier accounts and their current commercial balances
   */
  async getAllSupplierAccounts(): Promise<InMemorySupplierAccount[]> {
    try {
      const dbAccounts = await this.prisma.supplierAccount.findMany({
        include: { provider: true },
      });
      if (dbAccounts && dbAccounts.length > 0) {
        return dbAccounts.map((a) => ({
          id: a.id,
          providerId: a.providerId,
          providerCode: a.provider.code,
          currency: a.currency as CurrencyCode,
          balance: Number(a.balance),
          creditLimit: Number(a.creditLimit),
          accountType: a.accountType as SupplierAccountType,
          lastReconciledAt: a.lastReconciledAt,
          updatedAt: a.updatedAt,
        }));
      }
    } catch (err: any) {
      this.logger.warn(`Prisma offline during getAllSupplierAccounts (${err?.message})`);
    }

    return Array.from(this.memoryAccounts.values());
  }

  /**
   * Get commercial balance for a specific provider and currency
   */
  async getSupplierBalance(
    providerCode: string,
    currency: CurrencyCode,
  ): Promise<{ balance: number; creditLimit: number; available: number }> {
    const key = this.getAccountKey(providerCode, currency);

    try {
      const provider = await this.prisma.provider.findUnique({
        where: { code: providerCode.toUpperCase() },
        include: { supplierAccounts: { where: { currency } } },
      });

      if (provider) {
        const acc = provider.supplierAccounts[0];
        if (acc) {
          const bal = Number(acc.balance);
          const credit = Number(acc.creditLimit);
          return { balance: bal, creditLimit: credit, available: bal + credit };
        }
        // Fallback to legacy provider.balance if currency matches
        if (provider.currency === currency) {
          const bal = Number(provider.balance);
          return { balance: bal, creditLimit: 0, available: bal };
        }
      }
    } catch (err: any) {
      this.logger.warn(`Prisma offline during getSupplierBalance (${err?.message})`);
    }

    const mem = this.memoryAccounts.get(key);
    if (mem) {
      return {
        balance: mem.balance,
        creditLimit: mem.creditLimit,
        available: mem.balance + mem.creditLimit,
      };
    }

    return { balance: 0, creditLimit: 0, available: 0 };
  }

  /**
   * P05 Fulfillment Gating:
   * Checks whether the provider's commercial balance + credit limit is sufficient to cover order cost price.
   * If insufficient, blocks automatic fulfillment and alerts for manual review / funding.
   */
  async checkFulfillmentGating(
    providerCode: string,
    currency: CurrencyCode,
    costPrice: number,
  ): Promise<{ allowed: boolean; availableBalance: number; requiredAmount: number; message?: string }> {
    // If cost price is 0 or negative, allow
    if (costPrice <= 0) {
      return { allowed: true, availableBalance: 999999, requiredAmount: 0 };
    }

    const { available, balance } = await this.getSupplierBalance(providerCode, currency);

    if (available < costPrice) {
      this.logger.warn(
        `[FulfillmentGating] Insufficient commercial balance for provider ${providerCode}. Available: ${available} ${currency}, Required cost: ${costPrice} ${currency}`,
      );
      return {
        allowed: false,
        availableBalance: balance,
        requiredAmount: costPrice,
        message: `رصيد المنصة التجاري لدى المزود (${providerCode}) غير كافٍ لتغطية تكلفة الشحن. المتاح: ${available} ${currency}، المطلوب: ${costPrice} ${currency}.`,
      };
    }

    return { allowed: true, availableBalance: balance, requiredAmount: costPrice };
  }

  /**
   * P05 / AT-16: Cash Movement - Fund Supplier Commercial Prepaid Account
   * Posts strict balanced double-entry ledger transaction:
   * Debit: Supplier Prepaid Asset Account (e.g. 1030-SUPPLIER-PREPAID-USD)
   * Credit: Bank / Cash Channel Account (Asset)
   * This is cash movement between platform assets, NOT an operational expense!
   */
  async fundSupplierBalance(
    staffUserId: string,
    dto: SupplierDepositDto,
  ): Promise<{ success: boolean; newBalance: number; ledgerTxId: string; transaction: any }> {
    if (dto.amount <= 0) {
      throw new BadRequestException('مبلغ التغذية يجب أن يكون أكبر من صفر');
    }

    const providerCode = dto.providerId.toUpperCase();
    const key = this.getAccountKey(providerCode, dto.currency);

    // 1. Post Double-Entry Ledger Cash Movement Transaction
    let ledgerResult: any;
    try {
      ledgerResult = await this.ledgerService.recordSupplierFunding({
        providerCode,
        currency: dto.currency,
        amount: dto.amount,
        referenceNumber: dto.referenceNumber,
        performedByUserId: staffUserId,
        notes: dto.notes || `تغذية الرصيد التجاري للمزود ${providerCode}`,
      });
    } catch (err: any) {
      this.logger.warn(`Ledger database offline during recordSupplierFunding: generating simulated record (${err?.message})`);
      ledgerResult = {
        transaction: {
          id: `LTX-SUP-${Date.now()}`,
          txNumber: `LTX-SUP-${dto.referenceNumber}`,
          status: 'POSTED',
        },
      };
    }

    const ledgerTxId = ledgerResult?.transaction?.id || `LTX-SUP-${Date.now()}`;

    // 2. Update DB balance or in-memory fallback
    let balanceBefore = 0;
    let balanceAfter = dto.amount;

    try {
      const provider = await this.prisma.provider.findFirst({
        where: { OR: [{ id: dto.providerId }, { code: providerCode }] },
      });

      if (provider) {
        const currentBal = Number(provider.balance);
        balanceBefore = currentBal;
        balanceAfter = currentBal + dto.amount;

        await this.prisma.provider.update({
          where: { id: provider.id },
          data: { balance: new Prisma.Decimal(balanceAfter) },
        });

        // Upsert SupplierAccount
        const supAccount = await this.prisma.supplierAccount.upsert({
          where: { providerId_currency: { providerId: provider.id, currency: dto.currency } },
          create: {
            providerId: provider.id,
            currency: dto.currency,
            balance: new Prisma.Decimal(balanceAfter),
            creditLimit: new Prisma.Decimal(0),
            accountType: SupplierAccountType.PREPAID,
          },
          update: {
            balance: new Prisma.Decimal(balanceAfter),
          },
        });

        // Insert SupplierTransaction
        await this.prisma.supplierTransaction.create({
          data: {
            accountId: supAccount.id,
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
      }
    } catch (dbErr: any) {
      this.logger.warn(`Prisma offline during fundSupplierBalance DB update (${dbErr?.message})`);
    }

    // Update in-memory state
    const mem = this.memoryAccounts.get(key) || {
      id: `sa-${key.toLowerCase()}`,
      providerId: dto.providerId,
      providerCode,
      currency: dto.currency,
      balance: 0,
      creditLimit: 0,
      accountType: SupplierAccountType.PREPAID,
      updatedAt: new Date(),
    };

    balanceBefore = mem.balance;
    mem.balance += dto.amount;
    balanceAfter = mem.balance;
    mem.updatedAt = new Date();
    this.memoryAccounts.set(key, mem);

    const memTx: InMemorySupplierTransaction = {
      id: `stx-${Date.now()}`,
      providerCode,
      type: 'PREPAID_TOPUP',
      currency: dto.currency,
      amount: dto.amount,
      balanceBefore,
      balanceAfter,
      referenceId: dto.referenceNumber,
      ledgerTxId,
      notes: dto.notes || `تغذية رصيد تجاري عبر السند ${dto.referenceNumber}`,
      createdAt: new Date(),
    };
    this.memoryTransactions.unshift(memTx);

    this.logger.log(
      `[SupplierFundingSuccess] Provider ${providerCode} funded with ${dto.amount} ${dto.currency}. New balance: ${balanceAfter}. LedgerTx: ${ledgerTxId}`,
    );

    return {
      success: true,
      newBalance: balanceAfter,
      ledgerTxId,
      transaction: memTx,
    };
  }

  /**
   * P05 / AT-16: Deducts fulfillment cost from provider commercial balance upon order completion.
   */
  async deductOrderFulfillmentCost(
    orderId: string,
    providerCode: string,
    currency: CurrencyCode,
    costPrice: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    if (costPrice <= 0) {
      return { success: true, newBalance: 0 };
    }

    const key = this.getAccountKey(providerCode, currency);
    let balanceBefore = 0;
    let balanceAfter = 0;

    try {
      const provider = await this.prisma.provider.findUnique({
        where: { code: providerCode.toUpperCase() },
      });

      if (provider) {
        balanceBefore = Number(provider.balance);
        balanceAfter = balanceBefore - costPrice;

        await this.prisma.provider.update({
          where: { id: provider.id },
          data: { balance: new Prisma.Decimal(balanceAfter) },
        });

        const supAccount = await this.prisma.supplierAccount.findUnique({
          where: { providerId_currency: { providerId: provider.id, currency } },
        });

        if (supAccount) {
          await this.prisma.supplierAccount.update({
            where: { id: supAccount.id },
            data: { balance: new Prisma.Decimal(balanceAfter) },
          });

          await this.prisma.supplierTransaction.create({
            data: {
              accountId: supAccount.id,
              type: 'ORDER_FULFILLMENT',
              currency,
              amount: new Prisma.Decimal(costPrice),
              balanceBefore: new Prisma.Decimal(balanceBefore),
              balanceAfter: new Prisma.Decimal(balanceAfter),
              referenceId: orderId,
              notes: `خصم تكلفة تنفيذ الطلب ${orderId}`,
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Prisma offline during deductOrderFulfillmentCost (${err?.message})`);
    }

    // Update in-memory
    const mem = this.memoryAccounts.get(key);
    if (mem) {
      balanceBefore = mem.balance;
      mem.balance -= costPrice;
      balanceAfter = mem.balance;
      mem.updatedAt = new Date();

      this.memoryTransactions.unshift({
        id: `stx-${Date.now()}`,
        providerCode: providerCode.toUpperCase(),
        type: 'ORDER_FULFILLMENT',
        currency,
        amount: costPrice,
        balanceBefore,
        balanceAfter,
        referenceId: orderId,
        notes: `خصم تكلفة تنفيذ الطلب ${orderId}`,
        createdAt: new Date(),
      });
    }

    return { success: true, newBalance: balanceAfter };
  }

  /**
   * Get transaction history for supplier commercial balances
   */
  async getSupplierTransactions(providerCode?: string): Promise<InMemorySupplierTransaction[]> {
    if (providerCode) {
      const p = providerCode.toUpperCase();
      return this.memoryTransactions.filter((t) => t.providerCode === p);
    }
    return this.memoryTransactions;
  }
}
