import { ServiceUnavailableException } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ExternalApiAdapter } from './adapters/external-api.adapter';
import { ManualProviderAdapter } from './adapters/manual-provider.adapter';

describe('Provider adapter safety gates', () => {
  const providerOrder = {
    orderId: 'order-100',
    orderNumber: 'ORD-100',
    providerSku: 'SKU-100',
    playerFields: { player_id: '12345678' },
    amount: 10,
    currency: 'YER' as any,
  };

  it('fails closed when a provider code has no registered adapter', () => {
    const service = new ProvidersService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    expect(() => service.getAdapter('UNREGISTERED_PROVIDER')).toThrow(ServiceUnavailableException);
    expect(() => service.getAdapter('')).toThrow(ServiceUnavailableException);
  });

  it('rejects MOCK provider configuration outside automated tests', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const service = new ProvidersService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
      expect(() => service.getAdapter('MOCK')).toThrow(ServiceUnavailableException);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  describe('ExternalApiAdapter', () => {
    const adapter = new ExternalApiAdapter();

    it('does not report an unconfigured player validation as valid', async () => {
      const result = await adapter.validatePlayer({
        serviceId: 'service-100',
        fields: { player_id: '12345678' },
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toMatch(/Player validation API is not configured/);
    });

    it('routes unconfigured external submissions to manual review instead of returning success', async () => {
      const result = await adapter.submitOrder(providerOrder);

      expect(result.success).toBe(false);
      expect(result.status).toBe('PENDING');
      expect(result.errorCode).toBe('PROVIDER_API_NOT_CONFIGURED');
    });

    it('never fabricates a successful status for an unconfigured provider', async () => {
      const result = await adapter.checkOrderStatus('provider-tx-1', 'ORD-100');

      expect(result.success).toBe(false);
      expect(result.status).toBe('PENDING');
      expect(result.errorCode).toBe('PROVIDER_API_NOT_CONFIGURED');
    });

    it('does not publish a synthetic external balance', async () => {
      await expect(adapter.fetchBalance()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('ManualProviderAdapter', () => {
    it('acknowledges pending only after the manual queue record has been persisted', async () => {
      const prisma = {
        manualFulfillment: {
          upsert: jest.fn().mockResolvedValue({ orderId: 'order-100', status: 'PENDING' }),
        },
      };
      const adapter = new ManualProviderAdapter(prisma as any);

      const result = await adapter.submitOrder(providerOrder);

      expect(prisma.manualFulfillment.upsert).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.status).toBe('PENDING');
      expect(result.rawResponse).toEqual(expect.objectContaining({ persisted: true }));
    });

    it('does not claim the manual request was queued when persistence fails', async () => {
      const prisma = {
        manualFulfillment: {
          upsert: jest.fn().mockRejectedValue(new Error('database unavailable')),
        },
      };
      const adapter = new ManualProviderAdapter(prisma as any);

      await expect(adapter.submitOrder(providerOrder)).rejects.toThrow('database unavailable');
    });

    it('does not fabricate an automatic player validation result', async () => {
      const adapter = new ManualProviderAdapter({} as any);
      const result = await adapter.validatePlayer({
        serviceId: 'service-100',
        fields: { player_id: '12345678' },
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toMatch(/لا يدعم التحقق الآلي/);
    });
  });
});
