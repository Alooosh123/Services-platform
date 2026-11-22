-- READ-ONLY check aligned with the Prisma schema at the inspected main commit.
-- Each currency is checked independently. This query detects unbalanced POSTED journals.
SELECT lt.id, lt."txNumber", le.currency,
       SUM(le."debitAmount") AS total_debit,
       SUM(le."creditAmount") AS total_credit,
       SUM(le."debitAmount") - SUM(le."creditAmount") AS difference
FROM ledger_transactions lt
JOIN ledger_entries le ON le."transactionId" = lt.id
WHERE lt.status = 'POSTED'
GROUP BY lt.id, lt."txNumber", le.currency
HAVING SUM(le."debitAmount") <> SUM(le."creditAmount");

-- Expected result: zero rows. Also inspect row counts and compare with pre-backup snapshot.
-- This query is read-only; do not run any automatic corrections from n8n.

-- Also fail if a posted journal has no ledger entries at all.
SELECT lt.id, lt."txNumber", 'NO_ENTRIES' AS issue
FROM ledger_transactions lt
WHERE lt.status = 'POSTED'
  AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le."transactionId" = lt.id);
