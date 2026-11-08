jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'dns/promises';
import { BadRequestException } from '@nestjs/common';
import { ExternalApiAdapter, ExternalProviderIntegrationConfig } from './adapters/external-api.adapter';

describe('ExternalApiAdapter documented REST contract', () => {
  const adapter = new ExternalApiAdapter();
  const originalFetch = global.fetch;
  const originalAllowlist = process.env.PROVIDER_ALLOWED_DOMAINS;

  const config: ExternalProviderIntegrationConfig = {
    baseUrl: 'https://api.provider.test/v1',
    providerCode: 'DOC_PROVIDER',
    timeoutMs: 5000,
    authentication: { type: 'BEARER', secret: 'test-only-secret' },
    endpoints: {
      submitOrder: {
        path: '/orders',
        method: 'POST',
        requestTemplate: {
          client_reference: '{{orderNumber}}',
          account_id: '{{playerFields.player_id}}',
          amount: '{{amount}}',
          currency: '{{currency}}',
        },
        responseMapping: {
          status: 'data.status',
          orderId: 'data.transaction_id',
        },
      },
    },
  };

  beforeEach(() => {
    process.env.PROVIDER_ALLOWED_DOMAINS = 'api.provider.test';
    (lookup as unknown as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ]);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => '64' },
      text: async () => JSON.stringify({ data: { status: 'SUCCESS', transaction_id: 'REMOTE-100' } }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAllowlist === undefined) delete process.env.PROVIDER_ALLOWED_DOMAINS;
    else process.env.PROVIDER_ALLOWED_DOMAINS = originalAllowlist;
    global.fetch = originalFetch;
  });

  it('joins endpoint paths under a base URL path and maps documented response fields', async () => {
    const result = await adapter.submitOrder({
      orderId: 'order-100',
      orderNumber: 'ORD-100',
      providerSku: 'SKU-100',
      playerFields: { player_id: '12345678' },
      amount: 25,
      currency: 'YER',
    } as any, config);

    expect(result.success).toBe(true);
    expect(result.status).toBe('SUCCESS');
    expect(result.providerOrderId).toBe('REMOTE-100');

    const fetchMock = global.fetch as unknown as jest.Mock;
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.provider.test/v1/orders');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-secret');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      client_reference: 'ORD-100',
      account_id: '12345678',
      amount: 25,
      currency: 'YER',
    });
  });

  it('fails closed when a documented host resolves to a private IP address', async () => {
    (lookup as unknown as jest.Mock).mockResolvedValue([
      { address: '10.10.0.5', family: 4 },
    ]);

    await expect(adapter.submitOrder({
      orderId: 'order-101',
      orderNumber: 'ORD-101',
      providerSku: 'SKU-100',
      playerFields: { player_id: '12345678' },
      amount: 25,
      currency: 'YER',
    } as any, config)).rejects.toThrow(BadRequestException);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects unsafe endpoint paths before saving an integration', () => {
    expect(() => adapter.validateIntegrationConfig({
      ...config,
      endpoints: { health: { path: '/../internal/metadata', method: 'GET' } },
    })).toThrow(BadRequestException);
  });

  it('keeps unknown provider statuses pending rather than converting them to success', async () => {
    (global.fetch as unknown as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => '40' },
      text: async () => JSON.stringify({ data: { status: 'ACCEPTED_FOR_PROCESSING', transaction_id: 'REMOTE-101' } }),
    });

    const result = await adapter.submitOrder({
      orderId: 'order-102',
      orderNumber: 'ORD-102',
      providerSku: 'SKU-100',
      playerFields: { player_id: '12345678' },
      amount: 25,
      currency: 'YER',
    } as any, config);

    expect(result.success).toBe(false);
    expect(result.status).toBe('PENDING');
  });
});
