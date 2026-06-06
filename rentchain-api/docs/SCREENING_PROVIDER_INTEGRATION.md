# Screening Provider Integration Contract

This contract defines the provider-neutral screening workflow foundation.

## Interface

Provider modules implement `IScreeningProvider` from `src/types/providerNeutralScreening.ts`.

The interface supports:

- request initiation
- webhook signature validation
- webhook payload parsing
- provider-neutral result retrieval
- provider readiness checks

## Webhook Contract

Webhook handlers receive provider-specific payloads at:

`POST /api/webhook/screening/:providerId`

The route is unauthenticated because it is provider-to-server traffic. It fails closed unless a registered provider exists, reports configured readiness, and validates the incoming signature.

Webhook logs store:

- provider id
- timestamp
- signature presence
- verification status
- payload digest
- parsed request reference
- safe error code

Webhook logs do not store raw payloads.

## Result Contract

Providers map their payloads into:

- request id
- status
- risk score
- decision recommendation
- summary
- flags
- provider request reference

Landlord projections expose only provider-neutral summaries. Tenant projections expose consent state only.

## Error Handling

Provider integrations should return deterministic safe error codes. Unknown providers, unconfigured providers, invalid signatures, missing requests, and parse failures must fail closed.

## Configuration

The provider registry starts empty. Production provider setup must explicitly register providers from environment-aware configuration. Do not hardcode provider credentials or provider-specific defaults in routes.
