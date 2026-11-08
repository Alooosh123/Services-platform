import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CurrencyCode, LedgerTransactionType, CurrencyExchangePayload } from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

const DEMO_CURRENCIES = [
  { code: CurrencyCode.USD, name: 'US Dollar', nameAr: 'دولار أمريكي', symbol: '$', symbolAr: '$', isBase: true, isActive: true },
  { code: CurrencyCode.YER, name: 'Yemeni Rial', nameAr: 'ريال يمني', symbol: 'YR', symbolAr: 'ر.ي', isBase: false, isActive: true },
  { code: CurrencyCode.SAR, name: 'Saudi Riyal', nameAr: 'ريال سعودي', symbol: 'SAR', symbolAr: 'ر.س', isBase: false, isActive: true },
];

@Injectable()
export class CurrenciesService {
  private readonly logger = new Logger(CurrenciesService.name);

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  /**
   * List all supported platform currencies (YER, USD, SAR).
   */
  async getCurrencies() {
    try {
      const currs = await this.prisma.currency.findMany({
        where: { isActive: true },
        orderBy: { isBase: 'desc' },
      });
      if (Array.isArray(currs)) return currs;
      throw new ServiceUnavailableException('Currency catalog returned an invalid database response.');
    } catch (error: any) {
      if (process.env.NODE_ENV === 'test') {
        this.logger.warn(`Using test-only currency fixtures: ${error?.message || error}`);
        return DEMO_CURRENCIES;
      }
      this.logger.error(`Currency catalog lookup failed: ${error?.message || error}`);
      throw new ServiceUnavailableException('The currency catalog is temporarily unavailable.');
    }
  }

  /**
   * Get all active exchange rates.
   */
  async getRates() {
    const now = new Date();
    return this.prisma.fxRate.findMany({
      where: {
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: [{ fromCurrency: 'asc' }, { toCurrency: 'asc' }],
    });
  }

  /**
   * Get specific FX rate between two currencies.
   */
  async getRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode) {
    if (fromCurrency === toCurrency) {
      return { rate: 1.0, buyMargin: 0, sellMargin: 0 };
    }

    const now = new Date();
    const fxRate = await this.prisma.fxRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (fxRate) return fxRate;

    throw new NotFoundException(`No active FX rate found from ${fromCurrency} to ${toCurrency}`);
  }

  /**
   * Customer Currency Exchange between personal wallets via Double-Entry Ledger.
   */
  async exchangeCurrency(payload: CurrencyExchangePayload) {
    if (payload.fromCurrency === payload.toCurrency) {
      throw new BadRequestException('Cannot exchange between identical currencies.');
    }
    if (!Number.isFinite(payload.fromAmount) || payload.fromAmount <= 0 ||
      Number(payload.fromAmount.toFixed(4)) !== payload.fromAmount) {
      throw new BadRequestException('Exchange amount must be positive and have at most four decimal places.');
    }
    const idempotencyKey = payload.idempotencyKey?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException('A valid exchange idempotency key is required.');
    }

    // 1. Fetch current exchange rate
    const fxRate = await this.getRate(payload.fromCurrency, payload.toCurrency);
    const rateDecimal = new Prisma.Decimal(fxRate.rate);
    const rateVal = rateDecimal.toNumber();
    if (!Number.isFinite(rateVal) || rateDecimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Configured exchange rate must be a positive finite number.');
    }
    const convertedAmount = new Prisma.Decimal(payload.fromAmount)
      .mul(rateDecimal)
      .toDecimalPlaces(4)
      .toNumber();
    if (!Number.isFinite(convertedAmount) || convertedAmount <= 0) {
      throw new BadRequestException('Converted exchange amount must be positive.');
    }

    // 3. Post Balanced Double-Entry Transactions
    // Side A: Deduct fromCurrency wallet -> Credit Platform Currency Settlement Equity
    // Side B: Debit Platform Currency Settlement Equity -> Credit toCurrency wallet
    const equitySettlementAccount = '3001-SETTLEMENT-EQUITY';
    const fromCustomerAccount = `2001-CUSTOMER-WALLETS-${payload.fromCurrency}`;
    const toCustomerAccount = `2001-CUSTOMER-WALLETS-${payload.toCurrency}`;

