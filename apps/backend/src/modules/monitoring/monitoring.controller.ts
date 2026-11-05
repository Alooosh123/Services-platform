import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@digital-topup/shared';
import { CreateAlertDto, ResolveAlertDto, SimulateOutageDto } from './dto/monitoring.dto';
import { Response } from 'express';

@ApiTags('Operations & Monitoring (Phase 10)')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get operational telemetry metrics in JSON format' })
  async getMetrics() {
    return this.monitoringService.getTelemetryMetrics();
  }

  @Get('metrics/prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Get metrics in standard Prometheus exposition format' })
  async getPrometheusMetrics(@Res() res: Response) {
    const metrics = await this.monitoringService.getPrometheusMetrics();
    return res.status(HttpStatus.OK).send(metrics);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List system and financial alerts' })
  async getAlerts(@Query('onlyActive') onlyActive?: string) {
    const filterOnlyActive = onlyActive !== 'false';
    return this.monitoringService.getAlerts(filterOnlyActive);
  }

  @Post('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create manual or automated system alert' })
  async createAlert(@Body() dto: CreateAlertDto) {
    return this.monitoringService.createAlert(dto);
  }

  @Post('alerts/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a system or financial alert' })
  async resolveAlert(
    @Param('id') id: string,
    @Body() dto: ResolveAlertDto,
    @Request() req: any,
  ) {
    return this.monitoringService.resolveAlert(id, dto, req.user?.id || 'admin');
  }

  @Post('reconciliation-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger an immediate automated Daily Finance Reconciliation check' })
  async triggerReconciliationCheck() {
    return this.monitoringService.runDailyReconciliationCheck();
  }

  @Post('simulate-outage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulate provider outage drill to verify safe failover' })
  async simulateOutage(@Body() dto: SimulateOutageDto) {
    return this.monitoringService.simulateOutage(dto);
  }
}
