# Signing Error Codes

- `lease_not_found`: lease or signing request is unavailable.
- `forbidden`: authenticated user does not own or belong to the lease.
- `invalid_tenant_email`: request did not include a valid tenant email.
- `signing_already_complete`: lease signing is already complete.
- `signing_already_pending`: signing request is already pending.
- `signing_not_started`: no provider signing request exists.
- `signing_not_pending`: cancellation attempted after pending state ended.
- `signing_not_available`: tenant signing URL cannot be issued in the current state.
- `signed_document_not_found`: signed document is unavailable.
- `provider_unavailable`: configured signing provider is missing or unavailable.
- `webhook_validation_failed`: webhook signature validation failed.
- `lease_signing_failed`: fallback safe server error.

All route responses use `{ ok: false, error: code }` and do not expose provider payloads, stack traces, secrets, or raw provider IDs.
