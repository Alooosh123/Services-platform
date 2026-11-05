import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { DepositsService } from '../deposits/deposits.service';
import { PayoutsService } from '../payouts/payouts.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  ReconciliationStatus,
  DiscrepancyType,
} from '@digital-topup/shared';

describe('Phase 05 — AT-21: Daily Reconciliation Batch Engine & Exceptions', () => {
  let reconciliationService: ReconciliationService;
  let depositsService: DepositsService;
  let payoutsService: PayoutsService;

  const mockPrisma = {
    reconciliationBatch: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockLedgerService = {};

  const mockDepositsService = {
    findDepositByReference: jest.fn(),
  };

  const mockPayoutsService = {
    findByIdempotencyKey: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: DepositsService, useValue: mockDepositsService },
        { provide: PayoutsService, useValue: mockPayoutsService },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
    depositsService = module.get<DepositsService>(DepositsService);
    payoutsService = module.get<PayoutsService>(PayoutsService);
  });

  describe('AT-21: 3-Way Reconciliation Batch Execution', () => {
    it('AT-21: executes 3-way matching, classifies MATCHED, AMOUNT_MISMATCH, and MISSING_IN_INTERNAL', async () => {
      // 1. Mock matched deposit
      mockDepositsService.findDepositByReference.mockImplementation((ref: string) => {
        if (ref === 'REF-MATCHED-01') {
          return Promise.resolve({
            id: 'dep-1',
            depositNumber: 'DEP-20261010-001',
            amount: 50000,
            currency: CurrencyCode.YER,
            status: 'CREDITED',
          });
        }
        if (ref === 'REF-MISMATCH-01') {
          return Promise.resolve({
            id: 'dep-2',
            depositNumber: 'DEP-20261010-002',
            amount: 70000, // Expected 70,000, but statement has 65,000!
            currency: CurrencyCode.YER,
            status: 'UNDER_REVIEW',
          });
        }
        return Promise.resolve(null);
      });

      // 2. Mock matched payout
      mockPayoutsService.findByIdempotencyKey.mockImplementation((key: string) => {
        if (key === 'PO-KEY-MATCHED-01') {
          return Promise.resolve({
            id: 'po-1',
            payoutNumber: 'PO-20261010-001',
            amount: 15000,
            currency: CurrencyCode.YER,
            status: 'CONFIRMED',
          });
        }
        return Promise.resolve(null);
      });

      // Run daily reconciliation batch with statement lines
      const summary = await reconciliationService.runDailyReconciliation('user-finance-002', {
        channelCode: PaymentChannelCode.JAIB,
        statementDate: '2026-10-10',
        externalStatements: [
          {
            referenceNumber: 'REF-MATCHED-01',
            amount: 50000,
            currency: CurrencyCode.YER,
            type: 'DEPOSIT',
          },
          {
            referenceNumber: 'REF-MISMATCH-01',
            amount: 65000, // Difference: 5,000 YER
            currency: CurrencyCode.YER,
            type: 'DEPOSIT',
          },
          {
            referenceNumber: 'PO-KEY-MATCHED-01',
            amount: 15000,
            currency: CurrencyCode.YER,
            type: 'PAYOUT',
          },
          {
            referenceNumber: 'REF-UNKNOWN-EXTERNAL-99',
            amount: 30000, // Not in platform!
            currency: CurrencyCode.YER,
            type: 'DEPOSIT',
          },
        ],
      });

      expect(summary.totalRecords).toBe(4);
      expect(summary.matchedCount).toBe(2); // 1 deposit + 1 payout
      expect(summary.discrepancyCount).toBe(2); // 1 amount mismatch + 1 unknown external
      expect(summary.totalAmountMatched).toBe(65000); // 50000 + 15000
      expect(summary.totalAmountDiscrepant).toBe(95000); // 65000 + 30000

      // Check discrepancy items
      const amountMismatchItem = summary.discrepancies.find((d) => d.referenceNumber === 'REF-MISMATCH-01');
      expect(amountMismatchItem).toBeDefined();
      expect(amountMismatchItem?.type).toBe(DiscrepancyType.AMOUNT_MISMATCH);
      expect(amountMismatchItem?.expectedAmount).toBe(70000);
      expect(amountMismatchItem?.actualAmount).toBe(65000);

      const unknownItem = summary.discrepancies.find((d) => d.referenceNumber === 'REF-UNKNOWN-EXTERNAL-99');
      expect(unknownItem).toBeDefined();
      expect(unknownItem?.type).toBe(DiscrepancyType.MISSING_IN_INTERNAL);
      expect(unknownItem?.status).toBe(ReconciliationStatus.UNKNOWN_EXTERNAL);
    });

    it('allows finance manager to manually resolve an exception item and update batch status', async () => {
      // Get the default seeded batch
      const batches = await reconciliationService.listBatches();
      expect(batches.length).toBeGreaterThan(0);

      const seedBatch = batches[0];
      const discrepancyItem = seedBatch.items.find((i) => i.status === ReconciliationStatus.DISCREPANCY);
      expect(discrepancyItem).toBeDefined();

      const resolveRes = await reconciliationService.resolveDiscrepancy(
        'user-finance-002',
        discrepancyItem!.id,
        'تم التواصل مع البنك وتأكيد قيد فارق العمولة 500 ريال',
        'ADJUST_LEDGER',
      );

      expect(resolveRes.success).toBe(true);

      const updatedBatch = await reconciliationService.getBatchById(seedBatch.id);
      const updatedItem = updatedBatch.items.find((i) => i.id === discrepancyItem!.id);
      expect(updatedItem?.status).toBe(ReconciliationStatus.RESOLVED_MANUAL);
      expect(updatedBatch.status).toBe('RESOLVED');
    });
  });
});
