ALTER TABLE "users"
ADD COLUMN "transactionPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "transactionPinLockedUntil" TIMESTAMP(3);
