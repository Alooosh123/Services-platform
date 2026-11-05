import { Controller, Get, Post, Body, Param, UseGuards, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Deposits (Customer)')
@Controller('deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get('channels')
  @ApiOperation({ summary: 'Get active Yemeni payment channels & official receiver accounts' })
  @ApiResponse({ status: 200, description: 'List of payment channels with transfer instructions' })
  async getPaymentChannels() {
    return this.depositsService.getPaymentChannels();
  }

  @Post('request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a new deposit transfer request (Status: PENDING)' })
  @ApiResponse({ status: 201, description: 'Deposit request created and queued for review' })
  async createDeposit(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDepositDto,
  ): Promise<any> {
    return this.depositsService.createDepositRequest(userId, dto);
  }

  @Get('my-deposits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all deposit requests and statuses for current customer' })
  async getMyDeposits(@CurrentUser('id') userId: string): Promise<any> {
    return this.depositsService.getCustomerDeposits(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get single deposit details and timeline' })
  async getDeposit(
    @CurrentUser('id') userId: string,
    @Param('id') depositId: string,
  ): Promise<any> {
    return this.depositsService.getDepositById(depositId, userId, false);
  }

  @Post('webhook/:channel')
  @ApiOperation({ summary: 'Inbound payment notification webhook from provider/channel' })
  @ApiResponse({ status: 200, description: 'Webhook received and processed idempotently' })
  async handleWebhook(
    @Param('channel') channel: string,
    @Body() payload: any,
    @Headers('x-webhook-signature') signature?: string,
    @Headers('x-webhook-timestamp') timestamp?: string,
    @Req() request?: RawBodyRequest<Request>,
  ) {
    return this.depositsService.handleInboundWebhook(
      channel.toUpperCase() as any,
      payload,
      signature,
      timestamp,
      request?.rawBody,
    );
  }
}
