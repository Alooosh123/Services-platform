DO $$
BEGIN
  IF EXISTS (
    SELECT "externalReference"
    FROM "payout_requests"
    WHERE "externalReference" IS NOT NULL AND btrim("externalReference") <> ''
    GROUP BY "externalReference"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate customer payout external references exist; reconcile them before applying this migration.';
  END IF;

  IF EXISTS (
    SELECT "externalReference"
    FROM "owner_payout_transactions"
    WHERE "externalReference" IS NOT NULL AND btrim("externalReference") <> ''
    GROUP BY "externalReference"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate owner payout external references exist; reconcile them before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "payout_requests_externalReference_key"
  ON "payout_requests"("externalReference")
  WHERE "externalReference" IS NOT NULL AND btrim("externalReference") <> '';

CREATE UNIQUE INDEX "owner_payout_transactions_externalReference_key"
  ON "owner_payout_transactions"("externalReference")
  WHERE "externalReference" IS NOT NULL AND btrim("externalReference") <> '';