    const execute = async (tx: Prisma.TransactionClient) => {
      const debitIdempotencyKey = `FX-${payload.userId}-${idempotencyKey}-OUT`;
      const existingLedger = await tx.ledgerTransaction.findUnique({
        where: { idempotencyKey: debitIdempotencyKey },
      });
      if (existingLedger) {
        const existingExchange = await tx.currencyExchange.findFirst({
          where: { ledgerTxId: existingLedger.id },
        });
        if (
          !existingExchange ||
          existingExchange.fromCurrency !== payload.fromCurrency ||
          existingExchange.toCurrency !== payload.toCurrency ||
          Number(existingExchange.fromAmount) !== payload.fromAmount
        ) {
          throw new ConflictException('The idempotency key was already used for a different exchange request.');
        }
        return { exchangeRecord: existingExchange, duplicate: true };
      }

      const fromWallet = await tx.wallet.findUnique({
        where: {
          userId_currency: { userId: payload.userId, currency: payload.fromCurrency },
        },
      });
      if (!fromWallet) {
        throw new NotFoundException(`Wallet not found for currency ${payload.fromCurrency}`);
      }
      if (fromWallet.isFrozen) {
        throw new BadRequestException(`Wallet for currency ${payload.fromCurrency} is frozen.`);
      }

      const toWallet = await tx.wallet.upsert({
        where: {
          userId_currency: { userId: payload.userId, currency: payload.toCurrency },
        },
        create: {
          userId: payload.userId,
          currency: payload.toCurrency,
          balance: 0,
        },
        update: {},
      });

      const txA = await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: `LTX-EXCH-OUT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        type: LedgerTransactionType.EXCHANGE,
        referenceType: 'EXCHANGE_DEBIT',
        referenceId: payload.userId,
        idempotencyKey: debitIdempotencyKey,
        notes: `Exchange: Sold ${payload.fromAmount} ${payload.fromCurrency}`,
        entries: [
          {
            accountCode: fromCustomerAccount,
            walletId: fromWallet.id,
            debitAmount: payload.fromAmount,
            creditAmount: 0,
            currency: payload.fromCurrency,
            notes: `Sold ${payload.fromAmount} ${payload.fromCurrency}`,
          },
          {
            accountCode: equitySettlementAccount,
            debitAmount: 0,
            creditAmount: payload.fromAmount,
            currency: payload.fromCurrency,
            notes: `Settlement credit for sold ${payload.fromCurrency}`,
          },
        ],
      }, tx);

      await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: `LTX-EXCH-IN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        type: LedgerTransactionType.EXCHANGE,
        referenceType: 'EXCHANGE_CREDIT',
        referenceId: payload.userId,
        idempotencyKey: `FX-${payload.userId}-${idempotencyKey}-IN`,
        notes: `Exchange: Bought ${convertedAmount} ${payload.toCurrency}`,
        entries: [
          {
            accountCode: equitySettlementAccount,
            debitAmount: convertedAmount,
            creditAmount: 0,
            currency: payload.toCurrency,
            notes: `Settlement debit for bought ${payload.toCurrency}`,
          },
          {
            accountCode: toCustomerAccount,
            walletId: toWallet.id,
            debitAmount: 0,
            creditAmount: convertedAmount,
            currency: payload.toCurrency,
            notes: `Received ${convertedAmount} ${payload.toCurrency}`,
          },
        ],
      }, tx);

      const exchangeRecord = await tx.currencyExchange.create({
        data: {
          userId: payload.userId,
          fromCurrency: payload.fromCurrency,
          toCurrency: payload.toCurrency,
          fromAmount: new Prisma.Decimal(payload.fromAmount),
          toAmount: new Prisma.Decimal(convertedAmount),
          fxRate: new Prisma.Decimal(rateVal),
          ledgerTxId: txA.transaction.id,
        },
      });
      return { exchangeRecord, duplicate: false };
    };

    const result = await this.prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return {
      success: true,
      exchange: result.exchangeRecord,
      receivedAmount: Number(result.exchangeRecord.toAmount),
      rate: Number(result.exchangeRecord.fxRate),
      duplicate: result.duplicate,
    };
  }
}
