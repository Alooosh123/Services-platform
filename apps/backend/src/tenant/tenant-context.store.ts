import { AsyncLocalStorage } from 'async_hooks';

export interface TenantExecutionContext {
  tenantId: string | null;
}

const tenantStorage = new AsyncLocalStorage<TenantExecutionContext>();

export function runWithTenantContext<T>(tenantId: string | null, callback: () => T): T {
  return tenantStorage.run({ tenantId }, callback);
}

export function getCurrentTenantId(): string | null {
  return tenantStorage.getStore()?.tenantId ?? null;
}
