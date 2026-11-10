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
import { PaymentSenderAccountsService } from './payment-sender-accounts.service';
import { ReviewPaymentSenderAccountDto, RejectPaymentSenderAccountDto } from './dto/review-payment-sender-account.dto';
import { ReviewDepositDto, RejectDepositDto } from './dto/review-deposit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DepositStatus, UserRole, PaymentChannelCode, PaymentChannelMode, PaymentSenderIdentifierType } from '@digital-topup/shared';

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
  constructor(
    private readonly depositsService: DepositsService,
    private readonly senderAccountsService: PaymentSenderAccountsService,
  ) {}

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


  // Only the application owner (or platform super-admin) can verify customer wallet identities.
  // This queue returns the decrypted identifier, so it must never be exposed to finance/support roles.
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER)
  @Get('sender-accounts/pending')
  @ApiOperation({ summary: 'Owner only: list pending customer wallet sender-account verification requests' })
  async listPendingSenderAccounts() {
    return this.senderAccountsService.listPendingForOwner();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER)
  @Post('sender-accounts/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Owner only: verify and permanently link a customer sender identifier to a wallet channel' })
  async approveSenderAccount(
    @CurrentUser('id') ownerUserId: string,
    @Param('id') accountId: string,
    @Body() dto: ReviewPaymentSenderAccountDto,
  ) {
    return this.senderAccountsService.approveForOwner(accountId, ownerUserId, dto.reviewNotes);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER)
  @Post('sender-accounts/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Owner only: reject a customer wallet sender-account verification request' })
  async rejectSenderAccount(
    @CurrentUser('id') ownerUserId: string,
    @Param('id') accountId: string,
    @Body() dto: RejectPaymentSenderAccountDto,
  ) {
    return this.senderAccountsService.rejectForOwner(accountId, ownerUserId, dto.rejectionReason);
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

@Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @Post('channels/:channel/sender-identifier-type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: choose customer sender identifier type (ALIAS, PHONE, WALLET_ID or ACCOUNT_NUMBER)' })
  async updateSenderIdentifierType(
    @Param('channel') channel: string,
    @Body('identifierType') identifierType: PaymentSenderIdentifierType,
    @CurrentUser('id') actorUserId: string,
    @CurrentUser('role') actorUserRole: string,
  ) {
    return this.depositsService.updateSenderIdentifierType(
      channel.toUpperCase() as PaymentChannelCode,
      identifierType,
      actorUserId,
      actorUserRole,
    );
  }

@Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @Post('channels/:channel/failover')
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
  @ApiOperation({ summary: 'Admin: Propose new receiver account (requires finance approval)' })
  async proposeAccount(
    @Param('channel') channel: string,
    @Body() dto: {
      accountNumber: string;
      accountHolderName?: string;
      instructionsAr?: string;
      feePercentage?: number;
    },
    @CurrentUser('id') actorUserId: string,
    @CurrentUser('role') actorUserRole: string,
  ) {
    return this.depositsService.proposeChannelAccountChange(
      channel.toUpperCase() as PaymentChannelCode,
      dto.accountNumber,
      dto.feePercentage,
      actorUserId,
      actorUserRole,
      dto.accountHolderName,
      dto.instructionsAr,
    );
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @Post('channels/:channel/propose-compliance')
  @ApiOperation({ summary: 'Propose regulator authorization and provider merchant agreement evidence; independent finance review required' })
  async proposeChannelCompliance(
    @Param('channel') channel: string,
    @Body() dto: {
      regulatoryApprovalReference: string;
      regulatoryApprovalDocumentUrl: string;
      providerAgreementReference: string;
      providerAgreementDocumentUrl: string;
    },
    @CurrentUser('id') actorUserId: string,
    @CurrentUser('role') actorUserRole: string,
  ) {
    return this.depositsService.proposeChannelComplianceEvidence(
      channel.toUpperCase() as PaymentChannelCode,
      dto,
      actorUserId,
      actorUserRole,
    );
  }

  @Post('channels/:channel/finance-approval')
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
