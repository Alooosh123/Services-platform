-- SaaS invoices must remain unpaid until an administrator confirms a unique payment reference.
ALTER TABLE "saas_invoices"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX "saas_invoices_paymentMethod_referenceNumber_key"
  ON "saas_invoices"("paymentMethod", "referenceNumber");
