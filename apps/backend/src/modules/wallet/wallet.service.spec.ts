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
  let ledger: any;
  let service: WalletService;

  beforeEach(() => {
    prisma = {
      wallet: { findUnique: jest.fn().mockResolvedValue(wallet) },
      paymentMethod: { findUnique: jest.fn().mockResolvedValue(paymentMethod) },
      walletTopup: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'topup-1' }),
        update: jest.fn().mockResolvedValue({ id: 'topup-1', status: PaymentStatus.Confirmed }),
      },
    };
    prisma.$transaction = jest.fn((callback: (tx: any) => Promise<any>) => callback(prisma));
    ledger = {
      recordTopup: jest.fn().mockResolvedValue({ transaction: { id: 'ledger-topup-1' } }),
    };
    service = new WalletService(prisma, ledger);
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
  it('confirms a topup and posts its ledger entry inside the same transaction', async () => {
    prisma.walletTopup.findUnique.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      currency: CurrencyCode.YER,
      amount: 100,
      referenceNumber: 'REF-100',
      status: PaymentStatus.AwaitingVerification,
      paymentMethod: { code: PaymentChannelCode.JAIB },
      wallet,
    });

    const result = await service.confirmTopup('finance-1', 'topup-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(ledger.recordTopup).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        walletId: 'wallet-1',
        referenceId: 'topup-1',
        performedByUserId: 'finance-1',
      }),
      prisma,
    );
    expect(prisma.walletTopup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'topup-1' },
        data: expect.objectContaining({ status: PaymentStatus.Confirmed }),
      }),
    );
    expect(result.ledgerTransaction).toEqual({ id: 'ledger-topup-1' });
  });

  it('does not confirm a topup when its ledger posting fails', async () => {
    prisma.walletTopup.findUnique.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      currency: CurrencyCode.YER,
      amount: 100,
      referenceNumber: 'REF-100',
      status: PaymentStatus.AwaitingVerification,
      paymentMethod: { code: PaymentChannelCode.JAIB },
      wallet,
    });
    ledger.recordTopup.mockRejectedValueOnce(new Error('ledger database unavailable'));

    await expect(service.confirmTopup('finance-1', 'topup-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.walletTopup.update).not.toHaveBeenCalled();
  });

  it('does not mutate an in-memory wallet when a test ledger deposit fails', async () => {
    const inMemoryWallet = (service as any).memoryWallets.get('w-cust-yer');
    const startingBalance = inMemoryWallet.balance;
    prisma.wallet.findUnique.mockResolvedValue({
      ...wallet,
      userId: 'user-customer-003',
      currency: CurrencyCode.YER,
      id: 'w-cust-yer',
    });
    ledger.recordTopup.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(service.depositFunds('user-customer-003', {
      amount: 250,
      currency: CurrencyCode.YER,
    } as any)).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(inMemoryWallet.balance).toBe(startingBalance);
  });

});
