import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ITopupProviderAdapter } from './provider-adapter.interface';
import {
  PlayerValidationRequest,
  PlayerValidationResponse,
  TopupProviderOrderRequest,
  TopupProviderOrderResponse,
  ProviderBalanceResponse,
} from '@digital-topup/shared';
import { SsrfValidator } from '../utils/ssrf-validator.util';

@Injectable()
export class ExternalApiAdapter implements ITopupProviderAdapter {
  readonly providerCode = 'EXTERNAL_API';
  private readonly logger = new Logger(ExternalApiAdapter.name);

  /**
   * Validates target HTTP endpoint against SSRF attacks before dispatch (SG-04).
   */
  validateEndpoint(url: string, enforceAllowlist = false): URL {
    return SsrfValidator.validateUrl(url, enforceAllowlist);
  }

  async validatePlayer(request: PlayerValidationRequest, targetUrl?: string): Promise<PlayerValidationResponse> {
    if (targetUrl) {
      this.validateEndpoint(targetUrl);
    }
    const playerId = request.fields?.player_id || request.fields?.userId;
    if (!playerId) {
      return { isValid: false, errorMessage: 'معرف اللاعب مطلوب' };
    }
    return {
      isValid: false,
      errorMessage: 'لم يتم ربط واجهة تحقق فعلية بهذا المزود؛ لم يتم التحقق من الحساب.',
    };
  }

  async submitOrder(request: TopupProviderOrderRequest, targetUrl?: string): Promise<TopupProviderOrderResponse> {
    if (targetUrl) {
      this.validateEndpoint(targetUrl);
    }

    this.logger.error(
      `External provider ${this.providerCode} is not wired to a real HTTP API. Order ${request.orderNumber} is held for manual review.`,
    );
    return {
      success: false,
      status: 'PENDING',
      errorMessage: 'لم يتم إعداد اتصال API فعلي لهذا المزود. تم إيقاف الإرسال الآلي وتحويل الطلب للمراجعة اليدوية.',
      errorCode: 'PROVIDER_API_NOT_CONFIGURED',
      rawResponse: { adapterConfigured: false },
    };
  }

  async checkOrderStatus(
    providerOrderId: string,
    internalOrderNumber: string,
    targetUrl?: string,
  ): Promise<TopupProviderOrderResponse> {
    if (targetUrl) {
      this.validateEndpoint(targetUrl);
    }
    return {
      success: false,
      status: 'PENDING',
      providerOrderId,
      errorMessage: 'لا يمكن الاستعلام من المزود قبل إعداد نقطة API فعلية.',
      errorCode: 'PROVIDER_API_NOT_CONFIGURED',
    };
  }

  async fetchBalance(targetUrl?: string): Promise<ProviderBalanceResponse> {
    if (targetUrl) {
      this.validateEndpoint(targetUrl);
    }
    throw new ServiceUnavailableException(
      'لا يمكن عرض رصيد مزود خارجي قبل إعداد اتصال API فعلي وموثق.',
    );
  }
}
