# Global payment setup

The backend exposes hosted card top-ups through Stripe Checkout and USDT top-ups
through configured TRC20/BEP20 receiver addresses. Provider credentials and
wallet addresses must be supplied through environment variables; never commit
live values.

## Required configuration

- `PUBLIC_WEB_URL`: HTTPS customer-site origin in production. Stripe returns the
  customer to the wallet page on this origin.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: Stripe Checkout and signed
  webhook credentials.
- `USDT_WEBHOOK_SECRET`: at least 32 bytes, used to verify timestamped payment
  notifications from a trusted chain-monitoring service.
- `USDT_USD_RATE`: reviewed USD-per-USDT quote used when creating payment
  requests.
- `USDT_MIN_CONFIRMATIONS`: minimum chain confirmations before crediting.
- `USDT_TRC20_RECEIVER_ADDRESS` and `USDT_BEP20_RECEIVER_ADDRESS`: verified
  platform-owned deposit addresses.

Add active, non-mock `PaymentMethod` rows for `CARD`, `USDT_TRC20`, and
`USDT_BEP20` with USD support and reviewed fee/minimum/maximum values before
enabling the endpoints. New payment methods are intentionally not activated by
the schema migration. Stripe and USDT webhooks must use the exact raw request
body; the API bootstrap has raw-body capture enabled.

## Endpoints

- `POST /api/payments/topups/card` creates a Stripe Checkout session.
- `POST /api/payments/topups/usdt` returns the configured receiver address and
  exact quoted USDT amount.
- `POST /api/payments/webhooks/stripe` accepts Stripe Checkout and full-refund
  events after timestamped signature validation.
- `POST /api/payments/webhooks/usdt/USDT_TRC20` and
  `POST /api/payments/webhooks/usdt/USDT_BEP20` accept signed, confirmation-
  checked chain-monitor notifications.
- `GET /api/payments/:paymentId` returns the authenticated user's own payment
  status without exposing provider credentials.

Webhook event identifiers and provider transaction references are unique.
Wallet credit, ledger posting, payment state, and webhook event recording share
a serializable database transaction. If a refund cannot be reversed because the
customer has already spent the credit, it is marked `NeedsReconciliation` for
finance review rather than creating a negative wallet.

Binance Pay is not activated by this implementation. Configure no Binance
payment method until its certificate-based request and callback verification
adapter is implemented and tested. Real provider onboarding, live credentials,
chain monitor verification, and MySQL data cutover and reconciliation remain required
before production use.
