ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PAYMENT_AGENT';

ALTER TABLE "payment_channel_configs"
  ADD COLUMN "regulatoryApprovalReference" TEXT,
  ADD COLUMN "regulatoryApprovalDocumentUrl" TEXT,
  ADD COLUMN "providerAgreementReference" TEXT,
  ADD COLUMN "providerAgreementDocumentUrl" TEXT,
  ADD COLUMN "pendingRegulatoryApprovalReference" TEXT,
  ADD COLUMN "pendingRegulatoryApprovalDocumentUrl" TEXT,
  ADD COLUMN "pendingProviderAgreementReference" TEXT,
  ADD COLUMN "pendingProviderAgreementDocumentUrl" TEXT;

ALTER TABLE "payment_channel_configs"
  ALTER COLUMN "mode" SET DEFAULT 'BLOCKED_EXTERNAL',
  ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING_REVIEW',
  ALTER COLUMN "isActive" SET DEFAULT FALSE;

UPDATE "payment_channel_configs"
SET
  "mode" = 'BLOCKED_EXTERNAL',
  "verificationStatus" = 'PENDING_REVIEW',
  "isActive" = FALSE,
  "verifiedAt" = NULL,
  "verifiedByFinanceUserId" = NULL,
  "killSwitchReason" = 'Needs current regulator authorization and signed merchant agreement review before activation.';

CREATE TABLE "wallet_agent_operations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "channelCode" "PaymentChannelCode" NOT NULL,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "depositRequestId" TEXT,
  "payoutRequestId" TEXT,
  "customerUserId" TEXT,
  "agentUserId" TEXT,
  "expectedAmount" DECIMAL(18,4) NOT NULL,
  "expectedCurrency" "CurrencyCode" NOT NULL,
  "expectedReferenceNumber" TEXT,
  "expectedAccountLastFour" TEXT,
  "observedAmount" DECIMAL(18,4),
  "observedCurrency" "CurrencyCode",
  "observedReferenceNumber" TEXT,
  "observedAccountLastFour" TEXT,
  "evidenceReference" TEXT,
  "agentNotes" TEXT,
  "claimedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "financeReviewedByUserId" TEXT,
  "financeNotes" TEXT,
  "ledgerTxId" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_agent_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_agent_operations_depositRequestId_key"
  ON "wallet_agent_operations"("depositRequestId");
CREATE UNIQUE INDEX "wallet_agent_operations_payoutRequestId_key"
  ON "wallet_agent_operations"("payoutRequestId");
CREATE INDEX "wallet_agent_operations_tenantId_status_direction_createdAt_idx"
  ON "wallet_agent_operations"("tenantId", "status", "direction", "createdAt");
CREATE INDEX "wallet_agent_operations_agentUserId_status_idx"
  ON "wallet_agent_operations"("agentUserId", "status");
CREATE INDEX "wallet_agent_operations_channelCode_observedReferenceNumber_idx"
  ON "wallet_agent_operations"("channelCode", "observedReferenceNumber");

ALTER TABLE "wallet_agent_operations"
  ADD CONSTRAINT "wallet_agent_operations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_agent_operations"
  ADD CONSTRAINT "wallet_agent_operations_depositRequestId_fkey"
  FOREIGN KEY ("depositRequestId") REFERENCES "deposit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_agent_operations"
  ADD CONSTRAINT "wallet_agent_operations_payoutRequestId_fkey"
  FOREIGN KEY ("payoutRequestId") REFERENCES "payout_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_agent_operations"
  ADD CONSTRAINT "wallet_agent_operations_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wallet_agent_operations"
  ADD CONSTRAINT "wallet_agent_operations_agentUserId_fkey"
  FOREIGN KEY ("agentUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wallet_agent_operations"
  ADD CONSTRAINT "wallet_agent_operations_financeReviewedByUserId_fkey"
  FOREIGN KEY ("financeReviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
