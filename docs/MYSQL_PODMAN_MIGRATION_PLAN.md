# MySQL 8.4 LTS and Podman migration

## Decision
The new application schema/runtime target MySQL 8.4 LTS (InnoDB) and Podman Desktop + Podman Compose. PostgreSQL remains only as a controlled source/export path during data migration; Docker Desktop is no longer required for the documented Windows workflow.

## Implemented in this branch
- Prisma datasource changed to MySQL. MerchantApiCredential.ipWhitelist is JSON because Prisma scalar lists are not supported by the MySQL connector.
- PostgreSQL-specific monitoring SQL replaced with MySQL/InnoDB queries.
- PIN reservation retains transactional row-level locking and SKIP LOCKED with MySQL identifier quoting.
- Compose uses MySQL 8.4, password-protected Redis, loopback-only local ports and optional pinned Adminer.
- Existing PostgreSQL backup/restore tools are preserved as db:backup:postgres and db:restore:postgres.
- CI generates a fresh MySQL baseline migration and attempts to apply it against an isolated MySQL 8.4 service.

## Production data cutover is not performed by CI
1. Freeze writes through an approved maintenance/read-only window.
2. Create and verify an encrypted PostgreSQL source backup with npm run db:backup:postgres and test restoring it into an isolated PostgreSQL restore database.
3. Create a separate MySQL 8.4 target. Never import into production before a complete rehearsal.
4. Use a reviewed PostgreSQL-to-MySQL ETL. Transform PostgreSQL TEXT[] into JSON and validate IDs, decimals, timestamps, enums, relationships, indexes and unique constraints.
5. Compare row counts/checksums and reconcile wallet balances, debit/credit totals per currency, payment/deposit states, orders, PIN inventory and idempotency references.
6. Run read/write, concurrency/deadlock, encrypted backup and restore-to-second-empty-database tests.
7. Obtain owner + finance sign-off, retain the PostgreSQL snapshot, and only then switch the production connection. Never dual-write.

## Podman on Windows
Install Podman Desktop, initialize/start Podman Machine and enable a Compose provider. Run scripts/setup-podman.ps1, copy .env.example to .env, configure every required secret, then run scripts/start-platform-podman.ps1. Development ports bind to localhost.

## Evidence not available yet
- No production PostgreSQL database was accessed or modified.
- No production rows were imported to MySQL; cutover awaits rehearsal and financial reconciliation.
- No live MikroTik, payment provider or production credentials were available to CI.
- Staging/production promotion jobs intentionally fail closed until deployment, health, backup/restore and ledger-conservation checks are executable.
