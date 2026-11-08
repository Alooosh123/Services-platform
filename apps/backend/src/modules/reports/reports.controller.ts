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
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ProfitEngineService } from './profit-engine.service';
import { DailyCloseService } from './daily-close.service';
import { OwnerEarningsService } from './owner-earnings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedisRateLimitGuard } from '../../security/redis-rate-limit.guard';
import { RateLimit } from '../../security/rate-limit.decorator';
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

  private requireActorId(request: any): string {
    const userId = request?.user?.id || request?.user?.userId;
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new UnauthorizedException('Authenticated staff identity is required for financial operations.');
    }
    return userId;
  }

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
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(3, 60_000, 'reports-daily-close')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'AT-13 & AT-23: Close business day, calculate metrics and persist immutable snapshot' })
  async closeBusinessDay(@Request() req: any, @Body() dto: CreateDailyCloseDto) {
    const userId = this.requireActorId(req);
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
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'reports-daily-close-adjustment')
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
    const userId = this.requireActorId(req);
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
    const userId = this.requireActorId(req);
    const cur = currency || CurrencyCode.YER;
    return this.ownerEarningsService.getEarningsStatement(userId, cur);
  }

  @Post('owner-earnings/beneficiaries')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'owner-beneficiary-create')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Register a payout beneficiary account with verified ownership' })
  async createBeneficiary(@Request() req: any, @Body() dto: CreatePayoutBeneficiaryDto) {
    const userId = this.requireActorId(req);
    return this.ownerEarningsService.createBeneficiary(userId, dto);
  }

  @Post('owner-earnings/beneficiaries/:id/verify')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'owner-beneficiary-verify')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Finance: verify an owner beneficiary using a separate finance actor' })
  async verifyBeneficiary(@Request() req: any, @Param('id') id: string, @Body('notes') notes?: string) {
    const staffId = this.requireActorId(req);
    return this.ownerEarningsService.verifyPersistentBeneficiary(staffId, id, notes);
  }

  @Post('owner-earnings/allocations')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'owner-earnings-allocation')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Finance: allocate posted realized earnings to owner payable via double-entry ledger' })
  async allocateOwnerEarnings(
    @Request() req: any,
    @Body() dto: { ownerUserId: string; currency: CurrencyCode; amount: number; idempotencyKey: string; notes?: string },
  ) {
    const staffId = this.requireActorId(req);
    return this.ownerEarningsService.allocateRealizedEarnings(staffId, dto);
  }

  @Get('owner-earnings/beneficiaries')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'List verified payout beneficiaries' })
  async listBeneficiaries(@Request() req: any) {
    const userId = this.requireActorId(req);
    return this.ownerEarningsService.listBeneficiaries(userId);
  }

  @Post('owner-earnings/payouts/request')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(3, 60_000, 'owner-payout-request')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'AT-17 & AT-18: Request owner earnings payout with TOTP MFA and liquidity validation' })
  async requestOwnerPayout(@Request() req: any, @Body() dto: OwnerPayoutRequestDto) {
    const userId = this.requireActorId(req);
    return this.ownerEarningsService.requestOwnerPayout(userId, dto);
  }

  @Get('owner-earnings/payouts')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR)
  @ApiOperation({ summary: 'List owner payout requests and approval history' })
  async listOwnerPayouts(@Request() req: any) {
    const userId = req.user?.role === UserRole.OWNER ? this.requireActorId(req) : undefined;
    return this.ownerEarningsService.listOwnerPayouts(userId);
  }

  @Post('owner-earnings/payouts/:id/approve')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'owner-payout-approve')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'AT-17: Finance Officer approves owner payout request (Four-Eyes Principle)' })
  async approveOwnerPayout(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveOwnerPayoutDto,
  ) {
    const financeUserId = this.requireActorId(req);
    return this.ownerEarningsService.approveOwnerPayout(id, dto, financeUserId);
  }

  @Post('owner-earnings/payouts/:id/confirm')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'owner-payout-confirm')
  @Roles(UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'AT-17: Confirm external wire execution, attach receipt reference, and post balanced ledger entry' })
  async confirmOwnerPayout(
    @Request() req: any,
    @Param('id') id: string,
    @Body('externalReference') externalReference: string,
  ) {
    const financeUserId = this.requireActorId(req);
    return this.ownerEarningsService.confirmExternalTransfer(id, externalReference, financeUserId);
  }
}
