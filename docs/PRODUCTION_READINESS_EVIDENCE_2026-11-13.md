# Production Readiness — Evidence Register

هذا السجل يفرق بين ملفات/اختبارات أضيفت إلى المستودع وبين اختبارات بيئة حقيقية. نجاح CI لا يعد دليلاً على اتصال حساب بنكي أو راوتر فعلي أو نقل بيانات إنتاجية.

## Latest verified CI run — 14 November 2026

- Release branch: `release/security-db-runtime-hardening-2026-11-13`.
- Verified commit: `5e512dfe6bdcb4939c3e98721e6aad260dd1c63e`.
- GitHub Actions run: `43580888433` — quality gate, backend tests, MySQL migration/backup/restore, and monorepo build all completed successfully.
- Dependency audit: production dependencies reported 0 vulnerabilities; full dependency tree reported 9 low-severity findings, with no high or critical findings. Audit gates remained strict.
- Backend test suite: **40 test suites passed; 275 tests passed**.
- MySQL 8.4: Prisma baseline generation/application and encrypted AES-256-GCM backup/restore into a separate empty restore database passed. Restored ledger checks group by transaction and currency rather than netting currencies together.
- Build: `packages/database`, `packages/shared`, `apps/backend`, `apps/web-admin`, `apps/web-customer`, and `apps/web-saas` all built successfully. Next.js production builds for admin/customer/SaaS compiled successfully.
- Staging deployment and production release jobs were skipped by their guard conditions; this CI run does not establish a live deployment, a RouterOS connection, or a real payment-provider settlement.

## Evidence from this branch

- MySQL target schema: Prisma datasource and fresh MySQL baseline migration generation use MySQL 8.4; production database migration/data cutover has not been executed.
- npm dependency audit: latest reviewed CI run for dependency and migration workflow showed 0 production vulnerabilities; full dependency audit showed 9 low-severity findings and no high/critical findings. See GitHub Actions workflow run for the release branch.
- Read-only RouterOS client: HTTPS-only, private IPv4 guard, trusted CA verification, GET-only requests, bounded response and timeout; unit tests added. No real RouterOS session is evidenced.
- Manual Yemeni payment channels: seeded channel configs begin disabled and unverified; channel setup/proposal/finance approval is durable in MySQL with audit logs; API mode blocked pending actual provider certification.
- Manual deposit flow: deposit request starts pending; independent approval required before posting the double-entry ledger; approval closure shares the same transaction as the wallet/ledger credit.
- Operational approvals: requester/approver separation, concurrent decision protection, manual network closeout evidence, and reconciliation item closeout with exact Decimal checks.
- Production reconciliation: memory fallback prohibited; durable batch and child IDs are used for approval targets.
- Payout workflows: production sandbox payouts are blocked; the payout request and wallet hold are created atomically, finance approval uses a compare-and-set state transition, manual payout closeout posts the double-entry ledger and payout evidence in one MySQL transaction, payout UNKNOWN states retain the wallet hold, and payout read endpoints enforce owner/staff access.
- Wallet workflows: production in-memory wallet seeds/fallbacks are disabled; manual wallet-topup confirmation persists the double-entry ledger and topup state in one Serializable MySQL transaction, and freeze/unfreeze state plus audit log are recorded atomically.
- Authentication and OTP: production MFA replay protection/attempt counters and SMS OTP challenges/rate limits use shared Redis TTL keys with atomic consume/increment; no OTP challenge is verifiable until a provider confirms actual SMS delivery. Production SMS adapter intentionally remains disabled until a certified provider contract and HTTP delivery implementation are supplied.
- Emergency payment-channel kill switch: receiver-account approval cannot clear an active kill switch. A separate three-party Owner/General Manager request, approval and execution flow is persisted transactionally and always returns a channel to MANUAL only.
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