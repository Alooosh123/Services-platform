import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@digital-topup/shared';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard tenant boundary', () => {
  const guard = new JwtAuthGuard();

  const contextFor = (tenantId: string | null): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ tenantId }),
      }),
    }) as unknown as ExecutionContext;

  it('allows a member to use their own tenant domain', () => {
    const user = { id: 'user-a', role: UserRole.OWNER, tenantId: 'tenant-a' };
    expect(guard.handleRequest(null, user, null, contextFor('tenant-a'))).toBe(user);
  });

  it('rejects a member of tenant A when using tenant B domain', () => {
    const user = { id: 'user-a', role: UserRole.OWNER, tenantId: 'tenant-a' };
    expect(() =>
      guard.handleRequest(null, user, null, contextFor('tenant-b')),
    ).toThrow(ForbiddenException);
  });

  it('rejects a tenant member when using the platform domain', () => {
    const user = { id: 'user-a', role: UserRole.CUSTOMER, tenantId: 'tenant-a' };
    expect(() =>
      guard.handleRequest(null, user, null, contextFor(null)),
    ).toThrow(ForbiddenException);
  });

  it('rejects a platform account on a tenant domain unless it is Super Admin', () => {
    const user = { id: 'platform-user', role: UserRole.GENERAL_MANAGER, tenantId: null };
    expect(() =>
      guard.handleRequest(null, user, null, contextFor('tenant-a')),
    ).toThrow(ForbiddenException);
  });

  it('allows only platform Super Admin to cross tenant domains', () => {
    const user = { id: 'root', role: UserRole.SUPER_ADMIN, tenantId: null };
    expect(guard.handleRequest(null, user, null, contextFor('tenant-a'))).toBe(user);
  });
});
