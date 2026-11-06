-- Record who proposed sensitive payment receiver changes for maker-checker enforcement.
ALTER TABLE "payment_channel_configs"
  ADD COLUMN "proposedByUserId" TEXT,
  ADD COLUMN "pendingAccountHolderName" TEXT;
