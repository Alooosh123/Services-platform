import { PrismaService } from './prisma.service';
import {
  runWithTenantContext,
  runWithTenantResolverContext,
  setPlatformAdminContext,
} from '../tenant/tenant-context.store';

describe('PrismaService tenant query scope', () => {
  let prisma: PrismaService;
  let middleware: (params: any, next: (params: any) => Promise<any>) => Promise<any>;

  beforeEach(() => {
    prisma = new PrismaService();
    jest.spyOn(prisma, '$use').mockImplementation(((fn: any) => {
      middleware = fn;
      return prisma;
    }) as any);
    (prisma as any).installTenantQueryScope();
  });

  afterEach(async () => {
    await prisma.$disconnect();
    jest.restoreAllMocks();
  });

  it('adds tenantId to ledger writes and filters ledger reads', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      const createParams: any = {
        model: 'LedgerTransaction',
        action: 'create',
        args: { data: { txNumber: 'LTX-1' } },
      };
      await middleware(createParams, async (params) => params);
      expect(createParams.args.data.tenantId).toBe('tenant-alpha');

      const readParams: any = {
        model: 'LedgerTransaction',
        action: 'findUnique',
        args: { where: { id: 'transaction-alpha' } },
      };
      await middleware(readParams, async (params) => params);
      expect(readParams.args.where).toEqual({
        id: 'transaction-alpha',
        AND: [{ tenantId: 'tenant-alpha' }],
      });
    });
  });

  it('adds mandatory relation filters to user-owned records', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      const params: any = {
        model: 'Wallet',
        action: 'findMany',
        args: { where: { currency: 'YER' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({
        currency: 'YER',
        AND: [{ user: { is: { tenantId: 'tenant-alpha' } } }],
      });
    });
  });

  it('stamps newly created users with the active tenant', async () => {
    await runWithTenantContext('tenant-beta', async () => {
      const params: any = {
        model: 'User',
        action: 'create',
        args: { data: { email: 'customer@example.test' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.data.tenantId).toBe('tenant-beta');
    });
  });

  it('scopes tenant product price rows and nested product price includes', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      const directParams: any = {
        model: 'ProductPrice',
        action: 'create',
        args: { data: { productId: 'product-1', currency: 'YER' } },
      };
      await middleware(directParams, async (value) => value);
      expect(directParams.args.data.tenantId).toBe('tenant-alpha');

      const productParams: any = {
        model: 'Product',
        action: 'findMany',
        args: { include: { prices: true, tierPrices: true, productPrices: { _count: true }, agentPrices: true } },
      };
      await middleware(productParams, async (value) => value);
      expect(productParams.args.include.prices).toEqual({
        where: { AND: [{ tenantId: 'tenant-alpha' }] },
      });
      expect(productParams.args.include.tierPrices).toEqual({
        where: { AND: [{ tenantId: 'tenant-alpha' }] },
      });
      expect(productParams.args.include.productPrices).toEqual({
        _count: true,
        where: { AND: [{ tenantId: 'tenant-alpha' }] },
      });
      expect(productParams.args.include.agentPrices).toEqual({
        where: { AND: [{ subAgent: { is: { tenantId: 'tenant-alpha' } } }] },
      });
    });
  });

  it('scopes bulk deletes even when a caller omits a where clause', async () => {
    await runWithTenantContext('tenant-beta', async () => {
      const params: any = {
        model: 'LedgerEntry',
        action: 'deleteMany',
        args: {},
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({ tenantId: 'tenant-beta' });
    });
  });

  it('restricts unverified platform-host requests to platform-owned ledger rows', async () => {
    await runWithTenantContext(null, async () => {
      const params: any = {
        model: 'LedgerTransaction',
        action: 'findMany',
        args: {},
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({ tenantId: null });
    });
  });

  it('restricts wallet relation queries to platform-owned users without a tenant context', async () => {
    await runWithTenantContext(null, async () => {
      const params: any = {
        model: 'Wallet',
        action: 'findMany',
        args: { where: { currency: 'YER' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({
        currency: 'YER',
        AND: [{ user: { is: { tenantId: null } } }],
      });
    });
  });

  it('allows cross-tenant ledger reads only in an authenticated platform-admin context', async () => {
    await runWithTenantContext(null, async () => {
      setPlatformAdminContext(true);
      const params: any = {
        model: 'LedgerTransaction',
        action: 'findMany',
        args: { where: { status: 'POSTED' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({ status: 'POSTED' });
    });
  });

  it('allows the trusted domain resolver to look up an active tenant before request scoping', async () => {
    await runWithTenantResolverContext(async () => {
      const params: any = {
        model: 'SaaSTenant',
        action: 'findFirst',
        args: { where: { domain: 'alpha.example.test', status: 'ACTIVE' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({ domain: 'alpha.example.test', status: 'ACTIVE' });
    });
  });

  it('does not expose SaaS tenant metadata from a platform request without an admin role', async () => {
    await runWithTenantContext(null, async () => {
      const params: any = {
        model: 'SaaSTenant',
        action: 'findMany',
        args: { where: { status: 'ACTIVE' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({
        status: 'ACTIVE',
        AND: [{ id: '__NO_PLATFORM_TENANT_ACCESS__' }],
      });
    });
  });

  it('scopes SaaS invoices and subscriptions to the resolved tenant', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      const params: any = {
        model: 'SaaSInvoice',
        action: 'findMany',
        args: { where: { status: 'PENDING' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({
        status: 'PENDING',
        AND: [{ tenantId: 'tenant-alpha' }],
      });
    });
  });

  it('restricts tenant users to their own SaaS tenant metadata', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      const params: any = {
        model: 'SaaSTenant',
        action: 'findMany',
        args: { where: { status: 'ACTIVE' } },
      };
      await middleware(params, async (value) => value);
      expect(params.args.where).toEqual({
        status: 'ACTIVE',
        AND: [{ id: 'tenant-alpha' }],
      });
    });
  });
});
