import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { Response } from 'express';
import { HealthStatus } from '@digital-topup/shared';

@ApiTags('System Health & Operations')
@Controller('health')
export class HealthController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  @ApiOperation({ summary: 'Get detailed system health status (Database, Redis, Queue, Memory)' })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async getHealth(@Res() res: Response) {
    const health = await this.monitoringService.getSystemHealth();
    const httpStatus =
      health.status === HealthStatus.UNHEALTHY
        ? HttpStatus.SERVICE_UNAVAILABLE
        : HttpStatus.OK;
    return res.status(httpStatus).json(health);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes/Container readiness check probe' })
  @ApiResponse({ status: 200, description: 'System is ready to accept traffic' })
  async getReadiness(@Res() res: Response) {
    const readyStatus = await this.monitoringService.getReadiness();
    if (!readyStatus.ready) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(readyStatus);
    }
    return res.status(HttpStatus.OK).json(readyStatus);
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kubernetes/Container liveness check probe' })
  getLiveness() {
    return { status: 'UP', timestamp: new Date().toISOString() };
  }
}
