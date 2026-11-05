import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { BackupService } from './backup.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisIdempotencyStore } from '../../security/redis-idempotency.store';
import {
  HealthStatus,
  SystemAlertSeverity,
  SystemAlertType,
} from '@digital-topup/shared';

describe('Monitoring & Production Readiness (Phase 10 — AT-20, Health, Metrics & Alerts)', () => {
  let monitoringService: MonitoringService;
  let backupService: BackupService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    order: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    depositRequest: {
      count: jest.fn(),
    },
    payoutRequest: {
      count: jest.fn(),
    },
    systemAlert: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    backupRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    reconciliationBatch: {
      findFirst: jest.fn(),
    },
  };
  const mockRedis = {
    ping: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.ping.mockResolvedValue(1);
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.reconciliationBatch.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        BackupService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisIdempotencyStore, useValue: mockRedis },
      ],
    }).compile();

    monitoringService = module.get<MonitoringService>(MonitoringService);
    backupService = module.get<BackupService>(BackupService);
  });

  describe('Health Probes & Telemetry', () => {
    it('should report HEALTHY system status when database and queue are normal', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0 }]); // no locks
      mockPrisma.order.count.mockResolvedValueOnce(0); // 0 queued

      const health = await monitoringService.getSystemHealth();

      expect(health.status).toBe(HealthStatus.HEALTHY);
      expect(health.services.database.status).toBe(HealthStatus.HEALTHY);
      expect(health.services.redis.status).toBe(HealthStatus.HEALTHY);
      expect(health.services.queue.pendingJobs).toBe(0);
    });

    it('should fail readiness when Redis is unavailable', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValueOnce(new Error('Redis offline'));

      const readiness = await monitoringService.getReadiness();
      expect(readiness.ready).toBe(false);

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0 }]);
      mockPrisma.order.count.mockResolvedValueOnce(0);
      mockRedis.ping.mockRejectedValueOnce(new Error('Redis offline'));
      const health = await monitoringService.getSystemHealth();
      expect(health.status).toBe(HealthStatus.UNHEALTHY);
      expect(health.services.redis.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should report DEGRADED status when queue lag or DB locks are high', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 8 }]); // 8 locks!
      mockPrisma.order.count.mockResolvedValueOnce(600); // high queue lag

      const health = await monitoringService.getSystemHealth();

      expect(health.status).toBe(HealthStatus.DEGRADED);
      expect(health.services.queue.status).toBe(HealthStatus.DEGRADED);
    });

    it('should track HTTP request telemetry, error rates, and calculate latencies', async () => {
      monitoringService.recordHttpRequest(200, 45);
      monitoringService.recordHttpRequest(201, 55);
      monitoringService.recordHttpRequest(400, 30);
      monitoringService.recordHttpRequest(500, 120);

      mockPrisma.depositRequest.count.mockResolvedValueOnce(1);
      mockPrisma.order.count.mockResolvedValueOnce(2);
      mockPrisma.payoutRequest.count.mockResolvedValueOnce(0);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // no unbalanced tx
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ lagSeconds: 30 }])
        .mockResolvedValueOnce([{ currency: 'USD', variance: 4.25 }]);
      mockPrisma.reconciliationBatch.findFirst.mockResolvedValueOnce({
        createdAt: new Date('2026-10-27T23:00:00Z'),
      });
      mockPrisma.systemAlert.count.mockResolvedValueOnce(0);

      const metrics = await monitoringService.getTelemetryMetrics();

      expect(metrics.http.totalRequests).toBeGreaterThanOrEqual(4);
      expect(metrics.http.success2xx).toBeGreaterThanOrEqual(2);
      expect(metrics.http.serverErrors5xx).toBeGreaterThanOrEqual(1);
      expect(metrics.http.p50LatencyMs).toBeGreaterThan(0);
      expect(metrics.operations.depositMismatchesCount).toBe(1);
      expect(metrics.operations.unknownProviderOrdersCount).toBe(2);
      expect(metrics.operations.activeDbLocks).toBe(2);
      expect(metrics.operations.queueLagSeconds).toBe(30);
      expect(metrics.reconciliation.dailyVarianceUSD).toBe(4.25);
      expect(metrics.reconciliation.lastReconciledAt).toBe('2026-10-27T23:00:00.000Z');
    });

    it('should format metrics in standard Prometheus exposition format', async () => {
      mockPrisma.depositRequest.count.mockResolvedValueOnce(0);
      mockPrisma.order.count.mockResolvedValueOnce(0);
      mockPrisma.payoutRequest.count.mockResolvedValueOnce(0);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ lagSeconds: null }])
        .mockResolvedValueOnce([]);
      mockPrisma.systemAlert.count.mockResolvedValueOnce(1);

      const prometheus = await monitoringService.getPrometheusMetrics();

      expect(prometheus).toContain('# HELP http_requests_total');
      expect(prometheus).toContain('http_requests_total{status="2xx"}');
      expect(prometheus).toContain('financial_unbalanced_ledger_tx_total');
      expect(prometheus).toContain('operations_unknown_provider_orders_total');
    });
  });

  describe('Daily Finance Reconciliation Alert Engine', () => {
    it('should trigger CRITICAL alert when unbalanced ledger transactions exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { transactionId: 'tx-err-101', diff: 50.0 },
      ]);
      mockPrisma.depositRequest.count.mockResolvedValueOnce(0);
      mockPrisma.order.count.mockResolvedValueOnce(0);
      mockPrisma.payoutRequest.count.mockResolvedValueOnce(0);

      mockPrisma.systemAlert.create.mockResolvedValueOnce({
        id: 'alt-1',
        alertType: SystemAlertType.RECONCILIATION_VARIANCE,
        severity: SystemAlertSeverity.CRITICAL,
        title: 'اختلال توازن دفتر الأستاذ العام',
        message: 'تم اكتشاف 1 قيد محاسبي غير متوازن',
        source: 'DAILY_RECONCILIATION_ENGINE',
        escalationLevel: 'GENERAL_MANAGER',
        isResolved: false,
        createdAt: new Date(),
      });

      const result = await monitoringService.runDailyReconciliationCheck();

      expect(result.status).toBe('ISSUES_DETECTED');
      expect(result.alertsCreated).toBe(1);
      expect(mockPrisma.systemAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: SystemAlertType.RECONCILIATION_VARIANCE,
            severity: SystemAlertSeverity.CRITICAL,
            escalationLevel: 'GENERAL_MANAGER',
          }),
        }),
      );
    });

    it('should trigger WARNING alert for deposit mismatches and failed payouts', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // no unbalanced tx
      mockPrisma.depositRequest.count.mockResolvedValueOnce(3); // 3 mismatches
      mockPrisma.order.count.mockResolvedValueOnce(0);
      mockPrisma.payoutRequest.count.mockResolvedValueOnce(2); // 2 failed payouts

      mockPrisma.systemAlert.create.mockResolvedValue({
        id: 'alt-2',
        alertType: SystemAlertType.DEPOSIT_MISMATCH,
        severity: SystemAlertSeverity.WARNING,
        title: 'فروقات إيداعات',
        message: 'تفاصيل',
        source: 'DAILY_RECONCILIATION_ENGINE',
        escalationLevel: 'FINANCE_MANAGER',
        isResolved: false,
        createdAt: new Date(),
      });

      const result = await monitoringService.runDailyReconciliationCheck();

      expect(result.status).toBe('ISSUES_DETECTED');
      expect(result.alertsCreated).toBe(2);
    });
  });

  describe('AT-20 Acceptance Test & Disaster Recovery Drill', () => {
    it('must not report a restore drill as successful when no isolated restore ran', async () => {
      await expect(
        backupService.runDisasterRecoveryDrill({ environment: 'staging' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mockPrisma.backupRecord.create).not.toHaveBeenCalled();
    });

    it('should reject manually submitted records that cannot prove a backup artifact exists', async () => {
      await expect(
        backupService.createBackupRecord({
          fileName: 'unverified.dump',
          sizeBytes: 1,
          checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mockPrisma.backupRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('Provider Outage Simulation & Safe Failover', () => {
    it('should engage safe hold mode when provider outage drill is triggered', async () => {
      mockPrisma.systemAlert.create.mockResolvedValueOnce({
        id: 'alt-drill-1',
        alertType: SystemAlertType.GATEWAY_OUTAGE,
        severity: SystemAlertSeverity.CRITICAL,
        title: 'انقطاع محاكى',
        message: 'تحول للوضع الآمن',
        source: 'OUTAGE_SIMULATION_DRILL',
        escalationLevel: 'DUTY_ENGINEER',
        isResolved: false,
        createdAt: new Date(),
      });

      const drill = await monitoringService.simulateOutage({
        serviceTarget: 'PAYMENT_GATEWAY',
        simulationMode: 'SAFE_FAILOVER',
      });

      expect(drill.safeModeEngaged).toBe(true);
      expect(drill.failoverStatus).toBe('BLOCKED_EXTERNAL_SAFE_HOLD');
      expect(drill.financialSafetyGuaranteed).toBe(true);
    });
  });
});
