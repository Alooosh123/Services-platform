-- Store the pending holder name separately until Finance approves the receiver change.
ALTER TABLE "payment_channel_configs"
  ADD COLUMN "pendingAccountHolderName" TEXT;
