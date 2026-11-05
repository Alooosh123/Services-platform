import { BadRequestException } from '@nestjs/common';
import { CurrencyCode, LedgerTransactionType } from '@digital-topup/shared';
import { Prisma } from '@prisma/client';
import { CurrenciesService } from './currencies.service';

describe('CurrenciesService atomic exchanges', () => {
  const fxRate = {
    rate: new Prisma.Decimal(535),
    buyMargin: new Prisma.Decimal(0),
    sellMargin: new Prisma.Decimal(0),
    feePercentage: new Prisma.Decimal(0),
  };
  let prisma: any;
  let ledgerService: any;
  let service: CurrenciesService;

  beforeEach(() => {
    const tx = {
      ledgerTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
      currencyExchange: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'fx-exchange-1',
          fromCurrency: CurrencyCode.USD,
          toCurrency: CurrencyCode.YER,
          fromAmount: new Prisma.Decimal(2),
          toAmount: new Prisma.Decimal(1070),
          fxRate: new Prisma.Decimal(535),
          ledgerTxId: 'ledger-out-1',
        }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-usd',
          userId: 'user-1',
          currency: CurrencyCode.USD,
          isFrozen: false,
        }),
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-yer' }),
      },
    };
    prisma = {
      fxRate: { findFirst: jest.fn().mockResolvedValue(fxRate) },
      $transaction: jest.fn((callback) => callback(tx)),
      tx,
    };
    ledgerService = {
      recordDoubleEntryTransaction: jest.fn()
        .mockResolvedValueOnce({ transaction: { id: 'ledger-out-1' } })
        .mockResolvedValueOnce({ transaction: { id: 'ledger-in-1' } }),
    };
    service = new CurrenciesService(prisma, ledgerService);
  });

  it('posts both currency legs and the exchange record in one serializable transaction', async () => {
    const result = await service.exchangeCurrency({
      userId: 'user-1',
      fromCurrency: CurrencyCode.USD,
      toCurrency: CurrencyCode.YER,
      fromAmount: 2,
      idempotencyKey: 'exchange-req-1',
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(ledgerService.recordDoubleEntryTransaction).toHaveBeenCalledTimes(2);
    for (const [payload, tx] of ledgerService.recordDoubleEntryTransaction.mock.calls) {
      expect(tx).toBe(prisma.tx);
      expect(payload.type).toBe(LedgerTransactionType.EXCHANGE);
      expect(payload.idempotencyKey).toContain('exchange-req-1');
    }
    expect(result).toMatchObject({
      success: true,
      receivedAmount: 1070,
      rate: 535,
      duplicate: false,
    });
  });

  it('rejects invalid exchange amounts before posting ledger entries', async () => {
    await expect(service.exchangeCurrency({
      userId: 'user-1',
      fromCurrency: CurrencyCode.USD,
      toCurrency: CurrencyCode.YER,
      fromAmount: 0,
      idempotencyKey: 'exchange-req-2',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(ledgerService.recordDoubleEntryTransaction).not.toHaveBeenCalled();
  });

  it('replays a previous exchange without posting ledger entries again', async () => {
    const previous = {
      id: 'fx-exchange-previous',
      fromCurrency: CurrencyCode.USD,
      toCurrency: CurrencyCode.YER,
      fromAmount: new Prisma.Decimal(2),
      toAmount: new Prisma.Decimal(1070),
      fxRate: new Prisma.Decimal(535),
      ledgerTxId: 'ledger-out-previous',
    };
    prisma.tx.ledgerTransaction.findUnique.mockResolvedValue({
      id: 'ledger-out-previous',
    });
    prisma.tx.currencyExchange.findFirst.mockResolvedValue(previous);

    const result = await service.exchangeCurrency({
      userId: 'user-1',
      fromCurrency: CurrencyCode.USD,
      toCurrency: CurrencyCode.YER,
      fromAmount: 2,
      idempotencyKey: 'exchange-req-3',
    });

    expect(result.duplicate).toBe(true);
    expect(result.exchange).toBe(previous);
    expect(ledgerService.recordDoubleEntryTransaction).not.toHaveBeenCalled();
  });
});
