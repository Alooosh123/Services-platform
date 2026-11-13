import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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

  async validatePlayer(_request: PlayerValidationRequest): Promise<PlayerValidationResponse> {
    return {
      isValid: false,
      errorMessage: 'لا يمكن التحقق من حساب اللاعب آلياً في مسار التنفيذ اليدوي؛ يجب على المشغل التحقق من بيانات الطلب.',
    };
  }

  async submitOrder(request: TopupProviderOrderRequest): Promise<TopupProviderOrderResponse> {
    this.logger.log(`Queueing order ${request.orderNumber || request.orderId} for manual fulfillment`);
    // This is an accepted work item, not a completed top-up. DB failure is fatal.
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
    return {
      success: true,
      status: 'PENDING',
      providerOrderId: `MANUAL-${request.orderId}`,
      rawResponse: { mode: 'MANUAL', acceptedForManualFulfillment: true },
    };
  }

  async checkOrderStatus(
    providerOrderId: string,
    internalOrderNumber: string,
  ): Promise<TopupProviderOrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: internalOrderNumber },
      include: { manualFulfillment: true },
    });
    if (!order?.manualFulfillment) {
      throw new ServiceUnavailableException('سجل التنفيذ اليدوي غير متاح في قاعدة البيانات.');
    }
    if (order.manualFulfillment.status === 'COMPLETED') {
      if (!order.manualFulfillment.proofVoucherCode) {
        return {
          success: false,
          status: 'PENDING',
          providerOrderId,
          errorCode: 'MANUAL_PROOF_MISSING',
          errorMessage: 'تم وضع التنفيذ يدوياً كمكتمل لكن إثبات/رمز التسليم غير موجود.',
        };
      }
      return {
        success: true,
        status: 'SUCCESS',
        pinCode: order.manualFulfillment.proofVoucherCode,
        providerOrderId,
      };
    }
    if (order.manualFulfillment.status === 'FAILED') {
      return {
        success: false,
        status: 'FAILED',
        providerOrderId,
        errorMessage: order.manualFulfillment.operatorNotes || 'فشل التنفيذ اليدوي.',
      };
    }
    return {
      success: false,
      status: 'PENDING',
      providerOrderId,
      errorMessage: 'الطلب ما زال في قائمة التنفيذ اليدوي.',
    };
  }

  async fetchBalance(): Promise<ProviderBalanceResponse> {
    throw new ServiceUnavailableException(
      'لا يوجد رصيد مزود آلي لمسار MANUAL؛ لا يجوز عرض رصيد ائتماني افتراضي.',
    );
  }
}
