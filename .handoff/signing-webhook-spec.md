# Signing Webhook Spec

## Routes

- `POST /webhooks/signing/:providerId?`
- `POST /api/webhooks/signing/:providerId?`

Both routes receive raw JSON before the global JSON parser so provider signature verification can use the original request body.

## Validation

Provider lookup is based on `providerId` path parameter, query `provider`, or `SIGNING_PROVIDER`.

Validation order:
1. Provider must exist and be configured.
2. Provider signature verification must pass.
3. Payload must parse to a provider request reference, provider event reference, event type, and timestamp.
4. Matching signing request must exist.
5. Event is appended idempotently by deterministic event ID.

## Event Mapping

Canonical event types:
- `sent`
- `viewed`
- `signed`
- `rejected`
- `expired`
- `cancelled`
- `downloaded`

Provider-specific payloads are mapped inside the provider adapter.

## Error Handling

- Provider unavailable: metadata-only dead-letter record and safe error response.
- Signature failure: `webhook_validation_failed`.
- Missing request: `lease_not_found`.
- Parse failure: safe error code only, no provider payload echo.

## Safety

Webhook events store provider request and event safe references, not raw provider IDs. Payload storage is explicitly disabled.
