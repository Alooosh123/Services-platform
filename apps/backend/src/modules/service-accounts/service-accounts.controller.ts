import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceAccountsService } from './service-accounts.service';
import { CreateServiceAccountDto } from './dto/create-service-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Service Accounts & Consent (Customer)')
@Controller('service-accounts')
export class ServiceAccountsController {
  constructor(private readonly serviceAccountsService: ServiceAccountsService) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Public: Query supported service capabilities matrix and disclaimers' })
  @ApiResponse({ status: 200, description: 'List of services, link methods, and official disclaimers' })
  async getCapabilities() {
    return this.serviceAccountsService.getCapabilities();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer: List all active linked service accounts' })
  @ApiResponse({ status: 200, description: 'List of linked accounts with verification statuses' })
  async getMyAccounts(@CurrentUser('id') userId: string) {
    return this.serviceAccountsService.getMyAccounts(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Customer: Link a new service account with explicit consent' })
  @ApiResponse({ status: 201, description: 'Service account linked with explicit consent receipt' })
  async linkAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateServiceAccountDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const ua = req.headers?.['user-agent'] || 'Web-Client';
    return this.serviceAccountsService.linkAccount(userId, dto, ip, ua);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer: Unlink service account and revoke consent' })
  @ApiResponse({ status: 200, description: 'Account unlinked and consent revoked' })
  async unlinkAccount(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
  ) {
    return this.serviceAccountsService.unlinkAccount(userId, accountId);
  }

  @Post(':id/evaluate-risk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer/Admin: Run AI explainable risk evaluation on account' })
  async evaluateRisk(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
  ) {
    return this.serviceAccountsService.evaluateAccountRisk(userId, accountId);
  }
}
