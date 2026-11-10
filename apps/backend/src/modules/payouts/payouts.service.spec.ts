import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsService } from './payouts.service';
import { PaymentAdapterRegistry } from '../deposits/adapters/yemen-payment.adapters';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { CurrencyCode, PaymentChannelCode } from '@digital-topup/shared';
import { ServiceUnavailableException } from '@nestjs/common';

describe('Customer payout production safety', () => {
  let service: PayoutsService;

  const mockPrisma: any = {
    payoutRequest: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    paymentChannelConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'customer-real-id', phoneVerifiedAt: null, createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) }),
    },
    $transaction: jest.fn(async (callback: any) => callback(mockPrisma)),
  };
  const ledger = {
    holdWalletBalance: jest.fn(),
    releaseWalletHold: jest.fn(),
    recordPayoutSettlement: jest.fn(),
  };
  const wallet = { getWallet: jest.fn().mockResolvedValue({ id: 'wallet-1' }) };
  const registry = {
    getAdapter: jest.fn(() => ({
      getInfo: () => ({
        isActive: false,
        mode: 'BLOCKED_EXTERNAL',
        minAmount: 500,
        maxAmount: 2000000,
        capabilities: { payout: false },
      }),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.payoutRequest.findUnique.mockResolvedValue(null);
    mockPrisma.payoutRequest.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PaymentAdapterRegistry, useValue: registry },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: ledger },
        { provide: WalletService, useValue: wallet },
      ],
    }).compile();
    service = module.get(PayoutsService);
  });

  it('refuses unverified Yemeni wallet payout channels instead of accepting fake receiving numbers', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalWalletFlag = process.env.ENABLE_CUSTOMER_WALLET_OPERATIONS;
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_CUSTOMER_WALLET_OPERATIONS = 'true';
    try {
    await expect(service.createPayoutRequest('customer-real-id', {
      currency: CurrencyCode.YER,
      amount: 1000,
      channelCode: PaymentChannelCode.JAIB,
      destinationAccount: 'UNVERIFIED-TEST-ACCOUNT',
      beneficiaryName: 'Test beneficiary',
      idempotencyKey: 'PAYOUT-UNVERIFIED-001',
    })).rejects.toThrow(ServiceUnavailableException);
    expect(ledger.holdWalletBalance).not.toHaveBeenCalled();
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalWalletFlag === undefined) delete process.env.ENABLE_CUSTOMER_WALLET_OPERATIONS;
      else process.env.ENABLE_CUSTOMER_WALLET_OPERATIONS = originalWalletFlag;
    }
  });

  it('keeps payout history database-backed and returns no seeded in-memory requests', async () => {
    await expect(service.listPayouts()).resolves.toEqual([]);
    expect(mockPrisma.payoutRequest.findMany).toHaveBeenCalled();
  });
});
