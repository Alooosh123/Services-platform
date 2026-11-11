import { AsyncLocalStorage } from 'async_hooks';

export interface TenantExecutionContext {
  tenantId: string | null;
  isPlatformAdmin: boolean;
  isSaaSFinance: boolean;
  isTenantResolver: boolean;
}

const tenantStorage = new AsyncLocalStorage<TenantExecutionContext>();

export function runWithTenantContext<T>(tenantId: string | null, callback: () => T): T {
  return tenantStorage.run(
    {
      tenantId,
      isPlatformAdmin: false,
      isSaaSFinance: false,
      isTenantResolver: false,
    },
    callback,
  );
}

/**
 * Allows only the trusted host-resolution middleware to look up a tenant by
 * its configured domain before the request's tenant context has been resolved.
 */
export function runWithTenantResolverContext<T>(callback: () => T): T {
  return tenantStorage.run(
    {
      tenantId: null,
      isPlatformAdmin: false,
      isSaaSFinance: false,
      isTenantResolver: true,
    },
    callback,
  );
}

export function getTenantExecutionContext(): TenantExecutionContext | undefined {
  return tenantStorage.getStore();
}

export function getCurrentTenantId(): string | null {
  return tenantStorage.getStore()?.tenantId ?? null;
}

export function isPlatformAdminContext(): boolean {
  return tenantStorage.getStore()?.isPlatformAdmin === true;
}

export function isSaaSFinanceContext(): boolean {
  return tenantStorage.getStore()?.isSaaSFinance === true;
}

export function isTenantResolverContext(): boolean {
  return tenantStorage.getStore()?.isTenantResolver === true;
}

/** Called only after JwtAuthGuard has validated a platform Super Admin JWT. */
export function setPlatformAdminContext(enabled: boolean): void {
  const context = tenantStorage.getStore();
  if (context) context.isPlatformAdmin = enabled;
}

/** Called only by RolesGuard for the finance-only SaaS invoice confirmation route. */
export function setSaaSFinanceContext(enabled: boolean): void {
  const context = tenantStorage.getStore();
  if (context) context.isSaaSFinance = enabled;
}
