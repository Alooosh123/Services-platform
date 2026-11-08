-- Durable linked-account consent/review and dual-control reconciliation adjustments.
CREATE TYPE "ServiceAccountStatus" AS ENUM ('VERIFIED_OAUTH', 'VERIFIED_PROVIDER', 'REFERENCE_ONLY', 'UNSUPPORTED', 'REVOKED');
CREATE TYPE "AccountReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AiRecommendation" AS ENUM ('AUTO_APPROVE', 'HUMAN_REVIEW', 'REJECT');
CREATE TYPE "ReconciliationAdjustmentStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED');
CREATE TABLE "service_accounts" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"serviceSlug" TEXT NOT NULL,"serviceName" TEXT NOT NULL,"serviceNameAr" TEXT NOT NULL,"accountIdentifierCiphertext" TEXT NOT NULL,"accountName" TEXT,"serverZoneId" TEXT,"status" "ServiceAccountStatus" NOT NULL DEFAULT 'REFERENCE_ONLY',"verificationSource" TEXT,"lastVerifiedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "service_accounts_pkey" PRIMARY KEY ("id"));
CREATE INDEX "service_accounts_userId_status_createdAt_idx" ON "service_accounts"("userId","status","createdAt");
CREATE INDEX "service_accounts_serviceSlug_status_idx" ON "service_accounts"("serviceSlug","status");
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "service_account_consents" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"serviceAccountId" TEXT NOT NULL,"serviceSlug" TEXT NOT NULL,"scopes" JSONB NOT NULL,"consentText" TEXT NOT NULL,"consentVersion" TEXT NOT NULL DEFAULT '1.0',"ipAddress" TEXT,"userAgent" TEXT,"grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"revokedAt" TIMESTAMP(3),"revokeReason" TEXT,CONSTRAINT "service_account_consents_pkey" PRIMARY KEY ("id"));
CREATE INDEX "service_account_consents_userId_revokedAt_grantedAt_idx" ON "service_account_consents"("userId","revokedAt","grantedAt");
CREATE INDEX "service_account_consents_serviceAccountId_revokedAt_idx" ON "service_account_consents"("serviceAccountId","revokedAt");
ALTER TABLE "service_account_consents" ADD CONSTRAINT "service_account_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_account_consents" ADD CONSTRAINT "service_account_consents_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "service_account_reviews" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"serviceAccountId" TEXT NOT NULL,"serviceSlug" TEXT NOT NULL,"status" "AccountReviewStatus" NOT NULL DEFAULT 'PENDING',"riskLevel" "RiskLevel" NOT NULL,"riskScore" INTEGER NOT NULL,"aiRecommendation" "AiRecommendation" NOT NULL,"aiReasons" JSONB NOT NULL,"aiReasonsAr" JSONB NOT NULL,"operatorId" TEXT,"operatorNotes" TEXT,"resolvedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "service_account_reviews_pkey" PRIMARY KEY ("id"));
CREATE INDEX "service_account_reviews_status_createdAt_idx" ON "service_account_reviews"("status","createdAt");
CREATE INDEX "service_account_reviews_userId_createdAt_idx" ON "service_account_reviews"("userId","createdAt");
ALTER TABLE "service_account_reviews" ADD CONSTRAINT "service_account_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_account_reviews" ADD CONSTRAINT "service_account_reviews_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_account_reviews" ADD CONSTRAINT "service_account_reviews_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payout_requests" ADD COLUMN "confirmedByUserId" TEXT;
ALTER TABLE "payout_requests" ADD COLUMN "rejectedByUserId" TEXT;
ALTER TABLE "payout_requests" ADD COLUMN "executedAt" TIMESTAMP(3);
ALTER TABLE "owner_payout_transactions" ADD COLUMN "confirmedByUserId" TEXT;
ALTER TABLE "owner_payout_transactions" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "payout_beneficiaries" ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING_REVIEW';
CREATE TABLE "reconciliation_adjustment_requests" ("id" TEXT NOT NULL,"itemId" TEXT NOT NULL,"debitAccountCode" TEXT NOT NULL,"creditAccountCode" TEXT NOT NULL,"amount" DECIMAL(18,4) NOT NULL,"currency" "CurrencyCode" NOT NULL,"status" "ReconciliationAdjustmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',"reason" TEXT NOT NULL,"proposedByUserId" TEXT NOT NULL,"approvedByUserId" TEXT,"ledgerTxId" TEXT,"approvedAt" TIMESTAMP(3),"postedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "reconciliation_adjustment_requests_pkey" PRIMARY KEY ("id"));
CREATE INDEX "reconciliation_adjustment_requests_itemId_status_idx" ON "reconciliation_adjustment_requests"("itemId","status");
CREATE INDEX "reconciliation_adjustment_requests_status_createdAt_idx" ON "reconciliation_adjustment_requests"("status","createdAt");
ALTER TABLE "reconciliation_adjustment_requests" ADD CONSTRAINT "reconciliation_adjustment_requests_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "reconciliation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_adjustment_requests" ADD CONSTRAINT "reconciliation_adjustment_requests_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_adjustment_requests" ADD CONSTRAINT "reconciliation_adjustment_requests_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Owner earnings allocations must be backed by a posted balanced ledger transaction.
CREATE TABLE "owner_earnings_allocations" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "currency" "CurrencyCode" NOT NULL,
 "amount" DECIMAL(18,4) NOT NULL,
 "idempotencyKey" TEXT NOT NULL,
 "ledgerTxId" TEXT,
 "createdByUserId" TEXT NOT NULL,
 "notes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "owner_earnings_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "owner_earnings_allocations_idempotencyKey_key" ON "owner_earnings_allocations"("idempotencyKey");
CREATE UNIQUE INDEX "owner_earnings_allocations_ledgerTxId_key" ON "owner_earnings_allocations"("ledgerTxId");
CREATE INDEX "owner_earnings_allocations_userId_currency_createdAt_idx" ON "owner_earnings_allocations"("userId","currency","createdAt");
ALTER TABLE "owner_earnings_allocations" ADD CONSTRAINT "owner_earnings_allocations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "owner_earnings_allocations" ADD CONSTRAINT "owner_earnings_allocations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "payout_beneficiaries" SET "verificationStatus" = 'PENDING_REVIEW' WHERE "financeApprovedBy" IS NULL;
