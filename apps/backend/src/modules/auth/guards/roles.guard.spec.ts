import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@digital-topup/shared';
import { RolesGuard } from './roles.guard';
import { SAAS_INVOICE_FINANCE_ACCESS_KEY } from '../../saas/decorators/saas-invoice-finance.decorator';
import {
  isSaaSFinanceContext,
  runWithTenantContext,
} from '../../../tenant/tenant-context.store';

describe('RolesGuard tenant-scope permissions', () => {
  const handler = () => undefined;
  const controller = class TestController {};

  function buildContext(role: UserRole): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'finance-user', role, tenantId: null } }),
      }),
    } as unknown as ExecutionContext;
  }

  function buildGuard(invoiceScope: boolean) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([
        UserRole.SUPER_ADMIN,
        UserRole.FINANCE_MANAGER,
      ]),
      get: jest.fn().mockImplementation((key: string) =>
        key === SAAS_INVOICE_FINANCE_ACCESS_KEY ? invoiceScope : undefined,
      ),
    };
    return new RolesGuard(reflector as unknown as Reflector);
  }

  it('does not grant SaaS cross-tenant scope to Finance Manager on ordinary finance routes', () => {
    const guard = buildGuard(false);
    runWithTenantContext(null, () => {
      expect(guard.canActivate(buildContext(UserRole.FINANCE_MANAGER))).toBe(true);
      expect(isSaaSFinanceContext()).toBe(false);
    });
  });

  it('grants the narrow SaaS finance scope only on the explicitly marked invoice route', () => {
    const guard = buildGuard(true);
    runWithTenantContext(null, () => {
      expect(guard.canActivate(buildContext(UserRole.FINANCE_MANAGER))).toBe(true);
      expect(isSaaSFinanceContext()).toBe(true);
    });
  });

  it('does not grant SaaS finance scope to a tenant owner even when a handler is marked', () => {
    const guard = buildGuard(true);
    runWithTenantContext('tenant-alpha', () => {
      expect(() => guard.canActivate(buildContext(UserRole.OWNER))).toThrow('Access denied');
    });
  });
});
