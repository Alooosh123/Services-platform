-- Tenant-scoped financial chart and entries. Existing platform rows remain tenantId NULL.
ALTER TABLE "ledger_accounts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ledger_transactions" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "ledger_accounts"
  ADD CONSTRAINT "ledger_accounts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_transactions"
  ADD CONSTRAINT "ledger_transactions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ledger_accounts_tenantId_idx" ON "ledger_accounts"("tenantId");
CREATE INDEX "ledger_transactions_tenantId_referenceType_referenceId_idx"
  ON "ledger_transactions"("tenantId", "referenceType", "referenceId");
CREATE INDEX "ledger_entries_tenantId_idx" ON "ledger_entries"("tenantId");
