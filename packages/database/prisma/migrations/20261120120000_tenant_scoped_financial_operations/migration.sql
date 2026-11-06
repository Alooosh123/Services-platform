-- Isolate tenant-owned financial operations while retaining existing platform rows as NULL.
ALTER TABLE "reconciliation_batches" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "supplier_accounts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "price_rule_versions" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "daily_close_reports" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "owner_earnings_wallets" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "reconciliation_batches"
  ADD CONSTRAINT "reconciliation_batches_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_accounts"
  ADD CONSTRAINT "supplier_accounts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_rule_versions"
  ADD CONSTRAINT "price_rule_versions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_close_reports"
  ADD CONSTRAINT "daily_close_reports_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "owner_earnings_wallets"
  ADD CONSTRAINT "owner_earnings_wallets_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace globally unique composites with tenant-aware keys; preserve a unique
-- global/platform record for NULL tenant IDs.
DROP INDEX IF EXISTS "supplier_accounts_providerId_currency_key";
CREATE UNIQUE INDEX "supplier_accounts_tenantId_providerId_currency_key"
  ON "supplier_accounts"("tenantId", "providerId", "currency");
CREATE UNIQUE INDEX "supplier_accounts_platform_provider_currency_key"
  ON "supplier_accounts"("providerId", "currency") WHERE "tenantId" IS NULL;

DROP INDEX IF EXISTS "owner_earnings_wallets_userId_currency_key";
CREATE UNIQUE INDEX "owner_earnings_wallets_tenantId_userId_currency_key"
  ON "owner_earnings_wallets"("tenantId", "userId", "currency");
CREATE UNIQUE INDEX "owner_earnings_wallets_platform_user_currency_key"
  ON "owner_earnings_wallets"("userId", "currency") WHERE "tenantId" IS NULL;

DROP INDEX IF EXISTS "daily_close_reports_closeDate_key";
CREATE UNIQUE INDEX "daily_close_reports_tenantId_closeDate_key"
  ON "daily_close_reports"("tenantId", "closeDate");
CREATE UNIQUE INDEX "daily_close_reports_platform_closeDate_key"
  ON "daily_close_reports"("closeDate") WHERE "tenantId" IS NULL;

CREATE INDEX "reconciliation_batches_tenantId_status_idx"
  ON "reconciliation_batches"("tenantId", "status");
CREATE INDEX "price_rule_versions_tenantId_scope_targetId_idx"
  ON "price_rule_versions"("tenantId", "scope", "targetId");
