-- Persist one encrypted sender identifier per customer and payment channel.
CREATE TYPE "PaymentSenderIdentifierType" AS ENUM ('ALIAS', 'PHONE', 'WALLET_ID', 'ACCOUNT_NUMBER');

ALTER TABLE "payment_channel_configs"
  ADD COLUMN "senderIdentifierType" "PaymentSenderIdentifierType" NOT NULL DEFAULT 'PHONE';

-- JAIB customer instruction in this rollout: enter the sender's alternate/alias number.
-- Other channels default to the linked wallet phone until their provider confirms another ID.
UPDATE "payment_channel_configs"
  SET "senderIdentifierType" = 'ALIAS'
  WHERE "code" = 'JAIB';

ALTER TABLE "deposit_requests"
  ADD COLUMN "senderAccountId" TEXT;

ALTER TABLE "wallet_agent_operations"
  ADD COLUMN "expectedSenderAccountLastFour" TEXT,
  ADD COLUMN "observedSenderAccountLastFour" TEXT;

CREATE TABLE "payment_sender_accounts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT NOT NULL,
  "channelCode" "PaymentChannelCode" NOT NULL,
  "identifierType" "PaymentSenderIdentifierType" NOT NULL,
  "identifierCiphertext" TEXT NOT NULL,
  "identifierLookupHash" TEXT NOT NULL,
  "maskedIdentifier" TEXT NOT NULL,
  "identifierLastFour" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "consentGrantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consentTextVersion" TEXT NOT NULL DEFAULT 'payment-sender-account-v1',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_sender_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_sender_accounts_userId_channelCode_key"
  ON "payment_sender_accounts"("userId", "channelCode");
CREATE INDEX "payment_sender_accounts_tenantId_userId_channelCode_status_idx"
  ON "payment_sender_accounts"("tenantId", "userId", "channelCode", "status");
CREATE INDEX "payment_sender_accounts_tenantId_channelCode_identifierLookupHash_idx"
  ON "payment_sender_accounts"("tenantId", "channelCode", "identifierLookupHash");

-- Prevent the same sender identity being claimed by different customers within the same tenant.
CREATE UNIQUE INDEX "payment_sender_accounts_tenant_channel_identifier_uq"
  ON "payment_sender_accounts"(COALESCE("tenantId", ''), "channelCode", "identifierLookupHash");

ALTER TABLE "payment_sender_accounts"
  ADD CONSTRAINT "payment_sender_accounts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deposit_requests"
  ADD CONSTRAINT "deposit_requests_senderAccountId_fkey"
  FOREIGN KEY ("senderAccountId") REFERENCES "payment_sender_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
