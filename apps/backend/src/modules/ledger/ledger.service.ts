import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CurrencyCode,
  LedgerAccountType,
  LedgerTransactionType,
  PaymentChannelCode,
  DoubleEntryItem,
  DoubleEntryTransactionPayload,
} from '@digital-topup/shared';
import { Prisma } from '@prisma/client';
import { AdminBalanceAdjustmentDto } from './dto/ledger-adjustment.dto';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private prisma: PrismaService) {}

  private scopeTenantKey(value: string): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return value;
    const prefix = `${tenantId}::`;
    return value.startsWith(prefix) ? value : `${prefix}${value}`;
  }

  private scopeAccountCode(value: string): string {
    return this.scopeTenantKey(value);
  }

  /**
   * Helper to ensure core system accounts exist in the chart of accounts.
   */
  async ensureAccount(code: string, name: string, type: LedgerAccountType, currency: CurrencyCode, description?: string) {
    const scopedCode = this.scopeAccountCode(code);
    return this.prisma.ledgerAccount.upsert({
      where: { code: scopedCode },
      update: {},
      create: {
        code: scopedCode,
        name,
        type,
        currency,
        description,
      },
    });
  }

  /**
   * Records a strictly balanced Double-Entry transaction inside a serializable database transaction.
   * Total Debit MUST equal Total Credit for the same currency!
   */
  async recordDoubleEntryTransaction(
    payload: DoubleEntryTransactionPayload,
    existingTx?: Prisma.TransactionClient,
  ) {
    if (!payload.entries || payload.entries.length < 2) {
      throw new BadRequestException('A double-entry transaction must have at least 2 entries.');
    }

    // Check sum of debits == sum of credits per currency
    const balancesByCurrency = new Map<
      CurrencyCode,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const entry of payload.entries) {
      const debit = Number(entry.debitAmount || 0);
      const credit = Number(entry.creditAmount || 0);
      if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0)) {
        throw new BadRequestException('Ledger entry amounts must be finite, non-negative, and one-sided.');
      }
      const cur = entry.currency;
      const current = balancesByCurrency.get(cur) || {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      current.debit = current.debit.add(debit);
      current.credit = current.credit.add(credit);
      balancesByCurrency.set(cur, current);
    }

    for (const [cur, totals] of balancesByCurrency.entries()) {
      if (!totals.debit.equals(totals.credit)) {
        throw new BadRequestException(
          `Double-entry imbalance for currency ${cur}: Total Debit (${totals.debit.toFixed(4)}) != Total Credit (${totals.credit.toFixed(4)})`,
        );
      }
    }

    const execute = async (tx: Prisma.TransactionClient) => {
      const scopedIdempotencyKey = payload.idempotencyKey
        ? this.scopeTenantKey(payload.idempotencyKey)
        : undefined;
      // Idempotency verification is tenant-scoped by both key prefix and Prisma query scope.
      if (scopedIdempotencyKey) {
        const existingTxn = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: scopedIdempotencyKey },
          include: { entries: true },
        });
        if (existingTxn) {
          return { isDuplicate: true, transaction: existingTxn };
        }
      }

      // Check unique txNumber
      const txNumber = this.scopeTenantKey(payload.txNumber || `LTX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`);

      // 1. Create LedgerTransaction
      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          txNumber,
          type: payload.type,
          status: 'POSTED',
          referenceType: payload.referenceType,
          referenceId: payload.referenceId,
          idempotencyKey: scopedIdempotencyKey || null,
          notes: payload.notes || null,
          createdByUserId: payload.createdByUserId || null,
        },
      });

      // 2. Insert Entries and apply balance updates to customer wallets if linked
      for (const item of payload.entries) {
        // Resolve account
        const scopedAccountCode = this.scopeAccountCode(item.accountCode);
        let account = await tx.ledgerAccount.findUnique({
          where: { code: scopedAccountCode },
        });

        if (!account) {
          const accType = item.accountCode.startsWith('1')
            ? LedgerAccountType.ASSET
            : item.accountCode.startsWith('2')
            ? LedgerAccountType.LIABILITY
            : item.accountCode.startsWith('3')
            ? LedgerAccountType.EQUITY
            : item.accountCode.startsWith('4')
            ? LedgerAccountType.REVENUE
            : LedgerAccountType.EXPENSE;

          account = await tx.ledgerAccount.create({
            data: {
              code: scopedAccountCode,
              name: item.notes || scopedAccountCode,
              type: accType,
              currency: item.currency,
              description: 'Auto-provisioned ledger account',
            },
          });
        }

        const debitDec = new Prisma.Decimal(item.debitAmount || 0);
        const creditDec = new Prisma.Decimal(item.creditAmount || 0);

        await tx.ledgerEntry.create({
          data: {
            transactionId: ledgerTx.id,
            accountId: account.id,
            walletId: item.walletId || null,
            debitAmount: debitDec,
            creditAmount: creditDec,
            currency: item.currency,
            notes: item.notes || null,
          },
        });

        // If this entry touches a customer wallet:
        // Customer Wallets are Liability accounts:
        // Crediting increases customer balance; Debiting decreases customer balance.
        if (item.walletId) {
          const wallet = await tx.wallet.findUnique({
            where: { id: item.walletId },
          });

          if (!wallet) {
            throw new NotFoundException(`Wallet ${item.walletId} not found.`);
          }

          if (wallet.currency !== item.currency) {
            throw new BadRequestException(`Wallet ${wallet.id} currency does not match ledger entry currency.`);
          }

          const currentBal = new Prisma.Decimal(wallet.balance);
          const lockedBal = new Prisma.Decimal(wallet.lockedBalance || 0);
          const netChange = creditDec.sub(debitDec);
          const newBal = currentBal.add(netChange);

          if (newBal.lessThan(0)) {
            throw new BadRequestException(
              `Insufficient wallet balance for user. Current: ${currentBal.toFixed(2)}, attempted deduction: ${debitDec.toFixed(2)} ${item.currency}`,
            );
          }

          if (debitDec.greaterThan(0) && currentBal.sub(lockedBal).lessThan(debitDec)) {
            throw new BadRequestException(
              `Insufficient available wallet balance. Current available: ${currentBal.sub(lockedBal).toFixed(2)} ${item.currency}`,
            );
          }

          const updated = await tx.wallet.updateMany({
            where: { id: wallet.id, version: wallet.version ?? 0 },
            data: {
              balance: { increment: netChange },
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) {
            throw new ConflictException('Wallet changed concurrently; retry the transaction.');
          }
        }
      }

      const completedTx = await tx.ledgerTransaction.findUnique({
        where: { id: ledgerTx.id },
        include: { entries: { include: { account: true, wallet: true } } },
      });

      return { isDuplicate: false, transaction: completedTx! };
    };

    if (existingTx) {
      return execute(existingTx);
    } else {
      return this.prisma.$transaction(execute, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    }
  }

  /**
   * Records a Reversal Transaction. Inverts debits and credits from the original transaction.
   * Completely immutable: never deletes or mutates posted transactions.
   */
  async recordReversalTransaction(
    originalTxId: string,
    performedByUserId: string,
    reason: string,
    existingTx?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const originalTx = await tx.ledgerTransaction.findUnique({
        where: { id: originalTxId },
        include: { entries: { include: { account: true } } },
      });

      if (!originalTx) {
        throw new NotFoundException(`Original transaction ${originalTxId} not found.`);
      }

      if (originalTx.status === 'REVERSED') {
        throw new ConflictException(`Transaction ${originalTx.txNumber} has already been reversed.`);
      }

      const reversalTxNumber = `REV-${originalTx.txNumber}`;

      // Invert entries
      const invertedEntries: DoubleEntryItem[] = originalTx.entries.map((entry) => ({
        accountCode: entry.account.code,
        walletId: entry.walletId || undefined,
        debitAmount: Number(entry.creditAmount), // Invert
        creditAmount: Number(entry.debitAmount), // Invert
        currency: entry.currency as CurrencyCode,
        notes: `Reversal of entry ${entry.id}: ${reason}`,
      }));

      // Mark original as reversed
      await tx.ledgerTransaction.update({
        where: { id: originalTxId },
        data: { status: 'REVERSED' },
      });

      // Post reversal
      const reversalResult = await this.recordDoubleEntryTransaction(
        {
          txNumber: reversalTxNumber,
          type: originalTx.type as LedgerTransactionType,
          referenceType: 'REVERSAL',
          referenceId: originalTx.id,
          createdByUserId: performedByUserId,
          notes: `Reversal of ${originalTx.txNumber}: ${reason}`,
          entries: invertedEntries,
        },
        tx,
      );

      return reversalResult;
    };
    if (existingTx) return execute(existingTx);
    return this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Helper: Record Deposit / Topup for a customer wallet.
   * Debit: Cash Clearing Asset Account
   * Credit: Customer Liability Account (increases customer wallet balance)
   */
  async recordTopup(params: {
    userId: string;
    walletId: string;
    currency: CurrencyCode;
    amount: number;
    paymentChannel: PaymentChannelCode;
    referenceId: string;
    performedByUserId?: string;
    notes?: string;
  }, existingTx?: Prisma.TransactionClient) {
    let clearingAccountCode = '1001-CASH-JAIB';
    if (params.paymentChannel === PaymentChannelCode.JAIB) clearingAccountCode = '1001-CASH-JAIB';
    else if (params.paymentChannel === PaymentChannelCode.JAWALI) clearingAccountCode = '1002-CASH-JAWALI';
    else if (params.paymentChannel === PaymentChannelCode.CASH) clearingAccountCode = '1003-CASH-SABA';
    else if (params.paymentChannel === PaymentChannelCode.ONE_CASH) clearingAccountCode = '1004-CASH-ONECASH';
    else if (params.paymentChannel === PaymentChannelCode.EASY) clearingAccountCode = '1005-CASH-EASY';
    else if (params.currency === CurrencyCode.USD) clearingAccountCode = '1010-CLEARING-USD';
    else if (params.currency === CurrencyCode.SAR) clearingAccountCode = '1011-CLEARING-SAR';

    const customerAccountCode =
      params.currency === CurrencyCode.YER
        ? '2001-CUSTOMER-WALLETS-YER'
        : params.currency === CurrencyCode.USD
        ? '2002-CUSTOMER-WALLETS-USD'
        : '2003-CUSTOMER-WALLETS-SAR';

    return this.recordDoubleEntryTransaction({
      txNumber: `LTX-TOPUP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      type: LedgerTransactionType.TOPUP,
      referenceType: 'TOPUP',
      referenceId: params.referenceId,
      idempotencyKey: `TOPUP-${params.referenceId}`,
      createdByUserId: params.performedByUserId,
      notes: params.notes || `Topup via ${params.paymentChannel}`,
      entries: [
        {
          accountCode: clearingAccountCode,
          debitAmount: params.amount,
          creditAmount: 0,
          currency: params.currency,
          notes: `Funds received through ${params.paymentChannel}`,
        },
        {
          accountCode: customerAccountCode,
          walletId: params.walletId,
          debitAmount: 0,
          creditAmount: params.amount,
          currency: params.currency,
          notes: `Customer balance credited`,
        },
      ],
    }, existingTx);
  }

  async recordGatewayTopup(params: {
    userId: string;
    walletId: string;
    currency: CurrencyCode;
    amount: number;
    feeAmount: number;
    paymentChannel: PaymentChannelCode;
    referenceId: string;
  }, existingTx: Prisma.TransactionClient) {
    if (
      !Number.isFinite(params.amount) ||
      !Number.isFinite(params.feeAmount) ||
      params.amount <= 0 ||
      params.feeAmount < 0
    ) {
      throw new BadRequestException('Gateway top-up amount or fee is invalid.');
    }
    const clearingCode = this.getChannelAccountCode(params.paymentChannel, params.currency);
    const entries: DoubleEntryItem[] = [
      {
        accountCode: clearingCode,
        debitAmount: params.amount + params.feeAmount,
        creditAmount: 0,
        currency: params.currency,
        notes: `Gateway funds received for payment ${params.referenceId}`,
      },
      {
        accountCode: this.getCustomerAccountCode(params.currency),
        walletId: params.walletId,
        debitAmount: 0,
        creditAmount: params.amount,
        currency: params.currency,
        notes: `Wallet top-up credited for payment ${params.referenceId}`,
      },
    ];
    if (params.feeAmount > 0) {
      entries.push({
        accountCode: this.getRevenueAccountCode(params.currency),
        debitAmount: 0,
        creditAmount: params.feeAmount,
        currency: params.currency,
        notes: `Payment gateway fee retained for ${params.referenceId}`,
      });
    }
    return this.recordDoubleEntryTransaction({
      txNumber: `LTX-GW-TOPUP-${params.referenceId}`,
      type: LedgerTransactionType.TOPUP,
      referenceType: 'GLOBAL_PAYMENT',
      referenceId: params.referenceId,
      idempotencyKey: `GLOBAL-TOPUP-${params.referenceId}`,
      notes: `Global payment top-up via ${params.paymentChannel}`,
      entries,
    }, existingTx);
  }

  getCustomerAccountCode(currency: CurrencyCode): string {
    if (currency === CurrencyCode.YER) return '2001-CUSTOMER-WALLETS-YER';
    if (currency === CurrencyCode.USD) return '2002-CUSTOMER-WALLETS-USD';
    return '2003-CUSTOMER-WALLETS-SAR';
  }

  getRevenueAccountCode(currency: CurrencyCode): string {
    if (currency === CurrencyCode.YER) return '4001-REVENUE-YER';
    if (currency === CurrencyCode.USD) return '4002-REVENUE-USD';
    return '4003-REVENUE-SAR';
  }

  getCogsAccountCode(currency: CurrencyCode): string {
    if (currency === CurrencyCode.YER) return '5001-COGS-YER';
    if (currency === CurrencyCode.USD) return '5002-COGS-USD';
    return '5003-COGS-SAR';
  }

  getProviderClearingAccountCode(currency: CurrencyCode): string {
    if (currency === CurrencyCode.YER) return '1020-PROVIDER-CLEARING-YER';
    if (currency === CurrencyCode.USD) return '1021-PROVIDER-CLEARING-USD';
    return '1022-PROVIDER-CLEARING-SAR';
  }

  getSupplierPrepaidAccountCode(currency: CurrencyCode): string {
    if (currency === CurrencyCode.YER) return '1030-SUPPLIER-PREPAID-YER';
    if (currency === CurrencyCode.USD) return '1031-SUPPLIER-PREPAID-USD';
    return '1032-SUPPLIER-PREPAID-SAR';
  }

  getChannelAccountCode(channel: PaymentChannelCode, currency: CurrencyCode): string {
    if (channel === PaymentChannelCode.JAIB) return '1001-CASH-JAIB';
    if (channel === PaymentChannelCode.JAWALI) return '1002-CASH-JAWALI';
    if (channel === PaymentChannelCode.CASH) return '1003-CASH-SABA';
    if (channel === PaymentChannelCode.ONE_CASH) return '1004-CASH-ONECASH';
    if (channel === PaymentChannelCode.EASY) return '1005-CASH-EASY';
    if (currency === CurrencyCode.USD) return '1010-CLEARING-USD';
    if (currency === CurrencyCode.SAR) return '1011-CLEARING-SAR';
    return '1001-CASH-JAIB';
  }

  getBankCashAccountCode(currency: CurrencyCode): string {
    if (currency === CurrencyCode.USD) return '1010-CLEARING-USD';
    if (currency === CurrencyCode.SAR) return '1011-CLEARING-SAR';
    return '1001-CASH-JAIB';
  }

  /**
   * P05 / AT-16: Record Cash Movement for Funding Provider Commercial Prepaid Account
   * Debit: Supplier Prepaid Account (Asset)
   * Credit: Bank/Payment Channel Account (Asset)
   */
  async recordSupplierFunding(params: {
    providerCode: string;
    currency: CurrencyCode;
    amount: number;
    referenceNumber: string;
    channelCode?: PaymentChannelCode;
    performedByUserId?: string;
    notes?: string;
  }, existingTx?: Prisma.TransactionClient) {
    const prepaidAccountCode = this.getSupplierPrepaidAccountCode(params.currency);
    const channelAccountCode = params.channelCode
      ? this.getChannelAccountCode(params.channelCode, params.currency)
      : this.getBankCashAccountCode(params.currency);

    const txNumber = `LTX-SUP-FUND-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    return this.recordDoubleEntryTransaction({
      txNumber,
      type: LedgerTransactionType.ADJUSTMENT,
      referenceType: 'SUPPLIER_FUNDING',
      referenceId: params.referenceNumber,
      idempotencyKey: `SUP-FUND-${params.referenceNumber}`,
      createdByUserId: params.performedByUserId,
      notes: params.notes || `Prepaid commercial funding for supplier ${params.providerCode}`,
      entries: [
        {
          accountCode: prepaidAccountCode,
          debitAmount: params.amount,
          creditAmount: 0,
          currency: params.currency,
          notes: `Debit supplier prepaid asset (${params.providerCode})`,
        },
        {
          accountCode: channelAccountCode,
          debitAmount: 0,
          creditAmount: params.amount,
          currency: params.currency,
          notes: `Credit cash/bank account for provider funding`,
        },
      ],
    }, existingTx);
  }

  async recordAgentCommission(params: {
    parentAgentId: string;
    orderId: string;
    walletId: string;
    currency: CurrencyCode;
    amount: number;
  }) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Agent commission must be a positive finite amount.');
    }
    return this.recordDoubleEntryTransaction({
      txNumber: `LTX-AGENT-${params.orderId}`,
      type: LedgerTransactionType.ADJUSTMENT,
      referenceType: 'AGENT_COMMISSION',
      referenceId: params.orderId,
      idempotencyKey: `AGENT-COMMISSION-${params.orderId}`,
      notes: `Reseller commission for completed order ${params.orderId}`,
      entries: [
        {
          accountCode: `5004-AGENT-COMMISSION-${params.currency}`,
          debitAmount: params.amount,
          creditAmount: 0,
          currency: params.currency,
          notes: `Commission expense for reseller ${params.parentAgentId}`,
        },
        {
          accountCode: this.getCustomerAccountCode(params.currency),
          walletId: params.walletId,
          debitAmount: 0,
          creditAmount: params.amount,
          currency: params.currency,
          notes: `Commission credited for order ${params.orderId}`,
        },
      ],
    });
  }

  async reverseAgentCommission(params: {
    orderId: string;
    performedByUserId: string;
    reason: string;
  }) {
    const commission = await this.prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey: `AGENT-COMMISSION-${params.orderId}` },
      select: { id: true, status: true },
    });
    if (!commission || commission.status === 'REVERSED') {
      return;
    }

    return this.recordReversalTransaction(
      commission.id,
      params.performedByUserId,
      `Agent commission reversal: ${params.reason}`,
    );
  }

  /**
   * P05 / AT-18: Record Confirmed Outbound Payout / Manager Withdrawal
   * Debit: Customer Wallet / Owner Liability Account
   * Credit: Bank / Payment Channel Asset Account
   */
  async recordPayoutSettlement(params: {
    payoutId: string;
    payoutNumber: string;
    userId: string;
    walletId?: string;
    currency: CurrencyCode;
    amount: number;
    channelCode: PaymentChannelCode;
    destinationAccount: string;
    performedByUserId?: string;
    notes?: string;
  }, existingTx?: Prisma.TransactionClient) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Payout amount must be a positive finite number.');
    }
    const customerAccountCode = this.getCustomerAccountCode(params.currency);
    const channelAccountCode = this.getChannelAccountCode(params.channelCode, params.currency);
    const txNumber = `LTX-PO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const execute = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.ledgerTransaction.findUnique({
        where: { idempotencyKey: `PO-SETTLE-${params.payoutNumber}` },
        include: { entries: true },
      });
      if (existing) {
        return { isDuplicate: true, transaction: existing };
      }

      // If customer wallet is linked, release hold and deduct balance atomically
      if (params.walletId) {
        const wallet = await tx.wallet.findUnique({ where: { id: params.walletId } });
        if (!wallet) {
          throw new NotFoundException(`Wallet ${params.walletId} not found`);
        }
        await this.releaseWalletHold(params.walletId, params.amount, tx);
      }

      return this.recordDoubleEntryTransaction(
        {
          txNumber,
          type: LedgerTransactionType.ADJUSTMENT,
          referenceType: 'PAYOUT',
          referenceId: params.payoutNumber,
          idempotencyKey: `PO-SETTLE-${params.payoutNumber}`,
          createdByUserId: params.performedByUserId,
          notes: params.notes || `Payout settlement for ${params.payoutNumber} to ${params.destinationAccount}`,
          entries: [
            {
              accountCode: customerAccountCode,
              walletId: params.walletId,
              debitAmount: params.amount,
              creditAmount: 0,
              currency: params.currency,
              notes: `Debit customer liability (payout ${params.payoutNumber})`,
            },
            {
              accountCode: channelAccountCode,
              debitAmount: 0,
              creditAmount: params.amount,
              currency: params.currency,
              notes: `Credit channel asset (${params.channelCode})`,
            },
          ],
        },
        tx,
      );
    };
    if (existingTx) return execute(existingTx);
    return this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  /**
   * Holds an amount in the customer wallet's lockedBalance atomically to prevent double spending.
   * Throws if wallet is frozen or if available balance (balance - lockedBalance) < amount.
   */
  async holdWalletBalance(
    walletId: string,
    amount: number,
    existingTx?: Prisma.TransactionClient,
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Wallet hold amount must be a positive finite number.');
    }

    const execute = async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);
      if (wallet.isFrozen) {
        throw new BadRequestException(
          `المحفظة مجمدة (${wallet.frozenReason || 'حظر إداري'}). لا يمكن إتمام عملية الشراء.`,
        );
      }

      const available = new Prisma.Decimal(wallet.balance).sub(wallet.lockedBalance || 0);
      if (available.lessThan(amount)) {
        throw new BadRequestException(
          `الرصيد المتاح غير كافٍ بالعملة ${wallet.currency}. المطلوب: ${amount}، المتاح: ${available.toString()}`,
        );
      }

      const updated = await tx.wallet.updateMany({
        where: { id: walletId, version: wallet.version ?? 0, isFrozen: false },
        data: {
          lockedBalance: { increment: new Prisma.Decimal(amount) },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Wallet changed concurrently; retry the transaction.');
      }
      return tx.wallet.findUnique({ where: { id: walletId } });
    };

    if (existingTx) return execute(existingTx);
    return this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Releases locked amount without altering total balance (e.g. order failure or cancellation before settlement).
   */
  async releaseWalletHold(
    walletId: string,
    amount: number,
    existingTx?: Prisma.TransactionClient,
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Wallet hold release amount must be a positive finite number.');
    }

    const execute = async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);
      if (new Prisma.Decimal(wallet.lockedBalance || 0).lessThan(amount)) {
        throw new ConflictException(`Wallet ${walletId} does not have enough locked funds to release.`);
      }
      const updated = await tx.wallet.updateMany({
        where: { id: walletId, version: wallet.version ?? 0 },
        data: {
          lockedBalance: { decrement: new Prisma.Decimal(amount) },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Wallet changed concurrently; retry the transaction.');
      }
      return tx.wallet.findUnique({ where: { id: walletId } });
    };

    if (existingTx) return execute(existingTx);
    return this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Phase 3 Complete Order Settlement:
   * 4-Legged Strictly Balanced Double-Entry:
   * 1. Debit: Customer Liability (retail price) -> decreases customer wallet balance
   * 2. Credit: TopUp Sales Revenue (retail price)
   * 3. Debit: Cost of Goods Sold (cost price)
   * 4. Credit: Provider Clearing (cost price)
   * Also simultaneously releases the lockedBalance hold on the wallet!
   */
  async recordOrderSettlement(params: {
    userId: string;
    walletId: string;
    orderId: string;
    currency: CurrencyCode;
    retailPrice: number;
    costPrice: number;
    serviceName: string;
    providerCode?: string;
  }, existingTx?: Prisma.TransactionClient) {
    if (
      !Number.isFinite(params.retailPrice) ||
      !Number.isFinite(params.costPrice) ||
      params.retailPrice <= 0 ||
      params.costPrice < 0 ||
      params.costPrice > params.retailPrice
    ) {
      throw new BadRequestException('Order settlement prices are invalid.');
    }
    const customerAccountCode = this.getCustomerAccountCode(params.currency);
    const revenueAccountCode = this.getRevenueAccountCode(params.currency);
    const cogsAccountCode = this.getCogsAccountCode(params.currency);
    const providerAccountCode = this.getProviderClearingAccountCode(params.currency);

    const costPrice = Math.max(0, params.costPrice || 0);

    const execute = async (tx: Prisma.TransactionClient) => {
    const existing = await tx.ledgerTransaction.findUnique({
      where: { idempotencyKey: `ORDER-SETTLE-${params.orderId}` },
      include: { entries: true },
    });
    if (existing) {
      return { isDuplicate: true, transaction: existing };
    }

    // 1. Release the exact reservation in the same transaction as settlement.
    await this.releaseWalletHold(params.walletId, params.retailPrice, tx);

      // 2. Prepare Double-Entry entries
      const entries: DoubleEntryItem[] = [
        {
          accountCode: customerAccountCode,
          walletId: params.walletId,
          debitAmount: params.retailPrice,
          creditAmount: 0,
          currency: params.currency,
          notes: `Settlement debit for order ${params.orderId}`,
        },
        {
          accountCode: revenueAccountCode,
          debitAmount: 0,
          creditAmount: params.retailPrice,
          currency: params.currency,
          notes: `Sales revenue for order ${params.orderId} (${params.serviceName})`,
        },
      ];

      // If cost price > 0, include COGS and Provider Clearing entries
      if (costPrice > 0) {
        entries.push(
          {
            accountCode: cogsAccountCode,
            debitAmount: costPrice,
            creditAmount: 0,
            currency: params.currency,
            notes: `Cost of goods sold for order ${params.orderId}`,
          },
          {
            accountCode: providerAccountCode,
            debitAmount: 0,
            creditAmount: costPrice,
            currency: params.currency,
            notes: `Provider clearing payable for order ${params.orderId} (${params.providerCode || 'PROVIDER'})`,
          },
        );
      }

      return this.recordDoubleEntryTransaction(
        {
          txNumber: `LTX-SETTLE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          type: LedgerTransactionType.PURCHASE,
          referenceType: 'ORDER',
          referenceId: params.orderId,
          idempotencyKey: `ORDER-SETTLE-${params.orderId}`,
          notes: `Settlement for order ${params.orderId}: ${params.serviceName}`,
          entries,
        },
        tx,
      );
    };

    if (existingTx) {
      return execute(existingTx);
    }

    return this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Helper: Record Order Payment from customer wallet (Legacy/Instant purchase).
   * Debit: Customer Liability Account (reduces customer wallet balance)
   * Credit: Topup Sales Revenue Account
   */
  async recordOrderPurchase(params: {
    userId: string;
    walletId: string;
    orderId: string;
    currency: CurrencyCode;
    retailPrice: number;
    serviceName: string;
  }) {
    const customerAccountCode = this.getCustomerAccountCode(params.currency);
    const revenueAccountCode = this.getRevenueAccountCode(params.currency);

    return this.recordDoubleEntryTransaction({
      txNumber: `LTX-PURCHASE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      type: LedgerTransactionType.PURCHASE,
      referenceType: 'ORDER',
      referenceId: params.orderId,
      notes: `Purchase for service: ${params.serviceName}`,
      entries: [
        {
          accountCode: customerAccountCode,
          walletId: params.walletId,
          debitAmount: params.retailPrice,
          creditAmount: 0,
          currency: params.currency,
          notes: `Wallet deduction for order ${params.orderId}`,
        },
        {
          accountCode: revenueAccountCode,
          debitAmount: 0,
          creditAmount: params.retailPrice,
          currency: params.currency,
          notes: `Sales revenue recognized`,
        },
      ],
    });
  }

  /**
   * Helper: Record Order Refund to customer wallet.
   * Debit: Sales Revenue Account
   * Credit: Customer Liability Account (increases customer wallet balance)
   * Also reverses COGS and Provider Clearing if cost price is provided.
   */
  async recordOrderRefund(params: {
    userId: string;
    walletId: string;
    orderId: string;
    currency: CurrencyCode;
    amount: number;
    costPrice?: number;
    reason: string;
    performedByUserId?: string;
  }) {
    const customerAccountCode = this.getCustomerAccountCode(params.currency);
    const revenueAccountCode = this.getRevenueAccountCode(params.currency);
    const cogsAccountCode = this.getCogsAccountCode(params.currency);
    const providerAccountCode = this.getProviderClearingAccountCode(params.currency);

    const costPrice = Math.max(0, params.costPrice || 0);

    const entries: DoubleEntryItem[] = [
      {
        accountCode: revenueAccountCode,
        debitAmount: params.amount,
        creditAmount: 0,
        currency: params.currency,
        notes: `Sales revenue reversed for refund: ${params.reason}`,
      },
      {
        accountCode: customerAccountCode,
        walletId: params.walletId,
        debitAmount: 0,
        creditAmount: params.amount,
        currency: params.currency,
        notes: `Customer wallet refunded for order ${params.orderId}`,
      },
    ];

    if (costPrice > 0) {
      entries.push(
        {
          accountCode: providerAccountCode,
          debitAmount: costPrice,
          creditAmount: 0,
          currency: params.currency,
          notes: `Reversal of provider clearing payable for refund ${params.orderId}`,
        },
        {
          accountCode: cogsAccountCode,
          debitAmount: 0,
          creditAmount: costPrice,
          currency: params.currency,
          notes: `Reversal of COGS for refund ${params.orderId}`,
        },
      );
    }

    return this.recordDoubleEntryTransaction({
      txNumber: `LTX-REFUND-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      type: LedgerTransactionType.REFUND,
      referenceType: 'ORDER_REFUND',
      referenceId: params.orderId,
      createdByUserId: params.performedByUserId,
      notes: `Order refund: ${params.reason}`,
      entries,
    });
  }


  /**
   * Admin manual balance adjustment (Creates balanced transaction against Equity/Adjustment).
   */
  async adminAdjustBalance(staffUserId: string, dto: AdminBalanceAdjustmentDto) {
    const currency = dto.currency || CurrencyCode.USD;
    const customerAccountCode = `2001-CUSTOMER-WALLETS-${currency}`;
    const equityAdjustmentAccountCode = '3001-SETTLEMENT-EQUITY';

    // Find target user wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_currency: {
          userId: dto.userId,
          currency: currency,
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException(`Customer wallet not found for currency ${currency}`);
    }

    const isCredit = dto.type === 'CREDIT';
    const amount = Math.abs(dto.amount);

    const entries: DoubleEntryItem[] = isCredit
      ? [
          {
            accountCode: equityAdjustmentAccountCode,
            debitAmount: amount,
            creditAmount: 0,
            currency,
            notes: `Admin equity debit: ${dto.reason}`,
          },
          {
            accountCode: customerAccountCode,
            walletId: wallet.id,
            debitAmount: 0,
            creditAmount: amount,
            currency,
            notes: `Admin credit to customer wallet: ${dto.reason}`,
          },
        ]
      : [
          {
            accountCode: customerAccountCode,
            walletId: wallet.id,
            debitAmount: amount,
            creditAmount: 0,
            currency,
            notes: `Admin debit from customer wallet: ${dto.reason}`,
          },
          {
            accountCode: equityAdjustmentAccountCode,
            debitAmount: 0,
            creditAmount: amount,
            currency,
            notes: `Admin equity credit: ${dto.reason}`,
          },
        ];

    const result = await this.recordDoubleEntryTransaction({
      txNumber: `LTX-ADJ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      type: LedgerTransactionType.ADJUSTMENT,
      referenceType: 'ADMIN_MANUAL_ADJUSTMENT',
      referenceId: `ADJ-${Date.now()}`,
      idempotencyKey: dto.idempotencyKey,
      notes: dto.reason,
      createdByUserId: staffUserId,
      entries,
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        userId: staffUserId,
        action: 'LEDGER_ADMIN_ADJUSTMENT',
        entityName: 'Wallet',
        entityId: wallet.id,
        newValues: {
          currency,
          amount,
          type: dto.type,
          reason: dto.reason,
          txId: result.transaction.id,
        },
      },
    });

    return result;
  }

  /**
   * Query financial statement with entries and accounts.
   */
  async getLedgerStatement(params: {
    walletId?: string;
    accountCode?: string;
    type?: LedgerTransactionType;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LedgerEntryWhereInput = {};
    if (params.walletId) where.walletId = params.walletId;
    if (params.accountCode) where.account = { code: params.accountCode };
    if (params.type) where.transaction = { type: params.type };

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          account: true,
          transaction: true,
          wallet: { select: { id: true, userId: true, currency: true } },
        },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
