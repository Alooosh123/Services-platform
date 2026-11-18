-- Require an explicit application-owner decision before a saved sender identity
-- can be used for any new manual-wallet deposit.
ALTER TABLE "payment_sender_accounts"
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNotes" TEXT;

ALTER TABLE "payment_sender_accounts"
  ADD CONSTRAINT "payment_sender_accounts_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "payment_sender_accounts_tenantId_status_createdAt_idx"
  ON "payment_sender_accounts"("tenantId", "status", "createdAt");

-- Existing identifiers were never owner-approved by the new workflow.
-- Keep their former state for audit, but require re-submission/review before use.
UPDATE "payment_sender_accounts"
SET "status" = 'PENDING_VERIFICATION',
    "verifiedAt" = NULL,
    "reviewedByUserId" = NULL,
    "reviewedAt" = NULL,
    "reviewNotes" = 'يلزم إعادة التحقق من مالك التطبيق بعد تحديث سياسة اعتماد أرقام المحافظ.'
WHERE "status" = 'VERIFIED';
