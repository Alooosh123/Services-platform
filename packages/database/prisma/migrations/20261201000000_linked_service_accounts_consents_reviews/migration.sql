CREATE TABLE "linked_service_accounts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT NOT NULL,
  "serviceSlug" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "serviceNameAr" TEXT NOT NULL,
  "accountIdentifier" TEXT NOT NULL,
  "accountName" TEXT,
  "serverZoneId" TEXT,
  "status" TEXT NOT NULL,
  "verificationSource" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "linked_service_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "linked_service_consents" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT NOT NULL,
  "serviceAccountId" TEXT NOT NULL,
  "serviceSlug" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "consentText" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "linked_service_consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "linked_service_account_reviews" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT NOT NULL,
  "serviceAccountId" TEXT NOT NULL,
  "serviceSlug" TEXT NOT NULL,
  "accountIdentifier" TEXT NOT NULL,
  "accountName" TEXT,
  "status" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "aiRecommendation" TEXT NOT NULL,
  "aiReasons" TEXT[] NOT NULL,
  "aiReasonsAr" TEXT[] NOT NULL,
  "operatorId" TEXT,
  "operatorNotes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "linked_service_account_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "linked_service_accounts_userId_serviceSlug_accountIdentifier_key"
  ON "linked_service_accounts"("userId", "serviceSlug", "accountIdentifier");
CREATE INDEX "linked_service_accounts_tenantId_userId_status_idx"
  ON "linked_service_accounts"("tenantId", "userId", "status");
CREATE INDEX "linked_service_accounts_serviceSlug_accountIdentifier_idx"
  ON "linked_service_accounts"("serviceSlug", "accountIdentifier");
CREATE INDEX "linked_service_consents_tenantId_userId_revokedAt_idx"
  ON "linked_service_consents"("tenantId", "userId", "revokedAt");
CREATE INDEX "linked_service_consents_serviceAccountId_revokedAt_idx"
  ON "linked_service_consents"("serviceAccountId", "revokedAt");
CREATE INDEX "linked_service_account_reviews_tenantId_status_createdAt_idx"
  ON "linked_service_account_reviews"("tenantId", "status", "createdAt");
CREATE INDEX "linked_service_account_reviews_userId_status_idx"
  ON "linked_service_account_reviews"("userId", "status");
CREATE INDEX "linked_service_account_reviews_serviceAccountId_idx"
  ON "linked_service_account_reviews"("serviceAccountId");

ALTER TABLE "linked_service_accounts"
  ADD CONSTRAINT "linked_service_accounts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "linked_service_accounts"
  ADD CONSTRAINT "linked_service_accounts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "linked_service_consents"
  ADD CONSTRAINT "linked_service_consents_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "linked_service_consents"
  ADD CONSTRAINT "linked_service_consents_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "linked_service_consents"
  ADD CONSTRAINT "linked_service_consents_serviceAccountId_fkey"
  FOREIGN KEY ("serviceAccountId") REFERENCES "linked_service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "linked_service_account_reviews"
  ADD CONSTRAINT "linked_service_account_reviews_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "linked_service_account_reviews"
  ADD CONSTRAINT "linked_service_account_reviews_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "linked_service_account_reviews"
  ADD CONSTRAINT "linked_service_account_reviews_serviceAccountId_fkey"
  FOREIGN KEY ("serviceAccountId") REFERENCES "linked_service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
