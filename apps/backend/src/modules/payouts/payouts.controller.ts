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
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UserRole,
  PayoutStatus,
  CreatePayoutDto,
  ApprovePayoutDto,
} from '@digital-topup/shared';

@ApiTags('Payouts & Withdrawals')
@Controller('payouts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Customer/Partner: Request a fund payout or withdrawal' })
  async requestPayout(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePayoutDto,
  ) {
    return this.payoutsService.createPayoutRequest(userId, dto);
  }

  @Get('my-payouts')
  @ApiOperation({ summary: 'Customer: List all payout requests for current user' })
  async getMyPayouts(@CurrentUser('id') userId: string) {
    return this.payoutsService.listPayouts({ userId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single payout details' })
  async getPayoutById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.payoutsService.getPayoutByIdForUser(id, userId, role);
  }

  @Get('admin/list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin/Finance: List all payout requests with filters' })
  @ApiQuery({ name: 'status', enum: PayoutStatus, required: false })
  async listAllPayouts(@Query('status') status?: PayoutStatus) {
    return this.payoutsService.listPayouts({ status });
  }

  @Post('admin/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Approve payout request' })
  async approvePayout(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body() dto: ApprovePayoutDto,
  ) {
    return this.payoutsService.approvePayout(staffId, id, dto);
  }

  @Post('admin/:id/dispatch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Dispatch payout via automated API or check BLOCKED_EXTERNAL' })
  async dispatchPayout(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
  ) {
    return this.payoutsService.dispatchPayout(staffId, id);
  }

  @Post('admin/:id/confirm-manual')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Confirm manual bank transfer SOP with external reference' })
  async confirmManualPayout(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body('externalReference') externalReference: string,
    @Body('notes') notes?: string,
  ) {
    return this.payoutsService.confirmManualPayout(staffId, id, externalReference, notes);
  }

  @Post('admin/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Reject payout request and release wallet hold' })
  async rejectPayout(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.payoutsService.rejectPayout(staffId, id, reason || 'رفض إداري');
  }
}
