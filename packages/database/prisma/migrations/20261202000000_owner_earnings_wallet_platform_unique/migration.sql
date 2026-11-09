DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "owner_earnings_wallets"
    WHERE "tenantId" IS NULL
    GROUP BY "userId", "currency"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate platform owner earnings wallets exist; reconcile them before applying the unique index.';
  END IF;
END $$;

CREATE UNIQUE INDEX "owner_earnings_wallets_platform_user_currency_key"
  ON "owner_earnings_wallets" ("userId", "currency")
  WHERE "tenantId" IS NULL;
