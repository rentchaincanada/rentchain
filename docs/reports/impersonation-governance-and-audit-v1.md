# Impersonation Governance And Audit v1

## Summary

This report documents the impersonation governance hardening for RentChain support/admin operations. The mission tightens the existing tenant impersonation route so impersonation becomes an attributable, auditable, metadata-only support/admin capability rather than an ambiguous landlord convenience flow.

No new broad support read access, auth rewrite, Firestore rule change, pricing change, payment change, screening provider change, or public workflow expansion is introduced.

## Current Flow Discovered

Existing implementation before this mission:

- Active backend route: `POST /api/impersonation/landlord/tenants/:tenantId/impersonate`
- Route owner: `impersonationRoutes.ts`
- Previous authorization: landlord/admin via `requireLandlord`
- Previous token: tenant JWT-like token issued directly with `jsonwebtoken`
- Previous token expiry: 30 days
- Previous audit: sparse `tenant_impersonation_issued` telemetry in an alternate unmounted route file
- Previous actor chain: not preserved through `requireAuth`
- Existing write guard: `blockImpersonationWrites`, only detecting `role=tenant` plus `actorRole=landlord`
- Frontend: one unused `impersonateTenant()` API helper; no active UI banner or support impersonation mode found

The alternate `landlordImpersonationRoutes.ts` route is not mounted in `app.build.ts`.

## Governance Changes

The mounted impersonation route now:

- requires authenticated `system.admin` permission
- requires an allowed reason category
- fails closed when target tenant scope is missing
- issues a short-lived 15 minute token through the existing `signAuthToken()` helper
- records safe `impersonation.started` telemetry metadata
- exposes only safe response summary metadata outside the token
- preserves route ownership under `impersonationRoutes.ts`

An explicit end route was added:

- `POST /api/impersonation/landlord/tenants/:tenantId/impersonate/end`

It records `impersonation.ended` metadata only. It does not revoke live tokens, persist session state, or add a support session store.

## Lifecycle Semantics

Supported lifecycle states:

- `requested`
- `started`
- `active`
- `ended`
- `expired`
- `revoked`
- `denied`

Unsupported states normalize to `denied` in governance helpers.

## Reason Categories

Allowed reason categories:

- `customer_support`
- `incident_review`
- `evidence_review`
- `export_review`
- `screening_review`
- `billing_support`
- `technical_diagnostics`
- `security_investigation`
- `compliance_review`

Unsupported reasons are rejected. The route does not allow arbitrary reason strings.

## Actor Chain

Impersonation tokens now carry actor-chain metadata through the existing JWT/session user pipeline:

- `realActorId`
- `realActorRole`
- `effectiveActorId`
- `effectiveActorRole`
- `impersonationSessionId`
- `impersonationReason`
- `impersonationStartedAt`
- `impersonationActive`

This distinguishes:

- the real admin/support operator
- the effective tenant account
- the target landlord scope
- the support session lineage

The helper rejects actor chains where the real actor role is not `admin` or `support`.

## Audit/Event Metadata

Added metadata helper:

- `buildImpersonationAuditEvent()`
- `buildImpersonationActorChain()`
- `buildImpersonationTelemetryMeta()`
- lifecycle/reason normalization helpers

Telemetry metadata is intentionally narrow:

- session id
- lifecycle state
- reason category
- real/effective actor ids and roles
- target account type/id
- target landlord id
- source action family
- policy decision
- internal visibility flags

Telemetry does not include:

- token values
- credentials or secrets
- tenant email
- raw tenant documents
- provider payloads
- raw screening/report payloads
- debug payloads
- route-source metadata

## Projection Safety

Impersonation metadata is marked:

- `visibilityClass: admin_support_internal`
- `metadataOnly: true`
- `tenantVisible: false`
- `supportProjectionSafe: true`

No landlord/tenant projection surfaces were added. Tenant-facing views do not receive impersonation internals.

## Fail-Closed Behavior

The route fails closed when:

- authentication is missing
- `system.admin` permission is missing
- target tenant id is missing
- reason category is missing or unsupported
- target tenant does not exist
- target tenant has no landlord scope
- actor chain cannot be established safely

Write blocking now recognizes both legacy and governed impersonation markers:

- `impersonationActive`
- `impersonationSessionId`
- legacy tenant token with `actorRole=landlord` or `actorRole=admin`

## Known Limitations

This mission does not add:

- a persisted impersonation session collection
- token revocation lists
- live session expiration checks beyond JWT expiry
- frontend impersonation banner
- support-session persistence
- tenant-visible support audit views
- SIEM or external alerting
- broad support read access

The end route records metadata only. It does not revoke previously issued JWTs. A future persisted session/revocation layer is required for server-side revocation and session replay protection.

## Future Follow-Ups

Recommended next steps:

1. Add persisted append-only support/impersonation session records.
2. Add server-side session revocation checks for impersonated tokens.
3. Add admin/support projection safety regression tests for any future impersonation surfaces.
4. Add admin security incident review surface linkage.
5. Add support escalation runbooks with manual approval expectations.
6. Add frontend support/admin impersonation banner only if a reviewed support flow is introduced.

## Guardrail Confirmation

This mission does not widen permissions, create impersonation access for non-admin actors, change Firestore rules, rewrite auth, expose tenant-visible support internals, add autonomous escalation, mutate financial records, or alter public landlord/tenant workflows.
