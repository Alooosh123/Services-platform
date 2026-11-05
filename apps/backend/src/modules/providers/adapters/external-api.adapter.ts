import { Injectable, Logger } from '@nestjs/common';
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
      isValid: true,
      playerName: `ExtUser_${playerId.slice(-4)}`,
      zoneName: request.fields?.zone_id,
    };
  }

  async submitOrder(request: TopupProviderOrderRequest, targetUrl?: string): Promise<TopupProviderOrderResponse> {
    this.logger.log(`Dispatching order ${request.orderNumber} to External API Provider`);

    try {
      if (targetUrl) {
        this.validateEndpoint(targetUrl);
      }

      const playerId = request.playerFields?.player_id || '';

      // Test Case: Timeout simulation (player_id starts with '777')
      if (playerId.startsWith('777')) {
        return {
          success: false,
          status: 'PENDING',
          errorMessage: 'Provider gateway timeout (15000ms exceeded). Order moved to Manual Review.',
          errorCode: 'ERR_GATEWAY_TIMEOUT',
        };
      }

      // Test Case: Hard failure (player_id starts with '999')
      if (playerId.startsWith('999')) {
        return {
          success: false,
          status: 'FAILED',
          errorMessage: 'External API rejected: User does not exist or region mismatch',
          errorCode: 'ERR_ACCOUNT_NOT_FOUND',
        };
      }

      // Successful dispatch
      return {
        success: true,
        status: 'SUCCESS',
        providerOrderId: `EXT-TX-${Date.now()}`,
        pinCode: request.providerSku.includes('VOUCHER') ? `VOUCH-${Math.random().toString(36).substring(2, 10).toUpperCase()}` : undefined,
        serialNumber: `SN-EXT-${Date.now()}`,
        rawResponse: {
          statusCode: 200,
          providerStatus: 'DELIVERED',
        },
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        errorMessage: err?.message || 'External API connection failed',
      };
    }
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
      success: true,
      status: 'SUCCESS',
      providerOrderId,
      rawResponse: { checkedAt: new Date().toISOString() },
    };
  }

  async fetchBalance(targetUrl?: string): Promise<ProviderBalanceResponse> {
    if (targetUrl) {
      this.validateEndpoint(targetUrl);
    }

    return {
      currency: 'USD',
      balance: 1450.5,
      provider: 'EXTERNAL_API',
      lastUpdated: new Date().toISOString(),
    };
  }
}
