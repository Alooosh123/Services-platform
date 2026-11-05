import { Test, TestingModule } from '@nestjs/testing';
import { ProfitEngineService } from './profit-engine.service';
import { DailyCloseService } from './daily-close.service';
import { OwnerEarningsService } from './owner-earnings.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CurrencyCode,
  OrderStatus,
  DailyCloseStatus,
  OwnerPayoutStatus,
  BeneficiaryVerificationStatus,
  PaymentChannelCode,
} from '@digital-topup/shared';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('Phase 07 — Owner Earnings, Payouts, Liquidity & Daily Close Reports', () => {
  let profitEngine: ProfitEngineService;
  let dailyCloseService: DailyCloseService;
  let ownerEarningsService: OwnerEarningsService;
  let ledgerService: LedgerService;

  const mockPrismaService = {
    order: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    wallet: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 0 } }),
    },
    dailyCloseReport: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
    },
    dailyCloseAdjustment: {
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
    },
    payoutBeneficiary: {
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ownerPayoutTransaction: {
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
    },
  };

  const mockLedgerService = {
    recordDoubleEntryTransaction: jest.fn().mockResolvedValue({
      isDuplicate: false,
      transaction: { txNumber: 'LTX-DIST-TEST-001' },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfitEngineService,
        DailyCloseService,
        OwnerEarningsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    profitEngine = module.get<ProfitEngineService>(ProfitEngineService);
    dailyCloseService = module.get<DailyCloseService>(DailyCloseService);
    ownerEarningsService = module.get<OwnerEarningsService>(OwnerEarningsService);
    ledgerService = module.get<LedgerService>(LedgerService);

    // Reset memory state
    profitEngine.clearMemoryOrders();
    dailyCloseService.clearMemoryReports();
  });

  describe('AT-13 & AT-14: Profit Engine & Unfulfilled Orders Gating', () => {
    it('AT-14: counts unfulfilled orders toward Estimated Profit but NOT Realized Profit or Withdrawable Liquidity', async () => {
      // 1. Add Completed Order: 60 UC for 5,500 YER (Cost: 4,800 YER, Fee: 50 YER, Profit: 650 YER)
      profitEngine.addMemoryOrder({
        id: 'ord-test-comp-1',
        orderNumber: 'ORD-TEST-001',
        status: OrderStatus.Completed,
        currency: CurrencyCode.YER,
        retailPrice: 5500,
        costPrice: 4800,
        profit: 700,
        channelFee: 50,
        createdAt: new Date('2026-10-11T10:00:00Z'),
      });

      // 2. Add Pending / Processing Order: 325 UC for 28,000 YER (Cost: 24,000 YER, Estimated: 4,000 YER)
      profitEngine.addMemoryOrder({
        id: 'ord-test-proc-2',
        orderNumber: 'ORD-TEST-002',
        status: OrderStatus.Processing,
        currency: CurrencyCode.YER,
        retailPrice: 28000,
        costPrice: 24000,
        profit: 4000,
        channelFee: 0,
        createdAt: new Date('2026-10-11T11:00:00Z'),
      });

      // Set Cash and Liabilities
      profitEngine.setMemoryCashBalance(CurrencyCode.YER, 500000);
      profitEngine.setMemoryCustomerLiabilities(CurrencyCode.YER, 100000);

      // 3. Calculate metrics
      const metrics = await profitEngine.calculateMetricsForCurrency(
        CurrencyCode.YER,
        '2026-10-11',
      );

      // Completed Gross Sales & Realized Profit
      expect(metrics.completedOrdersCount).toBe(1);
      expect(metrics.grossSales).toBe(5500);
      expect(metrics.supplierCost).toBe(4800);
      expect(metrics.channelFees).toBe(50);
      expect(metrics.realizedProfit).toBe(650);

      // Pending count & Estimated Profit (AT-14)
      expect(metrics.pendingOrdersCount).toBe(1);
      expect(metrics.estimatedProfit).toBe(4000);

      // Verify that Withdrawable Liquidity does NOT include the 4,000 YER from the unfulfilled order!
      // Free cash = 500,000 - 100,000 - 50,000 (supplier payables) - 275 (operating reserve) = 349,725
      // Withdrawable is capped by realized profit (650 YER), NOT 650 + 4000!
      expect(metrics.withdrawableLiquidity).toBe(650);
    });

    it('AT-13: matches daily close metrics with ledger accounting principles across currencies', async () => {
      // Completed USD Order: Retail $10.00, Cost $8.50, Fee $0.10, Realized $1.40
      profitEngine.addMemoryOrder({
        id: 'ord-test-usd-1',
        orderNumber: 'ORD-USD-001',
        status: OrderStatus.Completed,
        currency: CurrencyCode.USD,
        retailPrice: 10.0,
        costPrice: 8.5,
        profit: 1.5,
        channelFee: 0.1,
        createdAt: new Date('2026-10-11T12:00:00Z'),
      });

      const metrics = await profitEngine.calculateMetricsForCurrency(CurrencyCode.USD, '2026-10-11');
      expect(metrics.grossSales).toBe(10.0);
      expect(metrics.supplierCost).toBe(8.5);
      expect(metrics.channelFees).toBe(0.1);
      expect(metrics.realizedProfit).toBe(1.4);
      expect(metrics.currency).toBe(CurrencyCode.USD);
    });
  });

  describe('AT-23: Daily Close Immutability & Adjustments Audit Trail', () => {
    it('AT-23: preserves baseline immutable snapshot and avoids duplicate execution or overwriting on re-run', async () => {
      const closeDate = '2026-10-10';

      // 1. Initial close of the business day
      const firstClose = await dailyCloseService.closeBusinessDay('admin-01', {
        closeDate,
        notes: 'الإغلاق اليومي النهائي لـ 10 أكتوبر 2026',
      });
      expect(firstClose.isNew).toBe(true);
      expect(firstClose.snapshot.status).toBe(DailyCloseStatus.CLOSED);
      expect(firstClose.snapshot.isImmutable).toBe(true);

      const originalClosedAt = firstClose.snapshot.closedAt;

      // 2. Re-running close for the same day (AT-23)
      const secondClose = await dailyCloseService.closeBusinessDay('admin-01', {
        closeDate,
        notes: 'محاولة إعادة الإغلاق مرة ثانية لنفس اليوم',
      });

      // Must be idempotent and NOT overwrite baseline snapshot
      expect(secondClose.isNew).toBe(false);
      expect(secondClose.snapshot.id).toBe(firstClose.snapshot.id);
      expect(secondClose.snapshot.closedAt).toEqual(originalClosedAt);
      expect(secondClose.message).toContain('تم إغلاق هذا اليوم مسبقاً');
    });

    it('AT-23: attaches adjustments to closed reports without modifying original baseline metrics', async () => {
      const closeDate = '2026-10-10';

      // 1. Ensure report is closed
      await dailyCloseService.closeBusinessDay('user-mgr-01', {
        closeDate,
        notes: 'إغلاق اليوم المراد تسويته',
      });

      // 2. Attach a reconciliation adjustment
      const adj = await dailyCloseService.addAdjustment(
        closeDate,
        {
          currency: CurrencyCode.YER,
          adjustmentType: 'RECONCILIATION_VARIANCE',
          amount: 500,
          reason: 'تسوية فارق عمولة بنكية تم اكتشافها في مطابقة اليوم التالي',
          ledgerTxId: 'LTX-ADJ-9988',
        },
        'finance-officer-01',
      );

      expect(adj.amount).toBe(500);
      expect(adj.currency).toBe(CurrencyCode.YER);

      // Verify report reflects the adjustment and updated status
      const report = await dailyCloseService.getExistingReport(closeDate);
      expect(report).toBeDefined();
      expect(report?.status).toBe(DailyCloseStatus.ADJUSTED);
      expect(report?.adjustments.length).toBeGreaterThanOrEqual(1);
      expect(report?.adjustments[0].reason).toContain('تسوية فارق عمولة');
    });
  });

  describe('AT-17 & AT-18: Owner Earnings Statement, MFA Payouts & Hold Release', () => {
    it('AT-17: prevents withdrawal when requested amount exceeds available withdrawable liquidity', async () => {
      // Available payout for USD in seed is $16.50
      const validTotp = ownerEarningsService.generateValidTotp();

      await expect(
        ownerEarningsService.requestOwnerPayout('user-owner-001', {
          beneficiaryId: 'ben-owner-001',
          currency: CurrencyCode.USD,
          amount: 50000, // Exceeds available
          totpCode: validTotp,
          idempotencyKey: 'IDEMP-FAIL-EXCEED-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('AT-17: rejects payout request when TOTP MFA code is invalid or missing', async () => {
      await expect(
        ownerEarningsService.requestOwnerPayout('user-owner-001', {
          beneficiaryId: 'ben-owner-001',
          currency: CurrencyCode.USD,
          amount: 10,
          totpCode: '000000', // Invalid TOTP
          idempotencyKey: 'IDEMP-FAIL-TOTP-001',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('AT-17: successfully requests owner payout with valid TOTP MFA, locks amount, approves, and confirms via ledger', async () => {
      const validTotp = ownerEarningsService.generateValidTotp();
      const initialStatement = await ownerEarningsService.getEarningsStatement(
        'user-owner-001',
        CurrencyCode.YER,
      );
      const initialLocked = initialStatement.lockedEarnings;

      // 1. Request payout of 20,000 YER with valid MFA
      const reqResult = await ownerEarningsService.requestOwnerPayout('user-owner-001', {
        beneficiaryId: 'ben-owner-001',
        currency: CurrencyCode.YER,
        amount: 20000,
        totpCode: validTotp,
        idempotencyKey: 'IDEMP-OWNER-PO-OK-01',
        notes: 'سحب أرباح دورية',
      });

      expect(reqResult.success).toBe(true);
      expect(reqResult.payout.status).toBe(OwnerPayoutStatus.REQUESTED);
      expect(reqResult.payout.amount).toBe(20000);

      // Verify hold was placed in lockedEarnings
      const afterReqStatement = await ownerEarningsService.getEarningsStatement(
        'user-owner-001',
        CurrencyCode.YER,
      );
      expect(afterReqStatement.lockedEarnings).toBe(initialLocked + 20000);

      // 2. Finance Officer approves payout (Four-Eyes Principle)
      const approved = await ownerEarningsService.approveOwnerPayout(
        reqResult.payout.id,
        { approved: true, financeNotes: 'تمت موافقة الإدارة المالية' },
        'finance-mgr-01',
      );
      expect(approved.status).toBe(OwnerPayoutStatus.APPROVED);

      // 3. Confirm external bank wire with transfer reference and record in ledger
      const confirmed = await ownerEarningsService.confirmExternalTransfer(
        reqResult.payout.id,
        'BANK-REF-99887711',
        'finance-mgr-01',
      );
      expect(confirmed.status).toBe(OwnerPayoutStatus.CONFIRMED);
      expect(confirmed.externalReference).toBe('BANK-REF-99887711');
      expect(mockLedgerService.recordDoubleEntryTransaction).toHaveBeenCalled();

      // Verify locked earnings released and added to withdrawn earnings
      const finalStatement = await ownerEarningsService.getEarningsStatement(
        'user-owner-001',
        CurrencyCode.YER,
      );
      expect(finalStatement.lockedEarnings).toBe(initialLocked);
      expect(finalStatement.withdrawnEarnings).toBeGreaterThanOrEqual(20000);
    });

    it('AT-18: enforces idempotency on owner payout requests (does not duplicate deduction)', async () => {
      const validTotp = ownerEarningsService.generateValidTotp();
      const idempotencyKey = 'IDEMP-PO-IDEMPOTENT-001';

      // First call
      const res1 = await ownerEarningsService.requestOwnerPayout('user-owner-001', {
        beneficiaryId: 'ben-owner-001',
        currency: CurrencyCode.YER,
        amount: 5000,
        totpCode: validTotp,
        idempotencyKey,
      });

      // Second call with same idempotency key (e.g. network retry)
      const res2 = await ownerEarningsService.requestOwnerPayout('user-owner-001', {
        beneficiaryId: 'ben-owner-001',
        currency: CurrencyCode.YER,
        amount: 5000,
        totpCode: validTotp,
        idempotencyKey,
      });

      // Must return the exact same payout without doubling the deduction
      expect(res2.payout.id).toBe(res1.payout.id);
      expect(res2.payout.payoutNumber).toBe(res1.payout.payoutNumber);
      expect(res2.message).toContain('Idempotent');
    });

    it('AT-18: releases hold on owner earnings atomically when payout fails or is rejected', async () => {
      const validTotp = ownerEarningsService.generateValidTotp();
      const initialStatement = await ownerEarningsService.getEarningsStatement(
        'user-owner-001',
        CurrencyCode.YER,
      );
      const initialLocked = initialStatement.lockedEarnings;

      // 1. Request payout of 15,000 YER
      const reqResult = await ownerEarningsService.requestOwnerPayout('user-owner-001', {
        beneficiaryId: 'ben-owner-001',
        currency: CurrencyCode.YER,
        amount: 15000,
        totpCode: validTotp,
        idempotencyKey: 'IDEMP-FAIL-HOLD-RELEASE-001',
      });
      expect(reqResult.payout.status).toBe(OwnerPayoutStatus.REQUESTED);

      // Verify locked
      const lockedStatement = await ownerEarningsService.getEarningsStatement(
        'user-owner-001',
        CurrencyCode.YER,
      );
      expect(lockedStatement.lockedEarnings).toBe(initialLocked + 15000);

      // 2. Payout fails (e.g. Bank gateway timeout / rejected)
      const failed = await ownerEarningsService.failPayout(
        reqResult.payout.id,
        'فشل التحويل من طرف بنك الكريمي (حساب غير نشط)',
      );
      expect(failed.status).toBe(OwnerPayoutStatus.FAILED);

      // 3. Verify hold is released back to available balance (AT-18 Hold Release)
      const finalStatement = await ownerEarningsService.getEarningsStatement(
        'user-owner-001',
        CurrencyCode.YER,
      );
      expect(finalStatement.lockedEarnings).toBe(initialLocked);
    });
  });
});
