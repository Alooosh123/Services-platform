import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { CurrencyCode, PaymentChannelCode, PaymentStatus } from '@digital-topup/shared';
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
        findMany: jest.fn().mockResolvedValue([wallet]),
        upsert: jest.fn().mockResolvedValue(wallet),
        update: jest.fn().mockResolvedValue(wallet),
      },
      paymentMethod: { findUnique: jest.fn().mockResolvedValue(paymentMethod) },
      walletTopup: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'topup-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn(),
    };
    service = new WalletService(prisma, { recordTopup: jest.fn().mockResolvedValue({ transaction: { id: 'ledger-1', status: 'POSTED' } }) } as any);
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

  it('fails closed when MySQL is unavailable while reading a wallet in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    prisma.wallet.findUnique.mockRejectedValueOnce(new Error('MySQL connection unavailable'));
    try {
      await expect(service.getWallet('user-1', CurrencyCode.YER))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('does not synthesize a topup when durable request creation fails in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    prisma.walletTopup.findUnique.mockRejectedValueOnce(new Error('MySQL connection unavailable'));
    try {
      await expect(service.requestTopup('user-1', {
        currency: CurrencyCode.YER,
        amount: 100,
        paymentMethodCode: PaymentChannelCode.JAIB,
        referenceNumber: 'REF-DB-FAIL',
      })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.walletTopup.create).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('confirms a manual wallet topup with its ledger entry in the same production transaction', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const topup = {
      id: 'topup-atomic-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      currency: CurrencyCode.YER,
      amount: '100.0000',
      status: PaymentStatus.AwaitingVerification,
      referenceNumber: 'REF-ATOMIC-1',
      paymentMethod: { code: PaymentChannelCode.JAIB },
    };
    const updatedTopup = { ...topup, status: PaymentStatus.Confirmed };
    const tx = {
      walletTopup: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(topup)
          .mockResolvedValueOnce(updatedTopup),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<unknown>) => callback(tx));
    const recordTopup = jest.fn().mockResolvedValue({ transaction: { id: 'ledger-atomic-1', status: 'POSTED' } });
    service = new WalletService(prisma, { recordTopup } as any);
    try {
      const result = await service.confirmTopup('finance-1', 'topup-atomic-1');
      expect(result.topup.status).toBe(PaymentStatus.Confirmed);
      expect(recordTopup).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        walletId: 'wallet-1',
        referenceId: 'topup-atomic-1',
      }), tx);
      expect(tx.walletTopup.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'topup-atomic-1', status: PaymentStatus.AwaitingVerification },
      }));
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
        isolationLevel: 'Serializable',
      }));
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
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
});
