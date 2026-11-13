ALTER TYPE "PaymentChannelCode" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TYPE "PaymentChannelCode" ADD VALUE IF NOT EXISTS 'BINANCE_PAY';
ALTER TYPE "PaymentChannelCode" ADD VALUE IF NOT EXISTS 'USDT_TRC20';
ALTER TYPE "PaymentChannelCode" ADD VALUE IF NOT EXISTS 'USDT_BEP20';

ALTER TABLE "payments"
ADD COLUMN "providerCurrency" TEXT,
ADD COLUMN "providerAmount" DECIMAL(18,6),
ADD COLUMN "checkoutUrl" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "providerEventId" TEXT,
ADD COLUMN "providerReference" TEXT,
ADD COLUMN "ledgerTxId" TEXT,
ADD COLUMN "feeAmount" DECIMAL(18,4) NOT NULL DEFAULT 0.0000;

CREATE UNIQUE INDEX "payments_gatewayReference_key" ON "payments"("gatewayReference");
CREATE UNIQUE INDEX "payments_providerReference_key" ON "payments"("providerReference");
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE INDEX "payments_userId_status_createdAt_idx" ON "payments"("userId", "status", "createdAt");

CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "paymentId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_events_provider_providerEventId_key"
ON "payment_webhook_events"("provider", "providerEventId");
CREATE INDEX "payment_webhook_events_status_receivedAt_idx"
ON "payment_webhook_events"("status", "receivedAt");

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
