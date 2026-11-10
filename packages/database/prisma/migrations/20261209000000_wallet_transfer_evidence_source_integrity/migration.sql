-- Store independently ingested, tamper-evident evidence for each incoming wallet transfer.
-- This table is intentionally not writable from the wallet-agent submit endpoint.
CREATE TABLE "wallet_transfer_evidence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "channelCode" "PaymentChannelCode" NOT NULL,
  "externalReference" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "senderIdentifierLookupHash" TEXT NOT NULL,
  "receiverAccountLookupHash" TEXT NOT NULL,
  "evidenceSource" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "providerEventId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "verifiedByUserId" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_transfer_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_transfer_evidence_source_check"
    CHECK ("evidenceSource" IN ('SIGNED_PROVIDER_WEBHOOK', 'AUTHENTICATED_STATEMENT_IMPORT')),
  CONSTRAINT "wallet_transfer_evidence_status_check"
    CHECK ("status" IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
  CONSTRAINT "wallet_transfer_evidence_hashes_check"
    CHECK (
      "senderIdentifierLookupHash" ~ '^[A-Fa-f0-9]{64}$' AND
      "receiverAccountLookupHash" ~ '^[A-Fa-f0-9]{64}$' AND
      "evidenceSha256" ~ '^[A-Fa-f0-9]{64}$'
    ),
  CONSTRAINT "wallet_transfer_evidence_positive_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "wallet_transfer_evidence_verified_fields_check"
    CHECK ("status" <> 'VERIFIED' OR "verifiedAt" IS NOT NULL)
);

CREATE UNIQUE INDEX "wallet_transfer_evidence_tenantId_channelCode_externalReference_key"
  ON "wallet_transfer_evidence"("tenantId", "channelCode", "externalReference");

CREATE UNIQUE INDEX "wallet_transfer_evidence_tenantId_channelCode_providerEventId_key"
  ON "wallet_transfer_evidence"("tenantId", "channelCode", "providerEventId");

CREATE INDEX "wallet_transfer_evidence_tenant_status_channel_created_idx"
  ON "wallet_transfer_evidence"("tenantId", "status", "channelCode", "createdAt");

CREATE INDEX "wallet_transfer_evidence_sender_receiver_hash_idx"
  ON "wallet_transfer_evidence"("senderIdentifierLookupHash", "receiverAccountLookupHash");

ALTER TABLE "wallet_transfer_evidence"
  ADD CONSTRAINT "wallet_transfer_evidence_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
