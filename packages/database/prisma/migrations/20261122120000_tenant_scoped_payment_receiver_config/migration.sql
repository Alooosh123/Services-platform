-- Store payment receiver accounts and instructions separately for every tenant.
ALTER TABLE "payment_channel_configs" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "payment_channel_configs"
  ADD CONSTRAINT "payment_channel_configs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "payment_channel_configs_code_key";
CREATE UNIQUE INDEX "payment_channel_configs_tenantId_code_key"
  ON "payment_channel_configs"("tenantId", "code");
CREATE UNIQUE INDEX "payment_channel_configs_platform_code_key"
  ON "payment_channel_configs"("code") WHERE "tenantId" IS NULL;

CREATE INDEX "payment_channel_configs_tenantId_isActive_verificationStatus_idx"
  ON "payment_channel_configs"("tenantId", "isActive", "verificationStatus");
