import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsService } from './payouts.service';
import {
  PaymentAdapterRegistry,
  JaibPaymentAdapter,
  JawaliPaymentAdapter,
  CashPaymentAdapter,
  OneCashPaymentAdapter,
  EasyPaymentAdapter,
  SandboxPaymentAdapter,
} from '../deposits/adapters/yemen-payment.adapters';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  PayoutStatus,
} from '@digital-topup/shared';

describe('Phase 05 — AT-18: Outbound Payouts, Failure & Unknown Safety', () => {
  let payoutsService: PayoutsService;
  let adapterRegistry: PaymentAdapterRegistry;
  let ledgerService: LedgerService;

  const mockPrisma = {
    payoutRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLedgerService = {
    holdWalletBalance: jest.fn().mockResolvedValue({}),
    releaseWalletHold: jest.fn().mockResolvedValue({}),
    recordPayoutSettlement: jest.fn().mockResolvedValue({
      transaction: { id: 'LTX-PO-CONFIRMED-01', txNumber: 'LTX-PO-01', status: 'POSTED' },
    }),
  };

  const mockWalletService = {
    getWallet: jest.fn().mockResolvedValue({
      id: 'w-cust-yer',
      userId: 'user-customer-003',
      currency: CurrencyCode.YER,
      balance: 100000,
      lockedBalance: 0,
      isFrozen: false,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        PaymentAdapterRegistry,
        JaibPaymentAdapter,
        JawaliPaymentAdapter,
        CashPaymentAdapter,
        OneCashPaymentAdapter,
        EasyPaymentAdapter,
        SandboxPaymentAdapter,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    payoutsService = module.get<PayoutsService>(PayoutsService);
    adapterRegistry = module.get<PaymentAdapterRegistry>(PaymentAdapterRegistry);
    ledgerService = module.get<LedgerService>(LedgerService);
    // Explicitly simulate a manually verified receiver for this unit-test fixture only.
    // The runtime default remains disabled until a real beneficiary account is approved in MySQL.
    const jaib = adapterRegistry.getAdapter(PaymentChannelCode.JAIB)!;
    const jaibInfo = jaib.getInfo();
    jest.spyOn(jaib, 'getInfo').mockReturnValue({
      ...jaibInfo,
      accountNumber: '770123456',
      isActive: true,
      isVerifiedLegal: true,
    });
  });

  describe('AT-18: Outbound Payout Idempotency', () => {
    it('idempotencyKey prevents duplicate payout creation', async () => {
      const payload = {
        currency: CurrencyCode.YER,
        amount: 25000,
        channelCode: PaymentChannelCode.JAIB,
        destinationAccount: '770123456',
        beneficiaryName: 'أحمد محمد الحاشدي',
        idempotencyKey: 'IDEMP-PO-KEY-101',
      };

      const res1 = await payoutsService.createPayoutRequest('user-customer-003', payload);
      expect(res1.success).toBe(true);
      expect(res1.payout.payoutNumber).toBeDefined();

      // Submit identical request with same key
      const res2 = await payoutsService.createPayoutRequest('user-customer-003', payload);
      expect(res2.success).toBe(true);
      expect(res2.payout.id).toBe(res1.payout.id); // Exactly same record returned!
      expect(mockLedgerService.holdWalletBalance).toHaveBeenCalledTimes(1); // Held only once!
    });
  });

  describe('AT-18 / P05: BLOCKED_EXTERNAL for Yemeni Bank Channels', () => {
    it('safely marks outbound auto-payout as BLOCKED_EXTERNAL for channels without automated B2B API', async () => {
      const req = await payoutsService.createPayoutRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 15000,
        channelCode: PaymentChannelCode.JAIB,
        destinationAccount: '770123456',
        beneficiaryName: 'أحمد محمد الحاشدي',
        idempotencyKey: 'IDEMP-PO-BLOCKED-01',
      });

      await payoutsService.approvePayout('user-finance-002', req.payout.id);

      const dispatchResult = await payoutsService.dispatchPayout('user-finance-003', req.payout.id);

      expect(dispatchResult.success).toBe(false);
      expect(dispatchResult.message).toContain('BLOCKED_EXTERNAL');
      expect(dispatchResult.message).toContain('التحويل الآلي المباشر عبر JAIB محجوب خارجياً');
    });

    it('allows finance officer to confirm manual bank transfer with official bank slip (Manual SOP)', async () => {
      const req = await payoutsService.createPayoutRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 15000,
        channelCode: PaymentChannelCode.JAIB,
        destinationAccount: '770123456',
        beneficiaryName: 'أحمد محمد الحاشدي',
        idempotencyKey: 'IDEMP-PO-MANUAL-01',
      });

      await payoutsService.approvePayout('user-finance-002', req.payout.id);
      const confirmResult = await payoutsService.confirmManualPayout(
        'user-finance-003',
        req.payout.id,
        'CAC-SLIP-776655',
        'تم التحويل اليدوي ومطابقة إشعار البنك',
      );

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.payout.status).toBe(PayoutStatus.CONFIRMED);
      expect(confirmResult.payout.externalReference).toBe('CAC-SLIP-776655');
      expect(mockLedgerService.recordPayoutSettlement).toHaveBeenCalledTimes(1);
    });
  });

  it('blocks the built-in Sandbox wallet channel in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(payoutsService.createPayoutRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 5000,
        channelCode: PaymentChannelCode.WALLET,
        destinationAccount: 'SANDBOX-ACC-01',
        beneficiaryName: 'Test',
        idempotencyKey: 'IDEMP-PO-PROD-SANDBOX-001',
      })).rejects.toThrow('Sandbox/Wallet');
      expect(mockLedgerService.holdWalletBalance).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  describe('AT-18: Outbound Failure & UNKNOWN Safety', () => {
    it('AT-18: Payout failure releases locked hold immediately without double debit', async () => {
      const adapter = adapterRegistry.getAdapter(PaymentChannelCode.WALLET)!;
      jest.spyOn(adapter, 'payout').mockResolvedValueOnce({
        success: false,
        status: 'FAILED',
        message: 'Rejected by partner bank',
      });

      const req = await payoutsService.createPayoutRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 50000,
        channelCode: PaymentChannelCode.WALLET,
        destinationAccount: 'SANDBOX-ACC-01',
        beneficiaryName: 'أحمد محمد الحاشدي',
        idempotencyKey: 'IDEMP-PO-FAIL-01',
      });

      await payoutsService.approvePayout('user-finance-002', req.payout.id);

      const dispatchResult = await payoutsService.dispatchPayout('user-finance-003', req.payout.id);

      expect(dispatchResult.status).toBe(PayoutStatus.FAILED);
      expect(mockLedgerService.releaseWalletHold).toHaveBeenCalledWith(
        'w-cust-yer',
        50000,
      );
    });

    it('AT-18: On timeout or network exception, status transitions to UNKNOWN and retries are suspended (no double debit, no blind refund)', async () => {
      const req = await payoutsService.createPayoutRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 50000,
        channelCode: PaymentChannelCode.WALLET,
        destinationAccount: 'SANDBOX-ACC-01',
        beneficiaryName: 'أحمد محمد الحاشدي',
        idempotencyKey: 'IDEMP-PO-UNKNOWN-01',
      });

      await payoutsService.approvePayout('user-finance-002', req.payout.id);

      // Simulate adapter network exception / timeout
      const adapter = adapterRegistry.getAdapter(PaymentChannelCode.WALLET)!;
      jest.spyOn(adapter, 'payout').mockRejectedValueOnce(new Error('Gateway Timeout / Socket Hangup'));

      const dispatchResult = await payoutsService.dispatchPayout('user-finance-003', req.payout.id);

      expect(dispatchResult.status).toBe(PayoutStatus.UNKNOWN);
      expect(dispatchResult.message).toContain('حالة التحويل غير مؤكدة لدى المزود');
      expect(dispatchResult.message).toContain('AT-18');

      // Crucial AT-18 checks:
      // 1. Release wallet hold was NOT called (funds remain locked pending reconciliation)
      expect(mockLedgerService.releaseWalletHold).not.toHaveBeenCalled();
      // 2. Settlement was NOT called (funds not marked credited to bank)
      expect(mockLedgerService.recordPayoutSettlement).not.toHaveBeenCalled();
      await expect(payoutsService.rejectPayout('user-finance-004', req.payout.id, 'رفض بعد حالة غير مؤكدة'))
        .rejects.toThrow('بدأ تنفيذه أو أصبحت نتيجته غير مؤكدة');
      expect(mockLedgerService.releaseWalletHold).not.toHaveBeenCalled();
    });
    it('keeps a manually transferred payout UNKNOWN when double-entry posting fails', async () => {
      const req = await payoutsService.createPayoutRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 15000,
        channelCode: PaymentChannelCode.JAIB,
        destinationAccount: '770123456',
        beneficiaryName: 'أحمد محمد الحاشدي',
        idempotencyKey: 'IDEMP-PO-MANUAL-LEDGER-FAIL',
      });
      await payoutsService.approvePayout('user-finance-002', req.payout.id);
      mockLedgerService.recordPayoutSettlement.mockRejectedValueOnce(new Error('ledger DB unavailable'));

      const result = await payoutsService.confirmManualPayout(
        'user-finance-003',
        req.payout.id,
        'CAC-SLIP-FAIL-001',
        'تم إرسال التحويل لكن تعذر حفظ القيد.',
      );

      expect(result.success).toBe(false);
      expect(result.payout.status).toBe(PayoutStatus.UNKNOWN);
      expect(result.payout.ledgerTxId).toBeUndefined();
      expect(mockLedgerService.releaseWalletHold).not.toHaveBeenCalled();
    });

  });
});
