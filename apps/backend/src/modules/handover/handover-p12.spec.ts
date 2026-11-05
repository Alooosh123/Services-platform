import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HandoverService } from './handover.service';
import { PrismaService } from '../../database/prisma.service';
import { HandoverStatus, RunbookCategory } from '@digital-topup/shared';

describe('Phase 12: Operations Handover & Acceptance Drills', () => {
  let handoverService: HandoverService;

  const mockPrisma = {
    operationalDrillLog: {
      create: jest.fn().mockResolvedValue({ id: 'drill-log-01' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    operationsHandover: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoverService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    handoverService = module.get<HandoverService>(HandoverService);
  });

  describe('1. Operational KPIs & SLA Thresholds', () => {
    it('must not return invented live KPI values when metrics storage is not connected', async () => {
      await expect(handoverService.getOperationalKpis()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('2. Operational Runbooks (SOPs)', () => {
    it('should provide the 6 mandatory operational runbooks with Arabic action steps', async () => {
      const runbooks = await handoverService.getRunbooks();

      expect(runbooks.length).toBe(6);
      const categories = runbooks.map((r) => r.category);
      expect(categories).toContain(RunbookCategory.FINANCE_DEPOSIT_REJECT);
      expect(categories).toContain(RunbookCategory.FULFILLMENT_UNKNOWN);
      expect(categories).toContain(RunbookCategory.PROVIDER_OUTAGE);
      expect(categories).toContain(RunbookCategory.WRONG_PAYOUT);
      expect(categories).toContain(RunbookCategory.REFUND_DISPUTE);
      expect(categories).toContain(RunbookCategory.WORKER_LAG);

      // Verify each runbook has immediate actionable steps and escalation role
      for (const rb of runbooks) {
        expect(rb.immediateStepsAr.length).toBeGreaterThan(2);
        expect(rb.escalationRole).toBeDefined();
        expect(rb.targetSlaMinutes).toBeGreaterThan(0);
      }
    });
  });

  describe('3. P12 Acceptance Test 1: Support Simulation & Failed Order Tracking', () => {
    it('must not report support drills as passed without inspecting real tickets and orders', async () => {
      await expect(handoverService.executeOperationalDrill({
        drillType: 'SUPPORT_FAILED_ORDER_DIAGNOSIS',
        operatorName: 'support-agent-sara',
        simulatedTargetId: 'ORD-ERR-504-TEST',
      })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mockPrisma.operationalDrillLog.create).not.toHaveBeenCalled();
    });
  });

  describe('4. P12 Acceptance Test 2: New Staff Daily Close SOP Drill', () => {
    it('must not claim a daily close drill passed without a real close report', async () => {
      await expect(handoverService.executeOperationalDrill({
        drillType: 'NEW_STAFF_DAILY_CLOSE',
        operatorName: 'new-hire-finance-ahmed',
        simulatedTargetId: '2026-10-11',
      })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('5. P12 Acceptance Test 3: Historical Reconciliation Audit Drill', () => {
    it('must not claim a reconciliation audit passed without reading an actual batch', async () => {
      await expect(handoverService.executeOperationalDrill({
        drillType: 'HISTORICAL_RECONCILIATION_AUDIT',
        operatorName: 'auditor-khalid',
        simulatedTargetId: 'REC-BATCH-20261001-HIST',
      })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('6. Formal Handover Sign-Off Package', () => {
    it('must show handover as not accepted until durable signatures are recorded', async () => {
      const pkg = await handoverService.getHandoverSignOffPackage();

      expect(pkg.version).toContain('1.0.0');
      expect(pkg.status).toBe(HandoverStatus.TRANSFERRED);
      expect(pkg.checklistCompletedCount).toBe(0);
      expect(pkg.repositoriesDelivered.backendApi).toBeDefined();
      expect(pkg.repositoriesDelivered.webAdmin).toBeDefined();
      expect(pkg.repositoriesDelivered.webCustomer).toBeDefined();
      expect(pkg.repositoriesDelivered.docsAndRunbooks).toBeDefined();

      // Multi-signature verification
      expect(pkg.signOffs.technicalLead.signed).toBe(false);
      expect(pkg.signOffs.financeController.signed).toBe(false);
      expect(pkg.signOffs.supportLead.signed).toBe(false);
      expect(pkg.signOffs.operationsManager.signed).toBe(false);
      expect(pkg.signOffs.projectOwner.signed).toBe(false);
    });

    it('must not accept a handover signature that is only held in memory', async () => {
      await expect(handoverService.signHandoverPackage(
        {
          role: 'PROJECT_OWNER',
          signerName: 'مالك المنصة والمستثمر الرئيسي (Owner & Sponsor)',
          notes: 'تم استلام كافة الوحدات والتشغيل بنجاح تام وفق متطلبات المالك السبعة.',
        },
        'owner-user-01',
      )).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
