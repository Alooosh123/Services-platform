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
import { ForbiddenException } from '@nestjs/common';
import { EncryptionService } from '../../security/encryption.service';

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
    supplierAccount: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 0, creditLimit: 0 } }),
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
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    payoutBeneficiary: {
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ownerPayoutTransaction: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ownerEarningsWallet: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ledgerAccount: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    ledgerTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-test' }),
    },
    $transaction: jest.fn(async (callback: any) => callback(mockPrismaService)),
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
        { provide: EncryptionService, useValue: {
          encrypt: jest.fn((value: string) => 'v1:' + value),
          decrypt: jest.fn((value: string) => value.replace(/^v1:/, '')),
        } },
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

  describe('Owner payout production security gates', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.ownerPayoutTransaction.findUnique.mockResolvedValue(null);
    });

    it('requires a database owner identity and real MFA before creating a payout', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'owner-db-id', role: 'OWNER' })
        .mockResolvedValueOnce({ isTwoFactorEnabled: false, twoFactorSecret: null });

      await expect(
        ownerEarningsService.requestOwnerPayout('owner-db-id', {
          beneficiaryId: 'not-a-real-beneficiary',
          currency: CurrencyCode.YER,
          amount: 1000,
          totpCode: '123456',
          idempotencyKey: 'OWNER-MFA-REQUIRED-TEST',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.ownerPayoutTransaction.create).not.toHaveBeenCalled();
    });

    it('does not accept a hard-coded six-digit code when TOTP is enabled but the code is invalid', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'owner-db-id', role: 'OWNER' })
        .mockResolvedValueOnce({
          isTwoFactorEnabled: true,
          twoFactorSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        });

      await expect(
        ownerEarningsService.requestOwnerPayout('owner-db-id', {
          beneficiaryId: 'not-a-real-beneficiary',
          currency: CurrencyCode.YER,
          amount: 1000,
          totpCode: '123456',
          idempotencyKey: 'OWNER-MFA-INVALID-TEST',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.ownerPayoutTransaction.create).not.toHaveBeenCalled();
    });
  });
});
