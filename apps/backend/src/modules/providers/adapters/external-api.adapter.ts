import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ITopupProviderAdapter } from './provider-adapter.interface';
import {
  PlayerValidationRequest,
  PlayerValidationResponse,
  TopupProviderOrderRequest,
  TopupProviderOrderResponse,
  ProviderBalanceResponse,
} from '@digital-topup/shared';

/**
 * Fail-closed placeholder. A generic URL/API key cannot safely represent the
 * different authentication, signatures, request formats, idempotency and
 * webhook rules of real top-up providers. Add a provider-specific adapter only
 * after reviewing its official documentation and testing against its sandbox.
 */
@Injectable()
export class ExternalApiAdapter implements ITopupProviderAdapter {
  readonly providerCode = 'EXTERNAL_API';

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'التكامل الخارجي غير مكتمل. يلزم محول خاص بالمزود وفق وثائقه الرسمية قبل تنفيذ العمليات.',
    );
  }

  async validatePlayer(_request: PlayerValidationRequest): Promise<PlayerValidationResponse> {
    return {
      isValid: false,
      errorMessage: 'التحقق من الحساب غير متاح: لم يتم إعداد تكامل رسمي مع هذا المزود.',
    };
  }

  async submitOrder(_request: TopupProviderOrderRequest): Promise<TopupProviderOrderResponse> {
    return {
      success: false,
      status: 'PENDING',
      errorCode: 'PROVIDER_INTEGRATION_NOT_CONFIGURED',
      errorMessage: 'تم إيقاف الإرسال الآلي؛ لا توجد وثائق ومصادقة رسمية معتمدة لهذا المزود.',
    };
  }

  async checkOrderStatus(
    _providerOrderId: string,
    _internalOrderNumber: string,
  ): Promise<TopupProviderOrderResponse> {
    throw this.unavailable();
  }

  async fetchBalance(): Promise<ProviderBalanceResponse> {
    throw this.unavailable();
  }
}
