import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProfitEngineService } from './profit-engine.service';
import { LedgerService } from '../ledger/ledger.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import {
  DailyCloseStatus,
  CurrencyCode,
  CreateDailyCloseDto,
  DailyCloseSnapshot,
  DailyCloseAdjustmentDto,
} from '@digital-topup/shared';

export interface InMemoryDailyCloseRecord {
  id: string;
  closeDate: string; // YYYY-MM-DD
  status: DailyCloseStatus;
  metricsByCurrency: Record<CurrencyCode, any>;
  isImmutable: boolean;
  closedByUserId?: string;
  notes?: string;
  closedAt: Date;
  updatedAt: Date;
  adjustments: DailyCloseAdjustmentDto[];
}

@Injectable()
export class DailyCloseService {
  private readonly logger = new Logger(DailyCloseService.name);
  private memoryReports: Map<string, InMemoryDailyCloseRecord> = new Map();

  private memoryKey(closeDate: string): string {
    return `${getCurrentTenantId() || 'platform'}:${closeDate}`;
  }

  private assertDurableDailyClose(error: any): void {
    if (process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
      this.logger.error(`Tenant daily-close persistence failed: ${error?.message || error}`);
      throw new ServiceUnavailableException('Daily close data is unavailable from the tenant database.');
    }
  }

  constructor(
    private prisma: PrismaService,
    private profitEngine: ProfitEngineService,
    private ledgerService: LedgerService,
  ) {
    this.seedDefaultCloseReports();
  }

  clearMemoryReports() {
    this.memoryReports.clear();
  }

  private seedDefaultCloseReports() {
    const defaultDate = '2026-10-01';
    const rep: InMemoryDailyCloseRecord = {
      id: `dclose-${defaultDate}`,
      closeDate: defaultDate,
      status: DailyCloseStatus.CLOSED,
      metricsByCurrency: {
        [CurrencyCode.YER]: {
          currency: CurrencyCode.YER,
          totalOrdersCount: 45,
          completedOrdersCount: 42,
          failedOrdersCount: 3,
          pendingOrdersCount: 0,
          grossSales: 245000,
          supplierCost: 215000,
          channelFees: 2450,
          estimatedProfit: 0,
          realizedProfit: 27550,
          totalDepositsAmount: 300000,
          totalPayoutsAmount: 0,
          customerWalletLiabilities: 120000,
          supplierPayables: 20000,
          operatingReserve: 12250,
          actualCashBalance: 300000,
          withdrawableLiquidity: 27550,
        },
        [CurrencyCode.USD]: {
          currency: CurrencyCode.USD,
          totalOrdersCount: 12,
          completedOrdersCount: 12,
          failedOrdersCount: 0,
          pendingOrdersCount: 0,
          grossSales: 150.0,
          supplierCost: 132.0,
          channelFees: 1.5,
          estimatedProfit: 0,
          realizedProfit: 16.5,
          totalDepositsAmount: 500,
          totalPayoutsAmount: 0,
          customerWalletLiabilities: 150,
          supplierPayables: 20,
          operatingReserve: 7.5,
          actualCashBalance: 500,
          withdrawableLiquidity: 16.5,
        },
        [CurrencyCode.SAR]: {
          currency: CurrencyCode.SAR,
          totalOrdersCount: 5,
          completedOrdersCount: 5,
          failedOrdersCount: 0,
          pendingOrdersCount: 0,
          grossSales: 350.0,
          supplierCost: 310.0,
          channelFees: 3.5,
          estimatedProfit: 0,
          realizedProfit: 36.5,
          totalDepositsAmount: 1000,
          totalPayoutsAmount: 0,
          customerWalletLiabilities: 200,
          supplierPayables: 30,
          operatingReserve: 17.5,
          actualCashBalance: 1000,
          withdrawableLiquidity: 36.5,
        },
      },
      isImmutable: true,
      closedByUserId: 'system-scheduler',
      notes: 'إغلاق نهاية اليوم الآلي المعتمد (Automated Daily Close)',
      closedAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000),
      adjustments: [],
    };

