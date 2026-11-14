# Production Readiness — Evidence Register

هذا السجل يفرق بين ملفات/اختبارات أضيفت إلى المستودع وبين اختبارات بيئة حقيقية. نجاح CI لا يعد دليلاً على اتصال حساب بنكي أو راوتر فعلي أو نقل بيانات إنتاجية.

## Evidence from this branch

- MySQL target schema: Prisma datasource and fresh MySQL baseline migration generation use MySQL 8.4; production database migration/data cutover has not been executed.
- npm dependency audit: latest reviewed CI run for dependency and migration workflow showed 0 production vulnerabilities; full dependency audit showed 9 low-severity findings and no high/critical findings. See GitHub Actions workflow run for the release branch.
- Read-only RouterOS client: HTTPS-only, private IPv4 guard, trusted CA verification, GET-only requests, bounded response and timeout; unit tests added. No real RouterOS session is evidenced.
- Manual Yemeni payment channels: seeded channel configs begin disabled and unverified; channel setup/proposal/finance approval is durable in MySQL with audit logs; API mode blocked pending actual provider certification.
- Manual deposit flow: deposit request starts pending; independent approval required before posting the double-entry ledger; approval closure shares the same transaction as the wallet/ledger credit.
- Operational approvals: requester/approver separation, concurrent decision protection, manual network closeout evidence, and reconciliation item closeout with exact Decimal checks.
- Production reconciliation: memory fallback prohibited; durable batch and child IDs are used for approval targets.
- Payout workflows: production sandbox payouts are blocked; the payout request and wallet hold are created atomically, finance approval uses a compare-and-set state transition, manual payout closeout posts the double-entry ledger and payout evidence in one MySQL transaction, payout UNKNOWN states retain the wallet hold, and payout read endpoints enforce owner/staff access.
- Podman: Podman Compose and Containerfiles documented for local deployment; no successful run on the operator's Windows machine is evidenced in CI.

## Not evidenced / still blocked

- Existing PostgreSQL production data export, ETL conversion, checksums, row-count comparison and financial reconciliation into MySQL.
- Real restore drill using an independent encrypted backup and a separately provisioned MySQL restore target with RTO/RPO measurements.
- MikroTik test device details, trusted CA, restricted read-only account, live HTTPS snapshot and a verified absence of router write permissions.
- Real Jaib/Jawali/Cash/One Cash/Easy receiver account ownership documents, finance sign-off and a real low-value deposit/reconciliation test.
- Any real payment provider API credentials, signed agreement, sandbox webhook verification or production settlement.
- Production deployment adapter, live health checks, monitoring/alert delivery, backup retention vault and incident response exercise.

## Release decision

Do not merge to main or claim production readiness until the applicable blocked evidence is attached, CI backend/migration/backup tests are green on the latest branch tip, the PostgreSQL-to-MySQL cutover is rehearsed and reconciled, and finance/network owners sign the acceptance record. Production CI jobs intentionally fail closed.