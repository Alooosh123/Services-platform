import { TooManyRequestsException, ServiceUnavailableException } from '@nestjs/common';
import { RedisRateLimitGuard } from './redis-rate-limit.guard';
import { RedisRateLimitOptions } from './rate-limit.decorator';

describe('RedisRateLimitGuard', () => {
  let options: RedisRateLimitOptions | undefined;
  let reflector: any;
  let store: any;
  let response: any;
  let guard: RedisRateLimitGuard;

  beforeEach(() => {
    options = { limit: 5, windowMs: 60_000, scope: 'auth-login' };
    reflector = {
      getAllAndOverride: jest.fn(() => options),
    };
    store = {
      incrementRateLimit: jest.fn().mockResolvedValue({ count: 1, ttlMs: 60_000 }),
    };
    response = { setHeader: jest.fn() };
    guard = new RedisRateLimitGuard(reflector, store);
  });

  const contextFor = (request: Record<string, any> = {}) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '203.0.113.10',
        header: () => undefined,
        user: undefined,
        ...request,
      }),
      getResponse: () => response,
    }),
  }) as any;

  it('allows a request below the configured limit and reports remaining quota', async () => {
    await expect(guard.canActivate(contextFor())).resolves.toBe(true);

    expect(store.incrementRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('auth-login'),
      60_000,
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
  });

  it('uses authenticated user identity when available', async () => {
    await guard.canActivate(contextFor({
      user: { id: 'user-123' },
      tenantId: 'tenant-456',
    }));

    expect(store.incrementRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('tenant-456:user:user-123'),
      60_000,
    );
  });

  it('blocks requests over the limit and sets Retry-After', async () => {
    store.incrementRateLimit.mockResolvedValue({ count: 6, ttlMs: 12_500 });

    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(TooManyRequestsException);

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '13');
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('fails closed when Redis rate-limit storage is unavailable', async () => {
    store.incrementRateLimit.mockRejectedValueOnce(
      new ServiceUnavailableException('Redis unavailable'),
    );

    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does nothing for routes without rate-limit metadata', async () => {
    options = undefined;

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(store.incrementRateLimit).not.toHaveBeenCalled();
  });
});
