INSERT INTO "payment_methods"
    ("id", "code", "name", "nameAr", "type", "supportedCurrencies", "isActive", "isMock", "createdAt")
VALUES
    (gen_random_uuid()::text, 'CARD', 'International bank card', 'بطاقة مصرفية عالمية', 'GATEWAY', '["USD"]'::jsonb, false, false, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'USDT_TRC20', 'USDT (TRC20)', 'تيثر (TRC20)', 'GATEWAY', '["USD"]'::jsonb, false, false, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'USDT_BEP20', 'USDT (BEP20)', 'تيثر (BEP20)', 'GATEWAY', '["USD"]'::jsonb, false, false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
