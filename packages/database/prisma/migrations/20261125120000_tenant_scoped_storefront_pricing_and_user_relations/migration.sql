-- Add tenant-specific retail and reseller price rows while preserving legacy platform prices.
ALTER TABLE "product_prices" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "product_tier_prices" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "product_prices"
  ADD CONSTRAINT "product_prices_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_tier_prices"
  ADD CONSTRAINT "product_tier_prices_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "product_prices_productId_currency_key";
CREATE UNIQUE INDEX "product_prices_tenantId_productId_currency_key"
  ON "product_prices"("tenantId", "productId", "currency");
CREATE UNIQUE INDEX "product_prices_platform_product_currency_key"
  ON "product_prices"("productId", "currency") WHERE "tenantId" IS NULL;

DROP INDEX IF EXISTS "product_tier_prices_productId_tierId_currency_key";
CREATE UNIQUE INDEX "product_tier_prices_tenantId_productId_tierId_currency_key"
  ON "product_tier_prices"("tenantId", "productId", "tierId", "currency");
CREATE UNIQUE INDEX "product_tier_prices_platform_product_tier_currency_key"
  ON "product_tier_prices"("productId", "tierId", "currency") WHERE "tenantId" IS NULL;

CREATE INDEX "product_prices_tenantId_isAvailable_idx"
  ON "product_prices"("tenantId", "isAvailable");
CREATE INDEX "product_tier_prices_tenantId_tierId_isActive_idx"
  ON "product_tier_prices"("tenantId", "tierId", "isActive");

-- Add explicit foreign keys for tenant-scoped user-owned records whose userId
-- existed before the tenant middleware was added.
ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payout_beneficiaries"
  ADD CONSTRAINT "payout_beneficiaries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
