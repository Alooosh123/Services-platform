ALTER TABLE "pilot_run_audits"
  ADD COLUMN "tenantId" TEXT;

ALTER TABLE "pilot_run_audits"
  ADD CONSTRAINT "pilot_run_audits_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "pilot_run_audits_tenantId_status_idx"
  ON "pilot_run_audits"("tenantId", "status");
