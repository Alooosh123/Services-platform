CREATE TABLE "reconciliation_adjustments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "itemId" TEXT NOT NULL,
  "debitAccountCode" TEXT NOT NULL,
  "creditAccountCode" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "proposedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "proposalNotes" TEXT NOT NULL,
  "approvalNotes" TEXT,
  "ledgerTxId" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reconciliation_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reconciliation_adjustments_itemId_key"
  ON "reconciliation_adjustments"("itemId");
CREATE INDEX "reconciliation_adjustments_tenantId_status_createdAt_idx"
  ON "reconciliation_adjustments"("tenantId", "status", "createdAt");

ALTER TABLE "reconciliation_adjustments"
  ADD CONSTRAINT "reconciliation_adjustments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_adjustments"
  ADD CONSTRAINT "reconciliation_adjustments_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "reconciliation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