    this.memoryReports.set(this.memoryKey(defaultDate), rep);
  }

  /**
   * Closes a business day and creates an Immutable Snapshot
   * AT-23: If already closed, does NOT overwrite or duplicate ledger entries!
   */
  async closeBusinessDay(
    userId: string,
    dto: CreateDailyCloseDto,
  ): Promise<{ snapshot: InMemoryDailyCloseRecord; isNew: boolean; message: string }> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dto.closeDate || !dateRegex.test(dto.closeDate)) {
      throw new BadRequestException('صيغة التاريخ غير صحيحة، يجب أن تكون YYYY-MM-DD');
    }

    // 1. Check if report already exists (AT-23: Immutable Snapshot Check)
    const existing = await this.getExistingReport(dto.closeDate);
    if (existing) {
      if (existing.status === DailyCloseStatus.CLOSED || existing.status === DailyCloseStatus.ADJUSTED) {
        this.logger.warn(
          `[AT-23 Idempotency] Daily close for date ${dto.closeDate} is already closed and immutable. Returning existing snapshot.`,
        );
        return {
          snapshot: existing,
          isNew: false,
          message: `تم إغلاق هذا اليوم مسبقاً (${dto.closeDate}) وهو سجل غير قابل للتعديل (Immutable Snapshot). تم استرجاع النسخة المعتمدة دون تكرار أي قيود.`,
        };
      }
    }

    // 2. Calculate metrics for all currencies
    const metrics = await this.profitEngine.calculateAllCurrencies(dto.closeDate);

    // Total counts
    let totalOrders = 0;
    let completedOrders = 0;
    let failedOrders = 0;
    let pendingOrders = 0;

    for (const cur of [CurrencyCode.YER, CurrencyCode.USD, CurrencyCode.SAR]) {
      const m = metrics[cur];
      totalOrders += m.totalOrdersCount;
      completedOrders += m.completedOrdersCount;
      failedOrders += m.failedOrdersCount;
      pendingOrders += m.pendingOrdersCount;
    }

    const reportId = `dclose-${dto.closeDate}-${Date.now()}`;
    const status = dto.forcePreliminary ? DailyCloseStatus.PRELIMINARY : DailyCloseStatus.CLOSED;

    const snapshotRecord: InMemoryDailyCloseRecord = {
      id: reportId,
      closeDate: dto.closeDate,
      status,
      metricsByCurrency: metrics,
      isImmutable: status === DailyCloseStatus.CLOSED,
      closedByUserId: userId,
      notes: dto.notes || 'إغلاق نهاية اليوم المعتمد',
      closedAt: new Date(),
      updatedAt: new Date(),
      adjustments: [],
    };

    // Try persisting to Prisma DB if online
    try {
      await this.prisma.dailyCloseReport.create({
        data: {
          id: reportId,
          closeDate: dto.closeDate,
          status,
          totalOrdersCount: totalOrders,
          completedOrdersCount: completedOrders,
          failedOrdersCount: failedOrders,
          pendingOrdersCount: pendingOrders,
          metricsJson: metrics as any,
          isImmutable: status === DailyCloseStatus.CLOSED,
          closedByUserId: userId,
          notes: dto.notes || null,
        },
      });
    } catch (err: any) {
      this.assertDurableDailyClose(err);
      this.logger.warn(`Local unscoped development daily-close fallback (${err?.message})`);
    }

    this.memoryReports.set(this.memoryKey(dto.closeDate), snapshotRecord);
    return {
      snapshot: snapshotRecord,
      isNew: true,
      message: `تم إغلاق اليوم المالي (${dto.closeDate}) بنجاح واعتماد الـ Snapshot غير القابل للتعديل.`,
    };
  }

  /**
   * Adds an Adjustment to an already closed report without touching baseline snapshot (AT-23)
   */
  async addAdjustment(
    closeDate: string,
    adjustment: {
      currency: CurrencyCode;
      adjustmentType: string;
      amount: number;
      reason: string;
      ledgerTxId?: string;
    },
    userId: string,
  ): Promise<DailyCloseAdjustmentDto> {
    const report = await this.getExistingReport(closeDate);
    if (!report) {
      throw new NotFoundException(`تقرير الإغلاق لليوم ${closeDate} غير موجود`);
    }

    if (!adjustment.reason || adjustment.reason.trim().length === 0) {
      throw new BadRequestException('سبب التسوية إلزامي للرقابة والتدقيق');
    }

    const adjId = `adj-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const adjRecord: DailyCloseAdjustmentDto = {
      id: adjId,
      reportId: report.id,
      currency: adjustment.currency,
      adjustmentType: adjustment.adjustmentType,
      amount: adjustment.amount,
      reason: adjustment.reason,
      ledgerTxId: adjustment.ledgerTxId || null,
      approvedByUserId: userId,
      createdAt: new Date().toISOString(),
    };

    // Persist first; mutate the local development snapshot only after database success.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.dailyCloseAdjustment.create({
          data: {
            id: adjId,
            reportId: report.id,
            currency: adjustment.currency,
            adjustmentType: adjustment.adjustmentType,
            amount: adjustment.amount,
            reason: adjustment.reason,
            ledgerTxId: adjustment.ledgerTxId || null,
            approvedByUserId: userId,
          },
        });
        await tx.dailyCloseReport.update({
          where: { id: report.id },
          data: { status: DailyCloseStatus.ADJUSTED },
        });
      });
    } catch (error: any) {
      this.assertDurableDailyClose(error);
      this.logger.warn(`Local unscoped development adjustment fallback: ${error?.message || error}`);
    }

    report.adjustments.push(adjRecord);
    report.status = DailyCloseStatus.ADJUSTED;
    report.updatedAt = new Date();
    this.memoryReports.set(this.memoryKey(closeDate), report);
    return adjRecord;
  }

  /**
   * Get existing report by date
   */
  async getExistingReport(closeDate: string): Promise<InMemoryDailyCloseRecord | null> {
    try {
      const dbReport = await this.prisma.dailyCloseReport.findFirst({
        where: { closeDate },
        include: { adjustments: true },
      });
      if (dbReport) {
        return {
          id: dbReport.id,
          closeDate: dbReport.closeDate,
          status: dbReport.status as DailyCloseStatus,
          metricsByCurrency: dbReport.metricsJson as any,
          isImmutable: dbReport.isImmutable,
          closedByUserId: dbReport.closedByUserId || undefined,
          notes: dbReport.notes || undefined,
          closedAt: dbReport.closedAt,
          updatedAt: dbReport.updatedAt,
          adjustments: (dbReport.adjustments || []).map((a) => ({
            id: a.id,
            reportId: a.reportId,
            currency: a.currency as CurrencyCode,
            adjustmentType: a.adjustmentType,
            amount: Number(a.amount),
            reason: a.reason,
            ledgerTxId: a.ledgerTxId || undefined,
            approvedByUserId: a.approvedByUserId || undefined,
            createdAt: a.createdAt.toISOString(),
          })),
        };
      }
    } catch (error: any) {
      this.assertDurableDailyClose(error);
      this.logger.warn(`Local unscoped development report fallback: ${error?.message || error}`);
    }

    return this.memoryReports.get(this.memoryKey(closeDate)) || null;
  }

  /**
   * List all historical daily reports
   */
  async listDailyReports(): Promise<InMemoryDailyCloseRecord[]> {
    try {
      const dbReports = await this.prisma.dailyCloseReport.findMany({
        orderBy: { closeDate: 'desc' },
        include: { adjustments: true },
      });
      if (dbReports.length > 0 || process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
        return dbReports.map((dbReport) => ({
          id: dbReport.id,
          closeDate: dbReport.closeDate,
          status: dbReport.status as DailyCloseStatus,
          metricsByCurrency: dbReport.metricsJson as any,
          isImmutable: dbReport.isImmutable,
          closedByUserId: dbReport.closedByUserId || undefined,
          notes: dbReport.notes || undefined,
          closedAt: dbReport.closedAt,
          updatedAt: dbReport.updatedAt,
          adjustments: (dbReport.adjustments || []).map((a) => ({
            id: a.id,
            reportId: a.reportId,
            currency: a.currency as CurrencyCode,
            adjustmentType: a.adjustmentType,
            amount: Number(a.amount),
            reason: a.reason,
            ledgerTxId: a.ledgerTxId || undefined,
            approvedByUserId: a.approvedByUserId || undefined,
            createdAt: a.createdAt.toISOString(),
          })),
        }));
      }
    } catch (error: any) {
      this.assertDurableDailyClose(error);
      this.logger.warn(`Local unscoped development report list fallback: ${error?.message || error}`);
    }

    const prefix = `${getCurrentTenantId() || 'platform'}:`;
    return Array.from(this.memoryReports.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([, report]) => report)
      .sort((a, b) => b.closeDate.localeCompare(a.closeDate));
  }

  /**
   * Export report as CSV text
   */
  async exportReportCsv(closeDate: string): Promise<string> {
    const report = await this.getExistingReport(closeDate);
    if (!report) {
      throw new NotFoundException(`تقرير الإغلاق لليوم ${closeDate} غير موجود`);
    }

    const headers = [
      'Currency',
      'Total Orders',
      'Completed Orders',
      'Gross Sales',
      'Supplier Cost',
      'Channel Fees',
      'Estimated Profit',
      'Realized Profit',
      'Customer Wallet Liabilities',
      'Supplier Payables',
      'Operating Reserve (5%)',
      'Actual Cash Balance',
      'Withdrawable Liquidity',
    ];

    const rows: string[] = [headers.join(',')];

    for (const cur of [CurrencyCode.YER, CurrencyCode.USD, CurrencyCode.SAR]) {
      const m = report.metricsByCurrency[cur];
      if (m) {
        rows.push(
          [
            cur,
            m.totalOrdersCount,
            m.completedOrdersCount,
            m.grossSales,
            m.supplierCost,
            m.channelFees,
            m.estimatedProfit,
            m.realizedProfit,
            m.customerWalletLiabilities,
            m.supplierPayables,
            m.operatingReserve,
            m.actualCashBalance,
            m.withdrawableLiquidity,
          ].join(','),
        );
      }
    }

    return rows.join('\n');
  }
}
