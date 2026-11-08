import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import { SupplierBalanceService } from './supplier-balance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, UpdateProviderDto, SupplierDepositDto } from '@digital-topup/shared';
import { RedisRateLimitGuard } from '../../security/redis-rate-limit.guard';
import { RateLimit } from '../../security/rate-limit.decorator';

@ApiTags('TopUp Providers')
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly supplierBalanceService: SupplierBalanceService,
  ) {}

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FULFILLMENT_OPERATOR, UserRole.FINANCE_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all providers and their configurations' })
  async listProviders() {
    return this.providersService.listProviders();
  }

  @Get('admin/supplier-accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin/Finance: List all supplier commercial accounts and available balance' })
  async getSupplierAccounts() {
    return this.supplierBalanceService.getAllSupplierAccounts();
  }

  @Post('admin/fund-supplier')
  @UseGuards(JwtAuthGuard, RolesGuard, RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'supplier-funding')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin/Finance: Fund provider prepaid balance via bank transfer (Cash Movement)' })
  async fundSupplier(
    @CurrentUser('id') staffId: string,
    @Body() dto: SupplierDepositDto,
  ) {
    return this.supplierBalanceService.fundSupplierBalance(staffId, dto);
  }

  @Get('admin/supplier-transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin/Finance: Get transaction history for supplier commercial balances' })
  async getSupplierTransactions(@Query('provider') provider?: string) {
    return this.supplierBalanceService.getSupplierTransactions(provider);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'provider-config-update')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update provider configuration and credentials' })
  async updateProvider(
    @CurrentUser('id') actorUserId: string,
    @Param('id') providerId: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.providersService.updateProvider(providerId, dto, actorUserId);
  }

  @Post('admin/:id/test-connection')
  @UseGuards(JwtAuthGuard, RolesGuard, RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'provider-connection-test')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Test provider API connectivity and sync balance' })
  async testConnection(@Param('id') providerId: string) {
    return this.providersService.testProviderConnectivity(providerId);
  }

  @Post('validate-player')
  @UseGuards(JwtAuthGuard, RedisRateLimitGuard)
  @RateLimit(20, 60_000, 'provider-player-validation')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate player username/zone before order submission (authenticated customer)' })
  async validatePlayer(
    @Body()
    body: {
      providerCode?: string;
      serviceId: string;
      fields: Record<string, string>;
    },
  ) {
    return this.providersService.validatePlayer(body.providerCode || 'MOCK', {
      serviceId: body.serviceId,
      fields: body.fields,
    });
  }
}
