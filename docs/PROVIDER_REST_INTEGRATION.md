# External Provider REST Integration

This document configures provider integrations only from that provider's official API documentation. The platform deliberately does not ship invented API hosts, paths, credentials, or response semantics.

## Admin endpoints

- `PATCH /api/providers/admin/:id/integration` — save the REST contract and encrypted authentication.
- `POST /api/providers/admin/:id/test-connection` — perform a real health request, or a balance request when no health route is configured.
- `POST /api/providers/admin/:id/orders/check-status` — query a provider transaction. This route records the result for review; it does not itself complete an internal order or post a ledger entry.

All endpoints require a valid administrator bearer token and appropriate RBAC role. Configuration and test operations are rate limited and recorded in the audit log.

## Configuration body

The provider record must already exist. The integration update accepts:

```json
{
  "baseUrl": "https://official-api-host.example",
  "authentication": {
    "type": "BEARER",
    "secret": "REPLACE_WITH_SECRET_FROM_PROVIDER"
  },
  "timeoutMs": 10000,
  "endpoints": {
    "health": { "path": "/v1/health", "method": "GET" },
    "balance": {
      "path": "/v1/account/balance",
      "method": "GET",
      "responseMapping": { "balance": "data.available", "currency": "data.currency" }
    },
    "validatePlayer": {
      "path": "/v1/player/validate",
      "method": "POST",
      "requestTemplate": {
        "player_id": "{{fields.player_id}}",
        "zone_id": "{{fields.zone_id}}"
      },
      "responseMapping": {
        "valid": "data.valid",
        "playerName": "data.nickname",
        "zoneName": "data.zone",
        "errorMessage": "message"
      }
    },
    "submitOrder": {
      "path": "/v1/orders",
      "method": "POST",
      "requestTemplate": {
        "client_reference": "{{orderNumber}}",
        "sku": "{{providerSku}}",
        "account": "{{playerFields.player_id}}",
        "amount": "{{amount}}",
        "currency": "{{currency}}"
      },
      "responseMapping": {
        "status": "data.status",
        "orderId": "data.transaction_id",
        "serialNumber": "data.serial",
        "pinCode": "data.pin",
        "errorMessage": "message",
        "errorCode": "code"
      }
    },
    "checkOrderStatus": {
      "path": "/v1/orders/status",
      "method": "POST",
      "requestTemplate": {
        "transaction_id": "{{providerOrderId}}",
        "client_reference": "{{internalOrderNumber}}"
      },
      "responseMapping": {
        "status": "data.status",
        "orderId": "data.transaction_id",
        "serialNumber": "data.serial",
        "pinCode": "data.pin",
        "errorMessage": "message",
        "errorCode": "code"
      }
    }
  }
}
```

The values above are a structural example only. Replace every host, path, request field and response path with the exact values from the specific provider's documentation. Do not paste a production secret into a source file, ticket, log, or chat.

Supported authentication:
- `NONE`: only for a provider endpoint documented as public.
- `BEARER`: HTTP Authorization Bearer token.
- `API_KEY_HEADER`: provider-documented header name and API key.

Each endpoint supports GET or POST. POST payload fields are rendered from the known context using `{{path.to.value}}`. A value that occupies the whole template string preserves its JSON type; embedded substitutions render as strings.

## Network and response safety

Before any request, the configured host must be present in `PROVIDER_ALLOWED_DOMAINS` (comma-separated hostnames, no URL schemes). DNS is resolved and every returned address is checked against private, loopback, link-local and restricted ranges. Provider requests are HTTPS-only in production, redirects are not followed, timeouts are capped at 30 seconds, response bodies are capped at 64 KiB, and response JSON must match the configured mappings.

Credentials and endpoint mappings are saved together in the encrypted provider credentials field. The API never returns the encrypted value or raw secret. The provider host must also match the allowlist at runtime; use exact, documented hostnames rather than broad wildcard entries.

## Order-state semantics

The provider response mapping must map the provider's documented final states:
- success-like values: `SUCCESS`, `SUCCEEDED`, `COMPLETED`, `FULFILLED`, `DONE`.
- failure-like values: `FAILED`, `FAILURE`, `REJECTED`, `CANCELLED`, `ERROR`.
- all other values remain `PENDING`.

A successful submit response must include a provider transaction ID. An HTTP error, timeout, redirect, DNS failure, malformed JSON, incomplete response, or ambiguous status does not count as successful fulfillment. The order must remain held and move through the existing manual review/reconciliation path. A status query also does not settle an order automatically.

## Information required before a real provider can be enabled

For each provider, collect and independently verify:
1. Legal provider name and official developer portal/documentation URL.
2. Production and sandbox base URLs and the exact hostnames to allowlist.
3. Authentication method, token issuance/rotation process, and credential owner.
4. Player-validation endpoint, required fields, request examples and response schema.
5. Order-submission endpoint, idempotency/reference semantics, and definitive success/failure states.
6. Order-status endpoint and how to safely query an unknown/timeout submission.
7. Balance endpoint, currency, unit/decimal precision and available-versus-ledger balance meaning.
8. Rate limits, IP allowlisting requirements, webhook/signature details, SLA and support escalation.
9. Approved test account / test SKU and written authorization to call production endpoints, if a sandbox is unavailable.

Until these details have been supplied and tested, leave the provider inactive or retain manual fulfillment. No real provider is considered connected merely because its configuration form has been saved.
