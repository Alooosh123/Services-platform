import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@digital-topup/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NetworkMonitoringService } from './network-monitoring.service';

@ApiTags('Network Monitoring (Read Only)')
@ApiBearerAuth()
@Controller('network-monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.AUDITOR)
export class NetworkMonitoringController {
  constructor(private readonly service: NetworkMonitoringService) {}

  @Get('status')
  @ApiOperation({ summary: 'Read-only MikroTik RouterOS health snapshot over verified HTTPS' })
  inspect() { return this.service.inspect(); }

  @Get('history')
  @ApiOperation({ summary: 'Read historical network observations' })
  history(@Query('limit') limit?: string) { return this.service.history(limit); }
}
