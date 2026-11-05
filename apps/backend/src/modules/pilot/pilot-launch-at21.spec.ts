import { Test, TestingModule } from '@nestjs/testing';
import { PilotService } from './pilot.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  PilotCohortType,
  PilotDecisionGateStatus,
} from '@digital-topup/shared';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('Phase 11: Pilot Rollout & AT-21 Acceptance Tests', () => {
  let pilotService: PilotService;

  const mockPrisma = {
    pilotConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    pilotRunAudit: {
      create: jest.fn().mockResolvedValue({ id: 'audit-001' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ledgerTransaction: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PilotService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    pilotService = module.get<PilotService>(PilotService);
  });

  describe('1. Pilot Configuration & Safety Limits', () => {
    it('should initialize with secure default pilot parameters', async () => {
      const config = await pilotService.getPilotConfig();
      expect(config.isPilotActive).toBe(true);
      expect(config.maxOrderAmountYER).toBe(10000);
      expect(config.maxOrderAmountUSD).toBe(20);
      expect(config.cohortType).toBe(PilotCohortType.TRUSTED_BETA_USERS);
      expect(config.whitelistedUserIds).toHaveLength(0);
      expect(config.allowedChannelCodes).toContain(PaymentChannelCode.JAIB);
    });

    it('should allow authorized admin to update pilot parameters', async () => {
      const updated = await pilotService.updatePilotConfig(
        {
          maxOrderAmountYER: 15000,
          maxOrderAmountUSD: 30,
          launchNotes: 'رفع سقف المعاملات التجريبية للمجموعة الثانية',
        },
        'admin-01',
      );

      expect(updated.maxOrderAmountYER).toBe(15000);
      expect(updated.maxOrderAmountUSD).toBe(30);
      expect(updated.launchNotes).toContain('رفع سقف المعاملات');
    });
  });

  describe('2. Pilot Order Restrictions & Cohort Enforcement', () => {
    it('should block non-whitelisted users when cohort is restricted', async () => {
      await expect(
        pilotService.validateOrderAgainstPilot(
          'stranger-user-999',
          5000,
          CurrencyCode.YER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow whitelisted pilot users within transaction caps', async () => {
      await pilotService.updatePilotConfig(
        { whitelistedUserIds: 'user-pilot-01' },
        'admin-01',
      );
      const result = await pilotService.validateOrderAgainstPilot(
        'user-pilot-01',
        5000,
        CurrencyCode.YER,
      );
      expect(result.allowed).toBe(true);
    });

    it('should reject orders exceeding the Pilot YER cap', async () => {
      await pilotService.updatePilotConfig(
        { whitelistedUserIds: 'user-pilot-01', maxOrderAmountYER: 15000 },
        'admin-01',
      );
      await expect(
        pilotService.validateOrderAgainstPilot(
          'user-pilot-01',
          50000, // exceeds 15,000 cap
          CurrencyCode.YER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject orders exceeding the Pilot USD cap', async () => {
      await pilotService.updatePilotConfig(
        { whitelistedUserIds: 'user-pilot-01', maxOrderAmountUSD: 30 },
        'admin-01',
      );
      await expect(
        pilotService.validateOrderAgainstPilot(
          'user-pilot-01',
          100, // exceeds $30 cap
          CurrencyCode.USD,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject disallowed payment channels during pilot', async () => {
      await pilotService.updatePilotConfig(
        { whitelistedUserIds: 'user-pilot-01' },
        'admin-01',
      );
      await expect(
        pilotService.validateOrderAgainstPilot(
          'user-pilot-01',
          1000,
          CurrencyCode.YER,
          'prod-1',
          PaymentChannelCode.CASH, // Cash not in allowed list
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('must prevent removing pilot limits before release gates are verified', async () => {
      await expect(
        pilotService.updatePilotConfig({ isPilotActive: false }, 'admin-01'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. AT-21 Acceptance Test: Full End-to-End Pilot Cycle', () => {
    it('must not report AT-21 as passed without executing real transactions', async () => {
      await expect(
        pilotService.runPilotVerificationCycle({
          currency: CurrencyCode.YER,
          amount: 5000,
          channelCode: PaymentChannelCode.JAIB,
          cycleName: 'AT-21-AUTOMATED-ACCEPTANCE-RUN',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mockPrisma.pilotRunAudit.create).not.toHaveBeenCalled();
    });

    it('must not expose fabricated history as verified pilot evidence', async () => {
      await expect(pilotService.getPilotHistory()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('4. Go/No-Go Decision Gate Verification', () => {
    it('should assess system against all release gates', async () => {
      const assessment = await pilotService.assessGoNoGo();

      expect(assessment.version).toContain('1.0.0');
      expect(assessment.gateChecks.doubleEntryLedgerBalanced).toBe(false);
      expect(assessment.gateChecks.reconciliationZeroMismatch).toBe(false);
      expect(assessment.gateChecks.emergencyKillSwitchReady).toBe(false);
      expect(assessment.gateChecks.disasterRecoveryVerified).toBe(false);
      expect(assessment.gateChecks.at21PilotCyclePassed).toBe(false);
      expect(assessment.decision).toBe(PilotDecisionGateStatus.NO_GO);
      expect(assessment.blockers.length).toBeGreaterThan(0);
    });

    it('must block GO signatures while release gates are unresolved', async () => {
      await expect(pilotService.signGoNoGo(
        {
          role: 'GENERAL_MANAGER',
          signerName: 'أ. عبد الله الحكيمي (General Manager)',
          decision: PilotDecisionGateStatus.GO,
          notes: 'تمت مراجعة نتائج دورة AT-21 واكتمال المطابقة البنكية 100%. معتمد للإطلاق.',
        },
        'gm-user-01',
      )).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
