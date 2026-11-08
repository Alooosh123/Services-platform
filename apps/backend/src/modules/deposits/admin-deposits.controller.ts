import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DepositsService } from './deposits.service';
import { ReviewDepositDto, RejectDepositDto } from './dto/review-deposit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RateLimit } from '../../security/rate-limit.decorator';
import { RedisRateLimitGuard } from '../../security/redis-rate-limit.guard';
import { DepositStatus, UserRole, PaymentChannelCode, PaymentChannelMode } from '@digital-topup/shared';

@ApiTags('Deposits (Admin Financial Operations)')
@Controller('admin/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.FINANCE,
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.FINANCE_MANAGER,
  UserRole.GENERAL_MANAGER,
)
@ApiBearerAuth()
export class AdminDepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin/Finance: List all deposit requests with filters' })
  @ApiQuery({ name: 'status', enum: DepositStatus, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  async getAllDeposits(
    @Query('status') status?: DepositStatus,
    @Query('search') search?: string,
  ): Promise<any> {
    return this.depositsService.getAllDepositsForAdmin({ status, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin/Finance: View single deposit with audit timeline and receipt' })
  async getDepositDetails(@Param('id') id: string): Promise<any> {
    return this.depositsService.getDepositById(id, undefined, true);
  }

  @Post(':id/under-review')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(20, 60_000, 'deposit-admin-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Change deposit status to UNDER_REVIEW' })
  async markUnderReview(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body() dto: ReviewDepositDto,
  ): Promise<any> {
    return this.depositsService.markUnderReview(staffId, id, dto);
  }

  @Post(':id/approve')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'deposit-admin-approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin/Finance: Approve and credit deposit via strict double-entry ledger',
  })
  async approveAndCredit(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body() dto: ReviewDepositDto,
  ): Promise<any> {
    return this.depositsService.approveAndCredit(staffId, id, dto);
  }

  @Post(':id/reject')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'deposit-admin-reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Reject deposit request with mandatory reason' })
  async rejectDeposit(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body() dto: RejectDepositDto,
  ): Promise<any> {
    return this.depositsService.rejectDeposit(staffId, id, dto);
  }

@Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @Post('channels/:channel/switch-mode')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'deposit-channel-mode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Switch channel mode safely (MANUAL, API, BLOCKED_EXTERNAL, DISABLED)' })
  async switchChannelMode(
    @Param('channel') channel: string,
    @Body('mode') mode: PaymentChannelMode,
    @CurrentUser('id') actorUserId: string,
    @CurrentUser('role') actorUserRole: string,
  ) {
    return this.depositsService.switchChannelMode(channel.toUpperCase() as PaymentChannelCode, mode, actorUserId, actorUserRole);
  }

@Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @Post('channels/:channel/failover')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'deposit-channel-failover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Trigger emergency safe failover of payment channel to MANUAL' })
  async failoverChannel(
    @Param('channel') channel: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser('id') actorUserId: string,
    @CurrentUser('role') actorUserRole: string,
  ) {
    return this.depositsService.failoverChannel(channel.toUpperCase() as PaymentChannelCode, reason, actorUserId, actorUserRole);
  }

  @Get('channels/legal-verification')
  @ApiOperation({ summary: 'Admin/Audit: Verify legal status of payment channels accounts (BR-06)' })
  async verifyLegalAccounts() {
    return this.depositsService.verifyLegalAccounts();
  }

  @Get('channels/all')
  @ApiOperation({ summary: 'Admin: Get all channels including pending and unverified' })
  async getAllChannels() {
    return this.depositsService.getAllChannelsForAdmin();
  }

@Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @Post('channels')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'deposit-channel-create')
  @ApiOperation({ summary: 'Admin: Create a new dynamic payment channel' })
  async createChannel(
    @Body() dto: any,
    @CurrentUser('id') actorUserId: string,
    @CurrentUser('role') actorUserRole: string,
  ) {
    return this.depositsService.createDynamicChannel(dto, actorUserId, actorUserRole);
  }

@Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @Post('channels/:channel/propose-account')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'deposit-channel-account-propose')
  @ApiOperation({ summary: 'Admin: Propose new receiver account (requires finance approval)' })
  async proposeAccount(
    @Param('channel') channel: string,
    @Body('accountNumber') accountNumber: string,
    @Body('feePercentage') feePercentage: number | undefined,
    @CurrentUser('id') actorUserId: string,
    @CurrentUser('role') actorUserRole: string,
  ) {
    return this.depositsService.proposeChannelAccountChange(
      channel.toUpperCase() as PaymentChannelCode,
      accountNumber,
      feePercentage,
      actorUserId,
      actorUserRole,
    );
  }

  @Post('channels/:channel/finance-approval')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'deposit-channel-finance-approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @ApiOperation({ summary: 'Finance Manager: Dual control approval for channel account change (AT-15)' })
  async approveChannelFinance(
    @CurrentUser('id') adminUserId: string,
    @CurrentUser('role') adminUserRole: string,
    @Param('channel') channel: string,
    @Body() dto: any,
  ) {
    return this.depositsService.approveChannelFinanceReview(
      adminUserId,
      adminUserRole,
      channel.toUpperCase() as PaymentChannelCode,
      dto,
    );
  }

@Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @Post('channels/:channel/kill-switch')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'deposit-channel-kill-switch')
  @ApiOperation({ summary: 'Admin: Emergency Kill Switch for payment channel (AT-24)' })
  async killSwitchChannel(
    @CurrentUser('id') adminUserId: string,
    @CurrentUser('role') adminUserRole: string,
    @Param('channel') channel: string,
    @Body('reason') reason: string,
  ) {
    return this.depositsService.triggerChannelKillSwitch(
      adminUserId,
      adminUserRole,
      channel.toUpperCase() as PaymentChannelCode,
      reason,
    );
  }
}
