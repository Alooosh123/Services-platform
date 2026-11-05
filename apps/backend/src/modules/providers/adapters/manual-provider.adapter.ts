import { Injectable, Logger } from '@nestjs/common';
import { ITopupProviderAdapter } from './provider-adapter.interface';
import {
  PlayerValidationRequest,
  PlayerValidationResponse,
  TopupProviderOrderRequest,
  TopupProviderOrderResponse,
  ProviderBalanceResponse,
} from '@digital-topup/shared';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ManualProviderAdapter implements ITopupProviderAdapter {
  readonly providerCode = 'MANUAL';
  private readonly logger = new Logger(ManualProviderAdapter.name);

  constructor(private prisma: PrismaService) {}

  async validatePlayer(request: PlayerValidationRequest): Promise<PlayerValidationResponse> {
    const playerId = request.fields?.player_id || request.fields?.userId;
    if (!playerId) {
      return { isValid: false, errorMessage: 'معرف اللاعب مطلوب للتنفيذ اليدوي' };
    }
    return {
      isValid: true,
      playerName: `Player_${playerId.slice(-4)}`,
      zoneName: request.fields?.zone_id || 'Server-1',
    };
  }

  async submitOrder(request: TopupProviderOrderRequest): Promise<TopupProviderOrderResponse> {
    this.logger.log(`Enqueueing order ${request.orderNumber || request.orderId} for Manual Operator Fulfillment`);

    try {
      // Upsert manual fulfillment record
      await this.prisma.manualFulfillment.upsert({
        where: { orderId: request.orderId },
        update: {
          status: 'PENDING',
          operatorNotes: 'بانتظار تخصيص مشغل التنفيذ اليدوي',
        },
        create: {
          orderId: request.orderId,
          status: 'PENDING',
          operatorNotes: 'بانتظار تخصيص مشغل التنفيذ اليدوي',
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not create ManualFulfillment record in DB: ${err?.message}`);
    }

    return {
      success: true,
      status: 'PENDING',
      providerOrderId: `MANUAL-${Date.now()}`,
      rawResponse: {
        mode: 'MANUAL',
        enqueuedAt: new Date().toISOString(),
      },
    };
  }

  async checkOrderStatus(
    providerOrderId: string,
    internalOrderNumber: string,
  ): Promise<TopupProviderOrderResponse> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { orderNumber: internalOrderNumber },
        include: { manualFulfillment: true },
      });

      if (order?.manualFulfillment?.status === 'COMPLETED') {
        return {
          success: true,
          status: 'SUCCESS',
          pinCode: order.manualFulfillment.proofVoucherCode || undefined,
          providerOrderId,
        };
      }
    } catch {}

    return {
      success: true,
      status: 'PENDING',
      providerOrderId,
    };
  }

  async fetchBalance(): Promise<ProviderBalanceResponse> {
    return {
      currency: 'USD',
      balance: 999999, // Manual fulfillment queue has unlimited virtual credit
      provider: 'MANUAL',
      lastUpdated: new Date().toISOString(),
    };
  }
}
