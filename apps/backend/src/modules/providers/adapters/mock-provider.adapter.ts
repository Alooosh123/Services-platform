import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ITopupProviderAdapter } from './provider-adapter.interface';
import {
  PlayerValidationRequest,
  PlayerValidationResponse,
  TopupProviderOrderRequest,
  TopupProviderOrderResponse,
  ProviderBalanceResponse,
} from '@digital-topup/shared';

@Injectable()
export class MockProviderAdapter implements ITopupProviderAdapter {
  readonly providerCode = 'MOCK';
  readonly isSandboxOnly = true;
  private readonly logger = new Logger(MockProviderAdapter.name);

  private assertTestOnly(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new ForbiddenException(
        'محول المحاكاة متاح للاختبارات الآلية فقط، ولا يجوز استخدامه في development أو staging أو production.',
      );
    }
  }

  async validatePlayer(request: PlayerValidationRequest): Promise<PlayerValidationResponse> {
    this.assertTestOnly();

    const playerId = request.fields?.player_id || request.fields?.userId;

    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (playerId?.startsWith('999')) {
      return {
        isValid: false,
        errorMessage: 'Player account not found on target server (Simulated)',
      };
    }

    return {
      isValid: true,
      playerName: `Gamer_${playerId?.slice(-4) || 'Pro'}`,
      zoneName: request.fields?.zone_id ? `Zone_${request.fields.zone_id}` : 'Global Server',
      rawResponse: {
        status: 200,
        characterLevel: 68,
        region: 'MENA',
      },
    };
  }

  async submitOrder(request: TopupProviderOrderRequest): Promise<TopupProviderOrderResponse> {
    this.assertTestOnly();

    this.logger.log(`Executing Mock Provider Topup for Order: ${request.orderNumber}`);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const playerId = request.playerFields?.player_id || '';

    // Test Case: Simulated Failure
    if (playerId.startsWith('999')) {
      return {
        success: false,
        status: 'FAILED',
        errorMessage: 'Provider rejected: Player account is banned or invalid ID',
        errorCode: 'ERR_ACCOUNT_INVALID',
        rawResponse: { simulated: true, code: 4001 },
      };
    }

    // Test Case: Simulated Pending Queue (for testing webhook / async checks)
    if (playerId.startsWith('888')) {
      return {
        success: true,
        status: 'PENDING',
        providerOrderId: `MOCK-PENDING-${Date.now()}`,
        rawResponse: { simulated: true, code: 1002, message: 'Processing in queue' },
      };
    }

    // Default: Immediate Success
    return {
      success: true,
      status: 'SUCCESS',
      providerOrderId: `MOCK-TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      pinCode: request.providerSku.includes('GP-') ? `GPLAY-${Math.random().toString(36).substring(2, 12).toUpperCase()}` : undefined,
      serialNumber: `SN${Date.now()}`,
      rawResponse: {
        simulated: true,
        fulfillmentTime: new Date().toISOString(),
        deliveredUnits: request.providerSku,
      },
    };
  }

  async checkOrderStatus(
    providerOrderId: string,
    internalOrderNumber: string,
  ): Promise<TopupProviderOrderResponse> {
    this.assertTestOnly();

    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      status: 'SUCCESS',
      providerOrderId,
      rawResponse: {
        settled: true,
        reconciledAt: new Date().toISOString(),
      },
    };
  }

  async fetchBalance(): Promise<ProviderBalanceResponse> {
    this.assertTestOnly();

    return {
      currency: 'USD',
      balance: 9999.0,
      provider: 'MOCK',
      lastUpdated: new Date().toISOString(),
    };
  }
}
