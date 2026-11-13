import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@digital-topup/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateOperationalApprovalDto, DecideOperationalApprovalDto } from './operational-approvals.dto';
import { OperationalApprovalsService } from './operational-approvals.service';

@ApiTags('Operational Approvals and Four-Eyes Control')
@ApiBearerAuth()
@Controller('operational-approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationalApprovalsController {
  constructor(private readonly service: OperationalApprovalsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.AUDITOR)
  @ApiOperation({ summary: 'List pending and historical network/financial approval requests' })
  list(@Query('status') status?: string) { return this.service.list(status); }

  @Post()
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.FINANCE)
  @ApiOperation({ summary: 'Request a two-person approval for a network change or reconciliation exception' })
  create(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Body() dto: CreateOperationalApprovalDto) {
    return this.service.create(userId, role, dto);
  }

  @Post(':id/decision')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Approve/reject with requester separation-of-duties; approval does not auto-execute changes' })
  decide(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('id') id: string, @Body() dto: DecideOperationalApprovalDto) {
    return this.service.decide(userId, role, id, dto);
  }
}
