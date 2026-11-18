-- Add distinct verification and ledger-settlement states for customer deposits.
-- No balance or ledger entries are changed by this migration.

CREATE TYPE "DepositVerificationStatus" AS ENUM (
  'PENDING',
  'AGENT_SUBMITTED',
  'NEEDS_REVIEW',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE "DepositSettlementStatus" AS ENUM (
  'NOT_STARTED',
  'PENDING_LEDGER',
  'POSTED',
  'FAILED',
  'REVERSED'
);

ALTER TABLE "deposit_requests"
  ADD COLUMN "verificationStatus" "DepositVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "settlementStatus" "DepositSettlementStatus" NOT NULL DEFAULT 'NOT_STARTED';

UPDATE "deposit_requests" AS d
SET
  "verificationStatus" = CASE
    WHEN d."status" = 'REJECTED' THEN 'REJECTED'::"DepositVerificationStatus"
    WHEN d."status" = 'UNDER_REVIEW' THEN 'NEEDS_REVIEW'::"DepositVerificationStatus"
    WHEN d."status" = 'CREDITED'
      AND d."ledgerTxId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "ledger_transactions" AS lt
        WHERE lt."id" = d."ledgerTxId" OR lt."txNumber" = d."ledgerTxId"
      ) THEN 'VERIFIED'::"DepositVerificationStatus"
    ELSE 'PENDING'::"DepositVerificationStatus"
  END,
  "settlementStatus" = CASE
    WHEN d."status" = 'CREDITED'
      AND d."ledgerTxId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "ledger_transactions" AS lt
        WHERE lt."id" = d."ledgerTxId" OR lt."txNumber" = d."ledgerTxId"
      ) THEN 'POSTED'::"DepositSettlementStatus"
    WHEN d."status" = 'CREDITED' THEN 'FAILED'::"DepositSettlementStatus"
    ELSE 'NOT_STARTED'::"DepositSettlementStatus"
  END;
