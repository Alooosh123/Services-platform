import {
  PlayerValidationRequest,
  PlayerValidationResponse,
  TopupProviderOrderRequest,
  TopupProviderOrderResponse,
  ProviderBalanceResponse,
} from '@digital-topup/shared';

export interface ITopupProviderAdapter {
  readonly providerCode: string;

  validatePlayer(request: PlayerValidationRequest): Promise<PlayerValidationResponse>;

  submitOrder(request: TopupProviderOrderRequest): Promise<TopupProviderOrderResponse>;

  checkOrderStatus(
    providerOrderId: string,
    internalOrderNumber: string,
  ): Promise<TopupProviderOrderResponse>;

  fetchBalance(): Promise<ProviderBalanceResponse>;
}
