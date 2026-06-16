# Lease Execution Provider Integration v1

## Overview

Lease signing is implemented through a provider-neutral service layer. Routes call lease signing orchestration helpers, not provider SDKs directly. The default local provider is `mock`, and the selected production provider boundary is `dropbox_sign`.

## Provider Layer

The provider interface lives in `rentchain-api/src/services/signing/providers/types.ts`.

Providers must implement:
- send request creation
- hosted signing URL retrieval
- cancellation
- signed document download
- webhook signature validation
- webhook payload parsing

The registry lives in `rentchain-api/src/services/signing/providers/signingProviderRegistry.ts`.

## State Derivation

Lease signing state is derived from `leaseSigningRequests` and `leaseSigningEvents`.

Terminal event precedence:
- `signed`
- `cancelled`
- `rejected`
- `expired`

Operational lease state is derived with `deriveLeaseSigningState`. A signed future lease remains `signed_future`; a signed lease whose start date has arrived derives to `active`.

## API Flow

Landlord:
1. `POST /api/leases/:leaseId/send-for-signature`
2. `GET /api/leases/:leaseId/signing-status`
3. `POST /api/leases/:leaseId/download-signed`
4. `POST /api/leases/:leaseId/cancel-signing`

Tenant:
1. `GET /api/tenant/leases/:leaseId`
2. `POST /api/tenant/leases/:leaseId/sign`

Webhook:
1. `POST /webhooks/signing/:providerId?`
2. `POST /api/webhooks/signing/:providerId?`

Signer browser return:
1. `GET /signing/complete`

Provider configuration must keep the signer browser return URL separate from the
webhook callback URL:
- `SIGNING_PROVIDER_RETURN_URL` should point to the frontend completion route,
  for example `https://<frontend-host>/signing/complete`.
- `SIGNING_PROVIDER_CALLBACK_URL` remains the backend webhook endpoint,
  for example `https://<api-host>/api/webhooks/signing/dropbox_sign`.

These URLs must not be the same. Browser GET returns are safe acknowledgements
only and must not drive signing lifecycle state.

## Security Boundaries

- Landlord endpoints require landlord authentication and lease ownership.
- Tenant endpoints require active tenant workspace identity and lease involvement.
- Tenant projections never include provider request IDs, webhook metadata, landlord-only fields, or provider payloads.
- Audit records use hashes and safe provider references.
- Webhook payloads are not stored.
- Verified POST webhooks remain the authoritative source for provider lifecycle
  mutations. Browser GET returns must not write signing events or canonical
  events.

## Recovery

Invalid webhook deliveries are recorded as metadata-only dead letters. Operators can inspect the dead-letter metadata and provider dashboard without exposing raw payloads through tenant or landlord routes.

## Adding a Provider

1. Implement `ISigningProvider`.
2. Register the provider in `providers/index.ts`.
3. Add exact dependency metadata if an SDK is required.
4. Add provider-specific webhook verification tests.
5. Keep tenant-facing projections provider-neutral.
