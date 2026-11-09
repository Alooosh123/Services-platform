import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ProfitEngineService } from './profit-engine.service';
import { DailyCloseService } from './daily-close.service';
import { OwnerEarningsService } from './owner-earnings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  UserRole,
  CurrencyCode,
  CreateDailyCloseDto,
  CreatePayoutBeneficiaryDto,
  OwnerPayoutRequestDto,
  ApproveOwnerPayoutDto,
} from '@digital-topup/shared';

@ApiTags('Admin Analytics, Daily Close & Owner Earnings (Phase 07)')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly profitEngine: ProfitEngineService,
    private readonly dailyCloseService: DailyCloseService,
    private readonly ownerEarningsService: OwnerEarningsService,
  ) {}

  @Get('dashboard-kpis')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR)
  @ApiOperation({ summary: 'Admin Dashboard KPIs (Revenue, Profit, Orders, Multi-Currency Liabilities)' })
  async getDashboardKpis() {
    return this.reportsService.getDashboardKpis();
  }

  @Get('profit-and-performance')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.AUDITOR)
  @ApiOperation({ summary: 'Module 10: Realized Sales, COGS, Net Profit, and Provider Performance' })
  async getProfitAndPerformance(
    @Query('dateRange') dateRange?: 'today' | '7d' | '30d' | 'all',
    @Query('providerId') providerId?: string,
  ) {
    return this.reportsService.getProfitAndPerformanceReport({ dateRange, providerId });
  }

  // ----------------------------------------------------
  // DAILY CLOSE & IMMUTABLE SNAPSHOTS (AT-13, AT-23)
  // ----------------------------------------------------
  @Post('daily-close')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'AT-13 & AT-23: Close business day, calculate metrics and persist immutable snapshot' })
  async closeBusinessDay(@Request() req: any, @Body() dto: CreateDailyCloseDto) {
    const userId = req.user?.id || req.user?.userId || 'admin-user-01';
    return this.dailyCloseService.closeBusinessDay(userId, dto);
  }

  @Get('daily-close')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR)
  @ApiOperation({ summary: 'List all historical daily close snapshots' })
  async listDailyCloseReports() {
    return this.dailyCloseService.listDailyReports();
  }

  @Get('daily-close/:date')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR)
  @ApiOperation({ summary: 'Get daily close snapshot for specific date (YYYY-MM-DD)' })
  async getDailyCloseReport(@Param('date') date: string) {
    return this.dailyCloseService.getExistingReport(date);
  }

  @Post('daily-close/:date/adjustment')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'AT-23: Add adjustment record to closed daily report without modifying baseline snapshot' })
  async addDailyCloseAdjustment(
    @Request() req: any,
    @Param('date') date: string,
    @Body()
    dto: {
      currency: CurrencyCode;
      adjustmentType: string;
      amount: number;
      reason: string;
      ledgerTxId?: string;
    },
  ) {
    const userId = req.user?.id || req.user?.userId || 'admin-user-01';
    return this.dailyCloseService.addAdjustment(date, dto, userId);
  }

  @Get('daily-close/:date/export')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export daily close report as CSV' })
  async exportDailyCloseCsv(@Param('date') date: string) {
    return this.dailyCloseService.exportReportCsv(date);
  }

  // ----------------------------------------------------
  // OWNER EARNINGS & PAYOUTS (AT-14, AT-17, AT-18)
  // ----------------------------------------------------
  @Get('owner-earnings/statement')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'AT-14 & AT-17: Get owner statement, real cash vs liabilities, and withdrawable liquidity' })
  async getEarningsStatement(
    @Request() req: any,
    @Query('currency') currency?: CurrencyCode,
  ) {
    const userId = req.user?.id || req.user?.userId;
    const cur = currency || CurrencyCode.YER;
    return this.ownerEarningsService.getEarningsStatement(userId, cur);
  }

  @Post('owner-earnings/beneficiaries')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Register a payout beneficiary account with verified ownership' })
  async createBeneficiary(@Request() req: any, @Body() dto: CreatePayoutBeneficiaryDto) {
    const userId = req.user?.id || req.user?.userId || 'user-owner-001';
    return this.ownerEarningsService.createBeneficiary(userId, dto);
  }

  @Get('owner-earnings/beneficiaries')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'List verified payout beneficiaries' })
  async listBeneficiaries(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId || 'user-owner-001';
    return this.ownerEarningsService.listBeneficiaries(userId);
  }

  @Post('owner-earnings/beneficiaries/:id/approve')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Finance: independently approve or reject an owner payout beneficiary' })
  async approveBeneficiary(
    @Request() req: any,
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('notes') notes?: string,
  ) {
    const financeUserId = req.user?.id || req.user?.userId;
    return this.ownerEarningsService.approveBeneficiary(id, financeUserId, approved === true, notes);
  }

  @Post('owner-earnings/payouts/request')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'AT-17 & AT-18: Request owner earnings payout with TOTP MFA and liquidity validation' })
  async requestOwnerPayout(@Request() req: any, @Body() dto: OwnerPayoutRequestDto) {
    const userId = req.user?.id || req.user?.userId || 'user-owner-001';
    return this.ownerEarningsService.requestOwnerPayout(userId, dto);
  }

  @Get('owner-earnings/payouts')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR)
  @ApiOperation({ summary: 'List owner payout requests and approval history' })
  async listOwnerPayouts(@Request() req: any) {
    const userId = req.user?.role === UserRole.OWNER ? req.user?.id : undefined;
    return this.ownerEarningsService.listOwnerPayouts(userId);
  }

  @Post('owner-earnings/payouts/:id/approve')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'AT-17: Finance Officer approves owner payout request (Four-Eyes Principle)' })
  async approveOwnerPayout(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveOwnerPayoutDto,
  ) {
    const financeUserId = req.user?.id || req.user?.userId;
    return this.ownerEarningsService.approveOwnerPayout(id, dto, financeUserId);
  }

  @Post('owner-earnings/payouts/:id/confirm')
  @Roles(UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'AT-17: Confirm external wire execution, attach receipt reference, and post balanced ledger entry' })
  async confirmOwnerPayout(
    @Request() req: any,
    @Param('id') id: string,
    @Body('externalReference') externalReference: string,
  ) {
    const financeUserId = req.user?.id || req.user?.userId || 'user-finance-002';
    return this.ownerEarningsService.confirmExternalTransfer(id, externalReference, financeUserId);
  }
}
