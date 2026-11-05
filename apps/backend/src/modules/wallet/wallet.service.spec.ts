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
      wallet: { findUnique: jest.fn().mockResolvedValue(wallet) },
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
});
