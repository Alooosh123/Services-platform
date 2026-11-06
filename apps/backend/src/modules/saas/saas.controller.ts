import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SaasService } from './saas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SaaSInvoiceFinanceAccess } from './decorators/saas-invoice-finance.decorator';
import {
  UserRole,
  SaaSTenantStatus,
  SaaSSubscriptionStatus,
  SaaSInvoiceStatus,
} from '@digital-topup/shared';
import {
  CreateTenantDto,
  UpdateTenantStatusDto,
  RenewSubscriptionDto,
  UpdatePlanPriceDto,
  CreateInvoiceDto,
  MarkSaasInvoicePaidDto,
  AssignTenantOwnerDto,
} from './dto/saas.dto';

@ApiTags('SaaS Platform & Multi-Tenant Management (Super Admin Portal)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('saas')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List all SaaS subscription plans (Weekly, Monthly, Annual) with equal permissions' })
  async getPlans() {
    return this.saasService.getPlans();
  }

  @Put('plans/:id/price')
  @ApiOperation({ summary: 'Update pricing for a specific subscription plan' })
  async updatePlanPrice(@Param('id') id: string, @Body() dto: UpdatePlanPriceDto) {
    return this.saasService.updatePlanPrice(id, dto);
  }

  @Get('plans/permissions-audit')
  @ApiOperation({ summary: 'Verify that all subscription tiers enforce strictly equal full permissions' })
  async verifyAllPlansEqualPermissions() {
    return this.saasService.verifyAllPlansEqualPermissions();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List all onboarded SaaS tenants and subscribers' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', enum: SaaSTenantStatus, required: false })
  async getTenants(
    @Query('search') search?: string,
    @Query('status') status?: SaaSTenantStatus,
  ) {
    return this.saasService.getTenants(search, status);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get details of a specific SaaS tenant by ID' })
  async getTenantById(@Param('id') id: string) {
    return this.saasService.getTenantById(id);
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Onboard a new SaaS tenant with license generation and subscription plan' })
  async createTenant(@Body() dto: CreateTenantDto) {
    return this.saasService.createTenant(dto);
  }

  @Post('tenants/:id/owner')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Assign the verified tenant owner to an active store',
    description: 'Requires exact owner email and phone match plus an auditable manual identity-verification reference.',
  })
  async assignTenantOwner(
    @Param('id') id: string,
    @Body() dto: AssignTenantOwnerDto,
    @Req() request: any,
  ) {
    return this.saasService.assignTenantOwner(id, dto, request.user.id);
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: 'Update tenant status (ACTIVE, SUSPENDED, TERMINATED)' })
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
    @Req() request: any,
  ) {
    return this.saasService.updateTenantStatus(id, dto, request.user.id);
  }

  @Post('tenants/:id/renew')
  @ApiOperation({ summary: 'Renew or extend tenant subscription duration (Weekly, Monthly, Annual)' })
  async renewSubscription(
    @Param('id') id: string,
    @Body() dto: RenewSubscriptionDto,
  ) {
    return this.saasService.renewSubscription(id, dto);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List all active, pending, or expired subscriptions' })
  @ApiQuery({ name: 'status', enum: SaaSSubscriptionStatus, required: false })
  async getSubscriptions(@Query('status') status?: SaaSSubscriptionStatus) {
    return this.saasService.getSubscriptions(status);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List all SaaS billing invoices and payment receipts' })
  @ApiQuery({ name: 'status', enum: SaaSInvoiceStatus, required: false })
  async getInvoices(@Query('status') status?: SaaSInvoiceStatus) {
    return this.saasService.getInvoices(status);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Issue a new unpaid SaaS invoice' })
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.saasService.createInvoice(dto);
  }

  @Post('invoices/:id/mark-paid')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @SaaSInvoiceFinanceAccess()
  @ApiOperation({
    summary: 'Confirm a SaaS invoice payment after finance verification',
    description: 'Requires a verified transfer reference. This action is audited and activates the linked subscription.',
  })
  async markInvoicePaid(
    @Param('id') id: string,
    @Body() dto: MarkSaasInvoicePaidDto,
    @Req() request: any,
  ) {
    return this.saasService.markInvoicePaid(id, dto, request.user.id, request.user.role);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get SaaS executive dashboard KPIs (MRR, ARR, active subscriber counts)' })
  async getSaaSKpiDashboard() {
    return this.saasService.getSaaSKpiDashboard();
  }

  @Get('system-status')
  @ApiOperation({ summary: 'Get Super Admin global system health and multi-tenant status' })
  async getSystemStatus() {
    return this.saasService.getSystemStatus();
  }
}
