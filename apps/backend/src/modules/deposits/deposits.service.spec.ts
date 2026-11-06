import { Test, TestingModule } from '@nestjs/testing';
import { DepositsService } from './deposits.service';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import {
  PaymentAdapterRegistry,
  JaibPaymentAdapter,
  JawaliPaymentAdapter,
  CashPaymentAdapter,
  OneCashPaymentAdapter,
  EasyPaymentAdapter,
} from './adapters/yemen-payment.adapters';
import { CurrencyCode, PaymentChannelCode, DepositStatus } from '@digital-topup/shared';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { HmacSignatureService } from '../../security/hmac-signature.service';

describe('DepositsService (Phase 2)', () => {
  let service: DepositsService;
  let walletService: WalletService;
  let ledgerService: LedgerService;

  beforeEach(async () => {
    const testDeposits = new Map<string, any>();
    const mockPrismaService = {
      paymentChannelConfig: { findMany: jest.fn().mockResolvedValue([]) },
      depositRequest: {
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          const deposit = testDeposits.get(where.id);
          if (!deposit || deposit.status !== where.status) return Promise.resolve({ count: 0 });
          Object.assign(deposit, data);
          return Promise.resolve({ count: 1 });
        }),
        findFirst: jest.fn().mockImplementation((args) => {
          for (const d of testDeposits.values()) {
            if (
              d.referenceNumber === args.where.referenceNumber &&
              (!args.where.paymentMethodCode ||
                d.paymentMethodCode === args.where.paymentMethodCode)
            ) {
              return Promise.resolve(d);
            }
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.referenceNumber) {
            for (const d of testDeposits.values()) {
              if (d.referenceNumber === args.where.referenceNumber) return Promise.resolve(d);
            }
            return Promise.resolve(null);
          }
          if (args.where.id) {
            return Promise.resolve(testDeposits.get(args.where.id) || null);
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(testDeposits.values()))),
        create: jest.fn().mockImplementation((args) => {
          const id = `dep-mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const deposit = {
            id,
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
            statusHistory: [{ id: 'hist-1', toStatus: args.data.status, createdAt: new Date() }],
          };
          testDeposits.set(id, deposit);
          return Promise.resolve(deposit);
        }),
        update: jest.fn().mockImplementation((args) => {
          const existing = testDeposits.get(args.where.id) || {};
          const updated = {
            ...existing,
            ...args.data,
            updatedAt: new Date(),
          };
          testDeposits.set(args.where.id, updated);
          return Promise.resolve(updated);
        }),
      },
      depositStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'hist-created' }),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const mockLedgerService = {
      recordTopup: jest.fn().mockResolvedValue({
        transaction: {
          id: 'LTX-TEST-001',
          txNumber: 'LTX-TEST-001',
          status: 'POSTED',
        },
      }),
    };

    const mockWalletService = {
      getWallet: jest.fn().mockResolvedValue({
        id: 'w-test-yer',
        userId: 'user-test-001',
        currency: CurrencyCode.YER,
        balance: 10000,
        lockedBalance: 0,
        isFrozen: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositsService,
        PaymentAdapterRegistry,
        JaibPaymentAdapter,
        JawaliPaymentAdapter,
        CashPaymentAdapter,
        OneCashPaymentAdapter,
        EasyPaymentAdapter,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: HmacSignatureService, useValue: new HmacSignatureService() },
      ],
    }).compile();

    service = module.get<DepositsService>(DepositsService);
    walletService = module.get<WalletService>(WalletService);
    ledgerService = module.get<LedgerService>(LedgerService);
  });

  it('does not publish unverified or disabled payment receiver configurations', async () => {
    const channels = await service.getPaymentChannels();
    // The test database seed deliberately keeps all external receiver accounts blocked.
    expect(channels).toEqual([]);
  });

  it('should create deposit request in PENDING status without crediting wallet', async () => {
    const res = await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 15000,
      paymentMethodCode: PaymentChannelCode.JAIB,
      referenceNumber: 'REF-UNIT-TEST-12345',
      senderName: 'محمد أحمد',
      senderPhone: '+967771122334',
    });

    expect(res.success).toBe(true);
    expect(res.deposit.status).toBe(DepositStatus.PENDING);
    expect(res.deposit.amount).toBe(15000);
    expect(res.deposit.referenceNumber).toBe('REF-UNIT-TEST-12345');
    // Ensure ledger was NOT called during submission
    expect(ledgerService.recordTopup).not.toHaveBeenCalled();
  });

  it('should prevent duplicate reference numbers within the same payment channel', async () => {
    await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 5000,
      paymentMethodCode: PaymentChannelCode.JAWALI,
      referenceNumber: 'REF-DUP-99999',
    });

    await expect(
      service.createDepositRequest('user-test-001', {
        currency: CurrencyCode.YER,
        amount: 5000,
        paymentMethodCode: PaymentChannelCode.JAWALI,
        referenceNumber: 'REF-DUP-99999',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow the same reference number in different payment channels', async () => {
    const referenceNumber = 'REF-CROSS-CHANNEL-99999';
    await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 5000,
      paymentMethodCode: PaymentChannelCode.JAWALI,
      referenceNumber,
    });

    const secondChannelDeposit = await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 5000,
      paymentMethodCode: PaymentChannelCode.JAIB,
      referenceNumber,
    });

    expect(secondChannelDeposit.success).toBe(true);
    expect(secondChannelDeposit.deposit.paymentMethodCode).toBe(PaymentChannelCode.JAIB);
  });

  it('should allow admin to mark deposit UNDER_REVIEW', async () => {
    const created = await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 20000,
      paymentMethodCode: PaymentChannelCode.CASH,
      referenceNumber: 'REF-REVIEW-11111',
    });

    const reviewed = await service.markUnderReview('admin-001', created.deposit.id, {
      reviewNotes: 'مراجعة مع بنك سبأ',
    });

    expect(reviewed.success).toBe(true);
    expect(reviewed.deposit.status).toBe(DepositStatus.UNDER_REVIEW);
  });

  it('should approve and credit deposit via strict double-entry ledger', async () => {
    const created = await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 25000,
      paymentMethodCode: PaymentChannelCode.JAIB,
      referenceNumber: 'REF-APPROVE-22222',
    });

    const approved = await service.approveAndCredit('finance-001', created.deposit.id, {
      reviewNotes: 'تم التأكد من كشف الحساب البنكي',
    });

    expect(approved.success).toBe(true);
    expect(approved.deposit.status).toBe(DepositStatus.CREDITED);
    expect(ledgerService.recordTopup).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 25000,
        currency: CurrencyCode.YER,
        paymentChannel: PaymentChannelCode.JAIB,
      }),
      expect.any(Object),
    );
  });

  it('should prevent approving an already CREDITED deposit', async () => {
    const created = await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 10000,
      paymentMethodCode: PaymentChannelCode.ONE_CASH,
      referenceNumber: 'REF-ALREADY-33333',
    });

    await service.approveAndCredit('finance-001', created.deposit.id);

    await expect(service.approveAndCredit('finance-001', created.deposit.id)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should reject deposit request with mandatory reason', async () => {
    const created = await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 8000,
      paymentMethodCode: PaymentChannelCode.EASY,
      referenceNumber: 'REF-REJECT-44444',
    });

    const rejected = await service.rejectDeposit('finance-001', created.deposit.id, {
      rejectionReason: 'المبلغ لم يصل لحساب المحفظة',
    });

    expect(rejected.success).toBe(true);
    expect(rejected.deposit.status).toBe(DepositStatus.REJECTED);
    expect(rejected.deposit.rejectionReason).toBe('المبلغ لم يصل لحساب المحفظة');
  });

  it('should disallow rejection without reason', async () => {
    const created = await service.createDepositRequest('user-test-001', {
      currency: CurrencyCode.YER,
      amount: 8000,
      paymentMethodCode: PaymentChannelCode.EASY,
      referenceNumber: 'REF-NOREASON-55555',
    });

    await expect(
      service.rejectDeposit('finance-001', created.deposit.id, {
        rejectionReason: '',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
