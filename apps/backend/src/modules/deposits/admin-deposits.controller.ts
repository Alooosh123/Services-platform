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
import {
  DepositStatus,
  UserRole,
  PaymentChannelCode,
  PaymentChannelMode,
} from '@digital-topup/shared';
import { DepositsService } from './deposits.service';
import { ReviewDepositDto, RejectDepositDto } from './dto/review-deposit.dto';
import {
  ApprovePaymentChannelChangeDto,
  CreatePaymentChannelDto,
  KillPaymentChannelDto,
  ProposePaymentChannelAccountDto,
  SwitchPaymentChannelModeDto,
} from './dto/payment-channel-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @ApiOperation({ summary: 'Approve and credit a manually verified deposit with independent approval and double-entry ledger' })
  async approveAndCredit(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body() dto: ReviewDepositDto,
  ): Promise<any> {
    return this.depositsService.approveAndCredit(staffId, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Reject deposit request with mandatory reason' })
  async rejectDeposit(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body() dto: RejectDepositDto,
  ): Promise<any> {
    return this.depositsService.rejectDeposit(staffId, id, dto);
  }

  @Post('channels/:channel/switch-mode')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Persist a safe payment channel mode; API mode is blocked until a real provider adapter is certified' })
  async switchChannelMode(
    @CurrentUser('id') staffId: string,
    @Param('channel') channel: string,
    @Body() dto: SwitchPaymentChannelModeDto,
  ) {
    return this.depositsService.switchChannelMode(channel.toUpperCase() as PaymentChannelCode, dto.mode, staffId);
  }

  @Post('channels/:channel/failover')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Persist safe failover to MANUAL mode with audit reason' })
  async failoverChannel(
    @CurrentUser('id') staffId: string,
    @Param('channel') channel: string,
    @Body() dto: KillPaymentChannelDto,
  ) {
    return this.depositsService.failoverChannel(channel.toUpperCase() as PaymentChannelCode, dto.reason, staffId);
  }

  @Get('channels/legal-verification')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR)
  @ApiOperation({ summary: 'Verify durable legal/finance status of configured payment channels' })
  async verifyLegalAccounts() {
    return this.depositsService.verifyLegalAccounts();
  }

  @Get('channels/all')
  @ApiOperation({ summary: 'List all durable channels including disabled and pending channels' })
  async getAllChannels() {
    return this.depositsService.getAllChannelsForAdmin();
  }

  @Post('channels')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a disabled draft payment channel; financial review is required before customer exposure' })
  async createChannel(
    @CurrentUser('id') staffId: string,
    @Body() dto: CreatePaymentChannelDto,
  ) {
    return this.depositsService.createDynamicChannel(dto, staffId);
  }

  @Post('channels/:channel/propose-account')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Propose receiver account/fee change; channel is hidden pending independent review' })
  async proposeAccount(
    @CurrentUser('id') staffId: string,
    @Param('channel') channel: string,
    @Body() dto: ProposePaymentChannelAccountDto,
  ) {
    return this.depositsService.proposeChannelAccountChange(
      channel.toUpperCase() as PaymentChannelCode,
      dto.accountNumber,
      dto.feePercentage,
      staffId,
      dto.reason,
    );
  }

  @Post('channels/:channel/finance-approval')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Independent four-eyes review; approved channels remain MANUAL and are never API-enabled' })
  async approveChannelFinance(
    @CurrentUser('id') adminUserId: string,
    @Param('channel') channel: string,
    @Body() dto: ApprovePaymentChannelChangeDto,
  ) {
    return this.depositsService.approveChannelFinanceReview(
      adminUserId,
      channel.toUpperCase() as PaymentChannelCode,
      dto,
    );
  }

  @Post('channels/:channel/kill-switch')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Durable emergency kill switch with immutable audit event' })
  async killSwitchChannel(
    @CurrentUser('id') adminUserId: string,
    @Param('channel') channel: string,
    @Body() dto: KillPaymentChannelDto,
  ) {
    return this.depositsService.triggerChannelKillSwitch(
      adminUserId,
      channel.toUpperCase() as PaymentChannelCode,
      dto.reason,
    );
  }
}
