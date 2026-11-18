-- Ensure every supported wallet currency exists in fresh and existing databases.
-- Existing currency configuration is preserved; only missing reference rows are inserted.
INSERT INTO "currencies"
  ("code", "name", "nameAr", "symbol", "symbolAr", "decimals", "isBase", "isActive")
VALUES
  ('YER', 'Yemeni Rial', 'ريال يمني', 'YR', 'ر.ي', 2, false, true),
  ('USD', 'US Dollar', 'دولار أمريكي', '$', '$', 2, true, true),
  ('SAR', 'Saudi Rial', 'ريال سعودي', 'SAR', 'ر.س', 2, false, true)
ON CONFLICT ("code") DO NOTHING;
