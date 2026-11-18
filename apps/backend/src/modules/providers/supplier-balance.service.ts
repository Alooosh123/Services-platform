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
  MonetaryInput,
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
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  private assertDatabaseForFinancialOperation(): never {
    throw new ServiceUnavailableException('Supplier commercial balances require a durable database record.');
  }

  private toMoneyDecimal(value: MonetaryInput, label: string): Prisma.Decimal {
    let amount: Prisma.Decimal;
    try {
      amount = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${label} is not a valid decimal amount.`);
    }
    if (
      !amount.isFinite() ||
      amount.isNegative() ||
      amount.decimalPlaces() > 4 ||
      amount.greaterThan('99999999999999.9999')
    ) {
      throw new BadRequestException(`${label} must be non-negative and fit DECIMAL(18,4).`);
    }
    return amount;
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
      this.logger.error('Supplier account listing failed: ' + (error?.message || error));
      this.assertDatabaseForFinancialOperation();
    }
  }

  async getSupplierBalance(
    providerCode: string,
    currency: CurrencyCode,
  ): Promise<{ balance: number; creditLimit: number; available: number; accountType: SupplierAccountType }> {
    const tenantId = getCurrentTenantId();
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { code: providerCode.toUpperCase() },
      });
      if (!provider) throw new NotFoundException(`Provider ${providerCode} was not found`);

      const account = await this.prisma.supplierAccount.findFirst({
        where: { providerId: provider.id, currency, tenantId: tenantId || null },
      });
      if (account) {
        const balanceDecimal = new Prisma.Decimal(account.balance);
        const creditLimitDecimal = new Prisma.Decimal(account.creditLimit);
        return {
          balance: balanceDecimal.toNumber(),
          creditLimit: creditLimitDecimal.toNumber(),
          available: balanceDecimal.plus(creditLimitDecimal).toNumber(),
          accountType: account.accountType as SupplierAccountType,
        };
      }

      throw new ServiceUnavailableException('لا يوجد حساب مورد تجاري دائم لهذه العملة؛ تم إيقاف التنفيذ.');
    } catch (error: any) {
      this.logger.error('Supplier balance read failed: ' + (error?.message || error));
      if (error instanceof NotFoundException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Supplier commercial balance is unavailable.');
    }
  }

  async checkFulfillmentGating(
    providerCode: string,
    currency: CurrencyCode,
    costPrice: MonetaryInput,
  ): Promise<{ allowed: boolean; availableBalance: number; requiredAmount: number; accountType?: SupplierAccountType; message?: string }> {
    const required = this.toMoneyDecimal(costPrice, 'Supplier fulfillment cost');
    if (required.isZero()) {
      return { allowed: true, availableBalance: 0, requiredAmount: 0 };
    }

    const tenantId = getCurrentTenantId();
    const provider = await this.prisma.provider.findUnique({
      where: { code: providerCode.toUpperCase() },
    });
    if (!provider) throw new NotFoundException(`Provider ${providerCode} was not found`);

    const account = await this.prisma.supplierAccount.findFirst({
      where: { providerId: provider.id, currency, tenantId: tenantId || null },
    });
    if (!account) {
      throw new ServiceUnavailableException('لا يوجد حساب مورد تجاري دائم لهذه العملة؛ تم إيقاف التنفيذ.');
    }

    const balance = new Prisma.Decimal(account.balance);
    const creditLimit = new Prisma.Decimal(account.creditLimit);
    const available = balance.plus(creditLimit);
    if (available.lessThan(required)) {
      this.logger.warn(
        `[FulfillmentGating] Insufficient commercial balance for provider ${providerCode} in tenant ${tenantId || 'platform'}.`,
      );
      return {
        allowed: false,
        availableBalance: available.toNumber(),
        requiredAmount: required.toNumber(),
        message: `رصيد المنصة التجاري لدى المزود (${providerCode}) غير كافٍ. المتاح: ${available.toString()} ${currency}، المطلوب: ${required.toString()} ${currency}.`,
      };
    }
    return {
      allowed: true,
      availableBalance: available.toNumber(),
      requiredAmount: required.toNumber(),
      accountType: account.accountType as SupplierAccountType,
    };
  }

  async fundSupplierBalance(
    staffUserId: string,
    dto: SupplierDepositDto,
  ): Promise<{ success: boolean; newBalance: number; ledgerTxId: string; transaction: any }> {
    const fundingAmount = this.toMoneyDecimal(String(dto.amount), 'Supplier funding amount');
    if (!fundingAmount.greaterThan(0)) {
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

        const actualProviderCode = provider.code.toUpperCase();
        const existing = await tx.supplierAccount.findFirst({
          where: { providerId: provider.id, currency: dto.currency, tenantId: tenantId || null },
        });
        const balanceBeforeDecimal = existing
          ? new Prisma.Decimal(existing.balance)
          : new Prisma.Decimal(0);
        const balanceAfterDecimal = balanceBeforeDecimal.plus(fundingAmount);

        const account = existing
          ? await tx.supplierAccount.update({
              where: { id: existing.id },
              data: { balance: balanceAfterDecimal },
            })
          : await tx.supplierAccount.create({
              data: {
                providerId: provider.id,
                currency: dto.currency,
                balance: balanceAfterDecimal,
                creditLimit: new Prisma.Decimal(0),
                accountType: SupplierAccountType.PREPAID,
              },
            });

        const ledgerResult = await this.ledgerService.recordSupplierFunding({
          providerCode: actualProviderCode,
          currency: dto.currency,
          amount: fundingAmount.toString(),
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
            amount: fundingAmount,
            balanceBefore: balanceBeforeDecimal,
            balanceAfter: balanceAfterDecimal,
            referenceId: dto.referenceNumber,
            ledgerTxId,
            notes: dto.notes || `تغذية رصيد تجاري عبر السند ${dto.referenceNumber}`,
          },
        });

        return { account, transaction, ledgerTxId, balanceAfter: balanceAfterDecimal.toNumber() };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return {
        success: true,
        newBalance: result.balanceAfter,
        ledgerTxId: result.ledgerTxId,
        transaction: result.transaction,
      };
    } catch (error: any) {
      this.logger.error('Supplier funding failed: ' + (error?.message || error));
      throw error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof ServiceUnavailableException
        ? error
        : new ServiceUnavailableException('تعذر تغذية رصيد المورد ذرياً؛ لم يتم إنشاء نتيجة تجريبية.');

    }
  }

  async deductOrderFulfillmentCost(
    orderId: string,
    providerCode: string,
    currency: CurrencyCode,
    costPriceInput: MonetaryInput,
    existingTx?: Prisma.TransactionClient,
  ): Promise<{ success: boolean; newBalance: number }> {
    const costPrice = this.toMoneyDecimal(costPriceInput, 'Supplier fulfillment cost');
    if (costPrice.isZero()) return { success: true, newBalance: 0 };

    const tenantId = getCurrentTenantId();
    try {
      const execute = async (tx: Prisma.TransactionClient) => {
        const provider = await tx.provider.findUnique({
          where: { code: providerCode.toUpperCase() },
        });
        if (!provider) throw new NotFoundException(`Provider ${providerCode} was not found`);

        const account = await tx.supplierAccount.findFirst({
          where: { providerId: provider.id, currency, tenantId: tenantId || null },
        });

        if (!account) {
          throw new NotFoundException('يجب إنشاء وتمويل حساب المورد الدائم قبل تنفيذ الطلب.');
        }

        const previousCharge = await tx.supplierTransaction.findFirst({
          where: {
            accountId: account.id,
            type: 'ORDER_FULFILLMENT',
            referenceId: orderId,
          },
        });
        if (previousCharge) {
          if (
            previousCharge.currency !== currency ||
            !new Prisma.Decimal(previousCharge.amount).equals(costPrice)
          ) {
            throw new ConflictException('يوجد خصم سابق لنفس الطلب بقيمة أو عملة مختلفة؛ يتطلب الأمر مطابقة يدوية.');
          }
          return { success: true, newBalance: Number(previousCharge.balanceAfter) };
        }

        const balanceBefore = new Prisma.Decimal(account.balance);
        const balanceAfter = balanceBefore.minus(costPrice);
        const creditLimit = new Prisma.Decimal(account.creditLimit);
        if (balanceAfter.plus(creditLimit).isNegative()) {
          throw new BadRequestException('Supplier commercial balance and credit limit are insufficient.');
        }

        const update = await tx.supplierAccount.updateMany({
          where: {
            id: account.id,
            balance: { equals: balanceBefore },
          },
          data: { balance: balanceAfter },
        });
        if (update.count !== 1) {
          throw new ConflictException('Supplier balance changed concurrently. Retry the fulfillment.');
        }

        await tx.supplierTransaction.create({
          data: {
            accountId: account.id,
            type: 'ORDER_FULFILLMENT',
            currency,
            amount: costPrice,
            balanceBefore: new Prisma.Decimal(balanceBefore),
            balanceAfter: new Prisma.Decimal(balanceAfter),
            referenceId: orderId,
            notes: `خصم تكلفة تنفيذ الطلب ${orderId}`,
          },
        });
        return { success: true, newBalance: balanceAfter.toNumber() };
      };
      if (existingTx) return await execute(existingTx);
      return await this.prisma.$transaction(execute, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (existingTx || process.env.NODE_ENV === 'production' || tenantId) {
        this.logger.error(`Supplier fulfillment deduction failed: ${error?.message || error}`);
        throw error;
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new ServiceUnavailableException('تعذر خصم رصيد المورد من قاعدة البيانات؛ لم يتم استخدام مخزن تجريبي.');

    }
  }

  async getSupplierTransactions(providerCode?: string): Promise<InMemorySupplierTransaction[]> {
    try {
      const rows = await this.prisma.supplierTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: { account: { include: { provider: true } } },
        take: 500,
      });
      return rows
        .filter((row) => !providerCode || row.account.provider.code === providerCode.toUpperCase())
        .map((row) => ({
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
      this.logger.error('Supplier transaction listing failed: ' + (error?.message || error));
      this.assertDatabaseForFinancialOperation();

    }
  }
}
