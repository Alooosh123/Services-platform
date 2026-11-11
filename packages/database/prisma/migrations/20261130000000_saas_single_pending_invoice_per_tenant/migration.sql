-- Enforce the application invariant that a tenant may have at most one
-- unpaid SaaS invoice (PENDING or OVERDUE) at any point in time.
--
-- Fail safely rather than deleting or rewriting historical invoices if the
-- existing database already violates this invariant. Resolve duplicates
-- through a reviewed finance reconciliation before re-running the migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "saas_invoices"
    WHERE "status" IN ('PENDING', 'OVERDUE')
    GROUP BY "tenantId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add SaaS pending-invoice uniqueness: one or more tenants already have multiple unpaid invoices. Reconcile those invoices first.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "saas_invoices_single_unpaid_per_tenant_key"
  ON "saas_invoices" ("tenantId")
  WHERE "status" IN ('PENDING', 'OVERDUE');
