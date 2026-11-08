import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ITopupProviderAdapter } from './provider-adapter.interface';
import {
  PlayerValidationRequest, PlayerValidationResponse, TopupProviderOrderRequest,
  TopupProviderOrderResponse, ProviderBalanceResponse, CurrencyCode,
} from '@digital-topup/shared';
import { SsrfValidator } from '../utils/ssrf-validator.util';

type HttpMethod = 'GET' | 'POST';
type EndpointConfig = {
  path: string;
  method?: HttpMethod;
  requestTemplate?: Record<string, unknown>;
};
export type ExternalProviderIntegrationConfig = {
  baseUrl: string;
  timeoutMs?: number;
  providerCode: string;
  authentication?: {
    type: 'NONE' | 'BEARER' | 'API_KEY_HEADER';
    secret?: string;
    headerName?: string;
  };
  endpoints: {
    health?: EndpointConfig;
    balance?: EndpointConfig & { responseMapping?: { balance?: string; currency?: string } };
    validatePlayer?: EndpointConfig & { responseMapping?: { valid?: string; playerName?: string; zoneName?: string; errorMessage?: string } };
    submitOrder?: EndpointConfig & { responseMapping?: { status?: string; orderId?: string; serialNumber?: string; pinCode?: string; errorMessage?: string; errorCode?: string } };
    checkOrderStatus?: EndpointConfig & { responseMapping?: { status?: string; orderId?: string; serialNumber?: string; pinCode?: string; errorMessage?: string; errorCode?: string } };
  };
};

@Injectable()
export class ExternalApiAdapter implements ITopupProviderAdapter {
  readonly providerCode = 'EXTERNAL_API';
  private readonly logger = new Logger(ExternalApiAdapter.name);
  private readonly maxResponseBytes = 64 * 1024;

  validateEndpoint(url: string): URL {
    return SsrfValidator.validateUrl(url, true);
  }

  private validateConfig(config: ExternalProviderIntegrationConfig): URL {
    if (!config || !config.baseUrl || !config.endpoints) {
      throw new ServiceUnavailableException('Provider integration configuration is incomplete.');
    }
    const base = this.validateEndpoint(config.baseUrl);
    if (base.username || base.password || base.search || base.hash) {
      throw new BadRequestException('Provider base URL must not contain credentials, query strings, or fragments.');
    }
    for (const endpoint of Object.values(config.endpoints)) {
      if (!endpoint) continue;
      if (!endpoint.path || !endpoint.path.startsWith('/') || endpoint.path.startsWith('//') ||
          endpoint.path.includes('..') || endpoint.path.includes('://')) {
        throw new BadRequestException('Provider endpoint paths must be safe relative paths beginning with a single slash.');
      }
      if (endpoint.method && !['GET', 'POST'].includes(endpoint.method)) {
        throw new BadRequestException('Only GET and POST methods are supported by the external provider adapter.');
      }
    }
    const auth = config.authentication || { type: 'NONE' as const };
    if (auth.type !== 'NONE' && !auth.secret) {
      throw new ServiceUnavailableException('Provider authentication secret is not configured.');
    }
    if (auth.type === 'API_KEY_HEADER' && (!auth.headerName || !/^[A-Za-z0-9-]{1,64}$/.test(auth.headerName))) {
      throw new BadRequestException('A valid API key header name is required.');
    }
    return base;
  }

  private valueAt(object: any, path?: string): any {
    if (!path) return undefined;
    return path.split('.').reduce((value, part) => value == null ? undefined : value[part], object);
  }

