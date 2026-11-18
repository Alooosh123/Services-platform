import { ConflictException } from '@nestjs/common';
import { CurrencyCode, PaymentChannelCode } from '@digital-topup/shared';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  const wallet = {
    id: 'wallet-1',
    userId: 'user-1',
    currency: CurrencyCode.YER,
    balance: 0,
    lockedBalance: 0,
    isFrozen: false,
  };
  const paymentMethod = {
    id: 'payment-method-1',
    code: PaymentChannelCode.JAIB,
    isActive: true,
  };

  let prisma: any;
  let service: WalletService;

  beforeEach(() => {
    prisma = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue(wallet),
        findMany: jest.fn().mockResolvedValue([{ id: wallet.id, currency: CurrencyCode.YER }]),
      },
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (operations: Promise<any>[]) => Promise.all(operations)),
      paymentMethod: { findUnique: jest.fn().mockResolvedValue(paymentMethod) },
      walletTopup: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'topup-1' }),
      },
    };
    service = new WalletService(prisma, {} as any);
  });

  it('checks duplicate references within the selected payment method', async () => {
    await service.requestTopup('user-1', {
      currency: CurrencyCode.YER,
      amount: 100,
      paymentMethodCode: PaymentChannelCode.JAIB,
      referenceNumber: 'REF-1',
    });

    expect(prisma.walletTopup.findUnique).toHaveBeenCalledWith({
      where: {
        paymentMethodId_referenceNumber: {
          paymentMethodId: paymentMethod.id,
          referenceNumber: 'REF-1',
        },
      },
    });
  });

  it('reports a duplicate when a concurrent topup violates the composite unique constraint', async () => {
    prisma.walletTopup.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['paymentMethodId', 'referenceNumber'] },
    });

    await expect(
      service.requestTopup('user-1', {
        currency: CurrencyCode.YER,
        amount: 100,
        paymentMethodCode: PaymentChannelCode.JAIB,
        referenceNumber: 'REF-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns only posted ledger entries for the authenticated customer wallets', async () => {
    prisma.ledgerEntry.findMany.mockResolvedValue([{
      id: 'entry-1',
      walletId: wallet.id,
      debitAmount: { toString: () => '0' },
      creditAmount: { toString: () => '2500' },
      currency: CurrencyCode.YER,
      notes: 'Verified deposit',
      createdAt: new Date('2026-11-10T08:00:00.000Z'),
      transaction: {
        id: 'tx-1',
        txNumber: 'LTX-1',
        status: 'POSTED',
        referenceType: 'DEPOSIT',
        referenceId: 'DEP-1',
        notes: null,
        postedAt: new Date('2026-11-10T08:00:00.000Z'),
        isReversal: false,
      },
    }]);
    prisma.ledgerEntry.count.mockResolvedValue(1);

    const result = await service.getWalletTransactions('user-1', CurrencyCode.YER, 1, 10);

    expect(prisma.wallet.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', currency: CurrencyCode.YER },
      select: { id: true, currency: true },
    });
    expect(prisma.ledgerEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        walletId: { in: [wallet.id] },
        transaction: { status: { in: ['POSTED', 'REVERSED'] } },
      },
    }));
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      transactionId: 'tx-1',
      direction: 'CREDIT',
      amount: 2500,
      currency: CurrencyCode.YER,
      referenceType: 'DEPOSIT',
      referenceId: 'DEP-1',
    });
  });
});
