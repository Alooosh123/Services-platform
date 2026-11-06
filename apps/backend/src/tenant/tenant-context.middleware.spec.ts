import { ServiceUnavailableException } from '@nestjs/common';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { getCurrentTenantId } from './tenant-context.store';

describe('TenantContextMiddleware', () => {
  let prisma: any;
  let middleware: TenantContextMiddleware;

  beforeEach(() => {
    prisma = {
      saaSTenant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tenant-alpha',
          slug: 'alpha',
          domain: 'alpha.example.test',
          customDomain: null,
        }),
      },
    };
    middleware = new TenantContextMiddleware(prisma);
  });

  it('resolves an active tenant domain and scopes the request callback', async () => {
    const request: any = { hostname: 'alpha.example.test' };
    let callbackTenantId: string | null = null;
    const next = jest.fn(() => {
      callbackTenantId = getCurrentTenantId();
    });

    await middleware.use(request, {} as any, next);

    expect(prisma.saaSTenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          OR: [{ domain: 'alpha.example.test' }, { customDomain: 'alpha.example.test' }],
        }),
      }),
    );
    expect(request.tenantId).toBe('tenant-alpha');
    expect(request.tenant.slug).toBe('alpha');
    expect(callbackTenantId).toBe('tenant-alpha');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('places unknown hostnames in an unresolved isolation context, not global scope', async () => {
    prisma.saaSTenant.findFirst.mockResolvedValue(null);
    const request: any = { hostname: 'unknown.example.test' };
    let callbackTenantId: string | null | undefined;
    const next = jest.fn(() => {
      callbackTenantId = getCurrentTenantId();
    });

    await middleware.use(request, {} as any, next);

    expect(request.tenantId).toBe('__UNRESOLVED_TENANT__');
    expect(request.tenant).toBeNull();
    expect(callbackTenantId).toBe('__UNRESOLVED_TENANT__');
  });

  it('uses global scope only for explicitly configured platform hosts', async () => {
    const previousHosts = process.env.PLATFORM_HOSTS;
    process.env.PLATFORM_HOSTS = 'admin.example.test,api.example.test';
    try {
      const request: any = { hostname: 'admin.example.test' };
      let callbackTenantId: string | null | undefined = '__unset__';
      const next = jest.fn(() => {
        callbackTenantId = getCurrentTenantId();
      });

      await middleware.use(request, {} as any, next);

      expect(prisma.saaSTenant.findFirst).not.toHaveBeenCalled();
      expect(request.tenantId).toBeNull();
      expect(callbackTenantId).toBeNull();
    } finally {
      if (previousHosts === undefined) delete process.env.PLATFORM_HOSTS;
      else process.env.PLATFORM_HOSTS = previousHosts;
    }
  });

  it('does not query the database for localhost development hosts', async () => {
    const request: any = { hostname: 'localhost' };
    let callbackTenantId: string | null | undefined;
    const next = jest.fn(() => {
      callbackTenantId = getCurrentTenantId();
    });

    await middleware.use(request, {} as any, next);

    expect(prisma.saaSTenant.findFirst).not.toHaveBeenCalled();
    expect(callbackTenantId).toBeNull();
  });

  it('fails closed when tenant-domain resolution cannot reach PostgreSQL', async () => {
    prisma.saaSTenant.findFirst.mockRejectedValue(new Error('database offline'));
    const next = jest.fn();

    await middleware.use({ hostname: 'alpha.example.test' } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(ServiceUnavailableException));
  });
});