  private render(value: any, context: Record<string, unknown>): any {
    if (typeof value === 'string') {
      const match = value.match(/^\{\{\s*([A-Za-z0-9_.]+)\s*\}\}$/);
      if (match) return this.valueAt(context, match[1]);
      return value.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_m, key) => {
        const replacement = this.valueAt(context, key);
        return replacement == null ? '' : String(replacement);
      });
    }
    if (Array.isArray(value)) return value.map((item) => this.render(item, context));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.render(item, context)]));
    }
    return value;
  }

  private async requestJson(
    config: ExternalProviderIntegrationConfig,
    endpoint: EndpointConfig,
    context: Record<string, unknown>,
  ): Promise<{ data: any; status: number; elapsedMs: number }> {
    const base = this.validateConfig(config);
    const url = new URL(endpoint.path, base.toString().endsWith('/') ? base : base.toString() + '/');
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/')) {
      throw new BadRequestException('Provider endpoint escaped its configured base path.');
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    const auth = config.authentication || { type: 'NONE' as const };
    if (auth.type === 'BEARER') headers.Authorization = 'Bearer ' + auth.secret;
    if (auth.type === 'API_KEY_HEADER') headers[auth.headerName!] = auth.secret!;
    const method = endpoint.method || 'POST';
    const body = method === 'GET' ? undefined : JSON.stringify(this.render(endpoint.requestTemplate || {}, context));
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Math.min(config.timeoutMs || 10000, 30000)));
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method, headers, body, signal: controller.signal, redirect: 'manual',
      });
      if (response.status >= 300 && response.status < 400) {
        throw new ServiceUnavailableException('Provider redirects are not followed; configure the documented final endpoint.');
      }
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > this.maxResponseBytes) throw new ServiceUnavailableException('Provider response exceeded the configured size limit.');
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > this.maxResponseBytes) {
        throw new ServiceUnavailableException('Provider response exceeded the configured size limit.');
      }
      let data: any;
      try { data = text ? JSON.parse(text) : {}; }
      catch { throw new ServiceUnavailableException('Provider returned a non-JSON response; manual review is required.'); }
      if (!response.ok) {
        this.logger.warn('Provider HTTP request rejected with status ' + response.status + ' (' + config.providerCode + ').');
        throw new ServiceUnavailableException('Provider rejected the API request with HTTP ' + response.status + '.');
      }
      return { data, status: response.status, elapsedMs: Date.now() - started };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('Provider API result is unknown for ' + config.providerCode + ': ' + (error?.name || 'network error'));
      throw new ServiceUnavailableException('Provider API outcome is unknown; keep the order on hold for reconciliation.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private canonicalStatus(raw: unknown): 'SUCCESS' | 'PENDING' | 'FAILED' {
    const value = String(raw || '').trim().toUpperCase();
    if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'FULFILLED', 'DONE'].includes(value)) return 'SUCCESS';
    if (['FAILED', 'FAILURE', 'REJECTED', 'CANCELLED', 'ERROR'].includes(value)) return 'FAILED';
    return 'PENDING';
  }

  async validatePlayer(request: PlayerValidationRequest, config?: ExternalProviderIntegrationConfig): Promise<PlayerValidationResponse> {
    if (!config?.endpoints?.validatePlayer) {
      return { isValid: false, errorMessage: 'Player validation API is not configured from the provider documentation.' };
    }
    const { data } = await this.requestJson(config, config.endpoints.validatePlayer, {
      serviceId: request.serviceId, fields: request.fields || {},
    });
    const mapping = config.endpoints.validatePlayer.responseMapping || {};
    const valid = this.valueAt(data, mapping.valid || 'valid');
    if (typeof valid !== 'boolean') {
      return { isValid: false, errorMessage: 'Provider validation response did not include a documented boolean validity field.' };
    }
    return {
      isValid: valid,
      playerName: this.valueAt(data, mapping.playerName || 'playerName'),
      zoneName: this.valueAt(data, mapping.zoneName || 'zoneName'),
      errorMessage: this.valueAt(data, mapping.errorMessage || 'errorMessage'),
      rawResponse: { httpStatus: 200, mapped: true },
    };
  }

  async submitOrder(request: TopupProviderOrderRequest, config?: ExternalProviderIntegrationConfig): Promise<TopupProviderOrderResponse> {
    if (!config?.endpoints?.submitOrder) {
      return {
        success: false, status: 'PENDING', errorCode: 'PROVIDER_API_NOT_CONFIGURED',
        errorMessage: 'Documented order submission endpoint is not configured; order remains pending.',
      };
    }
    const { data } = await this.requestJson(config, config.endpoints.submitOrder, {
      orderId: request.orderId, orderNumber: request.orderNumber, serviceId: request.serviceId,
      providerSku: request.providerSku, playerFields: request.playerFields,
      amount: request.amount, currency: request.currency,
    });
    const mapping = config.endpoints.submitOrder.responseMapping || {};
    const status = this.canonicalStatus(this.valueAt(data, mapping.status || 'status'));
    const providerOrderId = this.valueAt(data, mapping.orderId || 'orderId');
    if (status === 'SUCCESS' && (!providerOrderId || typeof providerOrderId !== 'string')) {
      return { success: false, status: 'PENDING', errorCode: 'PROVIDER_RESPONSE_INCOMPLETE', errorMessage: 'Provider response did not include a transaction ID; fulfillment remains pending.' };
    }
    return {
      success: status === 'SUCCESS', status,
      providerOrderId: typeof providerOrderId === 'string' ? providerOrderId : undefined,
      serialNumber: this.valueAt(data, mapping.serialNumber || 'serialNumber'),
      pinCode: this.valueAt(data, mapping.pinCode || 'pinCode'),
      errorMessage: this.valueAt(data, mapping.errorMessage || 'message'),
      errorCode: this.valueAt(data, mapping.errorCode || 'code'),
      rawResponse: { httpStatus: 200, responseMapped: true },
    };
  }

  async checkOrderStatus(providerOrderId: string, internalOrderNumber: string, config?: ExternalProviderIntegrationConfig): Promise<TopupProviderOrderResponse> {
    if (!config?.endpoints?.checkOrderStatus) {
      return { success: false, status: 'PENDING', providerOrderId, errorCode: 'PROVIDER_API_NOT_CONFIGURED', errorMessage: 'Order status endpoint is not configured; reconciliation is required.' };
    }
    const { data } = await this.requestJson(config, config.endpoints.checkOrderStatus, { providerOrderId, internalOrderNumber });
    const mapping = config.endpoints.checkOrderStatus.responseMapping || {};
    const status = this.canonicalStatus(this.valueAt(data, mapping.status || 'status'));
    const returnedId = this.valueAt(data, mapping.orderId || 'orderId') || providerOrderId;
    return {
      success: status === 'SUCCESS', status,
      providerOrderId: typeof returnedId === 'string' ? returnedId : providerOrderId,
      serialNumber: this.valueAt(data, mapping.serialNumber || 'serialNumber'),
      pinCode: this.valueAt(data, mapping.pinCode || 'pinCode'),
      errorMessage: this.valueAt(data, mapping.errorMessage || 'message'),
      errorCode: this.valueAt(data, mapping.errorCode || 'code'),
      rawResponse: { httpStatus: 200, responseMapped: true },
    };
  }

  async fetchBalance(config?: ExternalProviderIntegrationConfig): Promise<ProviderBalanceResponse> {
    if (!config?.endpoints?.balance) {
      throw new ServiceUnavailableException('Provider balance endpoint is not configured from official documentation.');
    }
    const { data } = await this.requestJson(config, config.endpoints.balance, {});
    const mapping = config.endpoints.balance.responseMapping || {};
    const balance = Number(this.valueAt(data, mapping.balance || 'balance'));
    const currency = String(this.valueAt(data, mapping.currency || 'currency') || '').toUpperCase();
    if (!Number.isFinite(balance) || balance < 0 || !['YER', 'USD', 'SAR'].includes(currency)) {
      throw new ServiceUnavailableException('Provider balance response did not match configured currency and numeric balance mappings.');
    }
    return { provider: config.providerCode, balance, currency, lastUpdated: new Date().toISOString() };
  }

  async testConnection(config: ExternalProviderIntegrationConfig) {
    if (config.endpoints?.health) {
      const result = await this.requestJson(config, config.endpoints.health, {});
      return { status: 'ONLINE', httpStatus: result.status, latencyMs: result.elapsedMs };
    }
    if (config.endpoints?.balance) {
      const started = Date.now();
      const balance = await this.fetchBalance(config);
      return { status: 'ONLINE', latencyMs: Date.now() - started, balance };
    }
    throw new ServiceUnavailableException('Configure a documented health or balance endpoint before running a connection test.');
  }
}
