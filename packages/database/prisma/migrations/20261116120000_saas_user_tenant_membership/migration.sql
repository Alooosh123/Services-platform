-- Add tenant membership without assigning existing platform users to a tenant.
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;

CREATE INDEX "users_tenantId_role_status_idx"
  ON "users"("tenantId", "role", "status");

ALTER TABLE "users"
  ADD CONSTRAINT "users_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
