import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, SaaSTenantStatus } from '@digital-topup/shared';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisIdempotencyStore } from '../../security/redis-idempotency.store';
import { EncryptionService } from '../../security/encryption.service';
import { runWithTenantContext } from '../../tenant/tenant-context.store';

describe('AuthService tenant registration', () => {
  const tenant = {
    id: 'tenant-alpha',
    status: SaaSTenantStatus.ACTIVE,
    ownerEmail: 'owner@alpha.example.test',
    ownerPhone: '+967770000001',
  };
  let prisma: any;
  let auth: AuthService;
  let createdData: any;

  beforeEach(() => {
    createdData = null;
    prisma = {
      saaSTenant: {
        findUnique: jest.fn().mockResolvedValue(tenant),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          createdData = data;
          return {
            id: 'created-user',
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            role: data.role,
            tenantId: data.tenantId,
            isVerified: data.isVerified,
            wallets: [],
          };
        }),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
    };

    const jwt = {
      signAsync: jest.fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
    };
    const redis = {
      createRefreshSession: jest.fn().mockResolvedValue(undefined),
    };

    auth = new AuthService(
      prisma as PrismaService,
      jwt as unknown as JwtService,
      redis as unknown as RedisIdempotencyStore,
      new EncryptionService(),
    );
  });

  it('claims the registered tenant owner only when both registered contacts match', async () => {
    await runWithTenantContext('tenant-alpha', () =>
      auth.register({
        fullName: 'Store Owner',
        email: 'OWNER@alpha.example.test',
        phone: '+967770000001',
        password: 'Long-Strong-Test-Password-123!',
      }),
    );

    expect(createdData.tenantId).toBe('tenant-alpha');
    expect(createdData.role).toBe(UserRole.OWNER);
  });

  it('registers other customers as customers within the resolved tenant', async () => {
    await runWithTenantContext('tenant-alpha', () =>
      auth.register({
        fullName: 'Store Customer',
        email: 'customer@alpha.example.test',
        phone: '+967770000002',
        password: 'Long-Strong-Test-Password-123!',
      }),
    );

    expect(createdData.tenantId).toBe('tenant-alpha');
    expect(createdData.role).toBe(UserRole.CUSTOMER);
  });

  it('rejects a claimed owner identity when the store is not active', async () => {
    prisma.saaSTenant.findUnique.mockResolvedValue({
      ...tenant,
      status: SaaSTenantStatus.PENDING_SETUP,
    });

    await runWithTenantContext('tenant-alpha', async () => {
      await expect(auth.register({
        fullName: 'Store Owner',
        email: tenant.ownerEmail,
        phone: tenant.ownerPhone,
        password: 'Long-Strong-Test-Password-123!',
      })).rejects.toBeInstanceOf(ForbiddenException);
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('fails closed instead of creating a memory user when the tenant database is unavailable', async () => {
    prisma.user.findFirst.mockRejectedValue(new Error('database offline'));

    await runWithTenantContext('tenant-alpha', async () => {
      await expect(auth.register({
        fullName: 'Customer',
        email: 'customer@alpha.example.test',
        password: 'Long-Strong-Test-Password-123!',
      })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
