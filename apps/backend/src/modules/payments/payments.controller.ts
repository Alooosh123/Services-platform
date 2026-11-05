import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { CreateCardTopupDto, CreateUsdtTopupDto } from './dto/create-global-topup.dto';
import { PaymentsService } from './payments.service';
import { PaymentChannelCode } from '@digital-topup/shared';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Global Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('topups/card')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createCardTopup(@CurrentUser('id') userId: string, @Body() dto: CreateCardTopupDto) {
    return this.paymentsService.createCardTopup(userId, dto);
  }

  @Post('topups/usdt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createUsdtTopup(@CurrentUser('id') userId: string, @Body() dto: CreateUsdtTopupDto) {
    return this.paymentsService.createUsdtTopup(userId, dto);
  }

  @Get(':paymentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPayment(@CurrentUser('id') userId: string, @Param('paymentId') paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: {
        id: true,
        amount: true,
        currency: true,
        providerCurrency: true,
        providerAmount: true,
        feeAmount: true,
        status: true,
        confirmedAt: true,
        createdAt: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment was not found.');
    return payment;
  }

  @Post('webhooks/stripe')
  handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.paymentsService.handleStripeWebhook(request.rawBody, signature);
  }

  @Post('webhooks/usdt/:network')
  handleUsdtWebhook(
    @Param('network') network: string,
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-webhook-timestamp') timestamp?: string,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    if (network !== PaymentChannelCode.USDT_TRC20 && network !== PaymentChannelCode.USDT_BEP20) {
      throw new NotFoundException('USDT network is not supported.');
    }
    return this.paymentsService.handleUsdtWebhook(
      network,
      request.rawBody,
      timestamp,
      signature,
    );
  }
}
