# Operational approvals and manual payment operations

## Manual payment operating model

Real payment gateway integration remains disabled until an officially issued merchant account, API documentation, sandbox credentials, webhook-signing secret, and production credentials are available. Do not invent an API endpoint or enable an unverified channel.

Until those items exist, use the existing manual deposit workflow:

1. Finance verifies the transfer directly in the official Jaib/Jawali/Cash/One Cash/Easy Wallet provider or approved bank channel, not from a customer screenshot alone.
2. The operator records the provider reference, currency, amount, beneficiary, statement evidence reference, and reviewer note in the deposit request.
3. The reviewer marks the item under review and checks duplicate references and currency/amount consistency.
4. A separate authorized finance approver confirms the received funds and triggers the existing ledger-backed credit path.
5. Unknown references, amount/currency mismatches, timeouts, and unclear transfers remain pending/manual review. Never auto-credit or retry an ambiguous transfer.
6. The finance team performs daily statement-to-deposit-to-ledger reconciliation and retains source evidence under the organization's retention policy.

Seed channel records now start inactive and pending finance verification. A channel must remain unavailable to customers until a real beneficiary account and instructions have been reviewed and verified; no sample destination numbers are valid.

## Four-eyes approval API

`POST /api/operational-approvals` creates a durable request for either `NETWORK_CHANGE` or `FINANCIAL_RECONCILIATION`. A request must state an allowed target, action and reason. An independent approver decides it through `POST /api/operational-approvals/:id/decision`.

Network change approvals require a different OWNER or GENERAL_MANAGER. Financial reconciliation approvals require a different FINANCE_MANAGER, GENERAL_MANAGER or OWNER. Self-approval is rejected, and the status transition is atomic to prevent two competing decisions.

`APPROVED_PENDING_EXECUTION` is deliberately not an execution signal. No MikroTik write operation and no ledger mutation is performed by this API. An operator must complete a separately reviewed change/runbook step; financial corrections must go through the existing balanced ledger service and independent evidence check.

## Required audit evidence

For every request, preserve requester, approver, action, target, reason, timestamps, source evidence, before/after state, and the separate execution record. Keep credentials, API secrets, raw payment tokens and private customer data out of approval notes.
