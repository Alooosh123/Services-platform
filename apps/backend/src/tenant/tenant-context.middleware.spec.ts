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

  it('keeps unknown hostnames in the platform context rather than guessing a tenant', async () => {
    prisma.saaSTenant.findFirst.mockResolvedValue(null);
    const request: any = { hostname: 'unknown.example.test' };
    let callbackTenantId: string | null | undefined;
    const next = jest.fn(() => {
      callbackTenantId = getCurrentTenantId();
    });

    await middleware.use(request, {} as any, next);

    expect(request.tenantId).toBeNull();
    expect(request.tenant).toBeNull();
    expect(callbackTenantId).toBeNull();
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
