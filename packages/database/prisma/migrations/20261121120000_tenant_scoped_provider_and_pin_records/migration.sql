-- Tenant-owned PIN inventory and provider request/response logs.
ALTER TABLE "pin_vault" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "provider_api_logs" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "pin_vault"
  ADD CONSTRAINT "pin_vault_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_api_logs"
  ADD CONSTRAINT "provider_api_logs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "pin_vault_tenantId_productId_status_idx"
  ON "pin_vault"("tenantId", "productId", "status");
CREATE INDEX "provider_api_logs_tenantId_createdAt_idx"
  ON "provider_api_logs"("tenantId", "createdAt");
