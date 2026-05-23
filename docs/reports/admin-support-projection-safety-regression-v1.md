# Admin Support Projection Safety Regression v1

## Summary

This report documents the projection-safety hardening added after impersonation governance was introduced. The goal is to ensure richer support/admin and impersonation metadata remains restricted to safe internal contexts and cannot leak into landlord, tenant, export, timeline, dashboard, or public-safe projections.

No auth behavior, Firestore rules, role permissions, route visibility, pricing, payments, screening provider logic, or public workflows were changed.

## Surfaces Audited

Backend surfaces inspected:

- `rentchain-api/src/auth/jwt.ts`
- `rentchain-api/src/services/sessionUserService.ts`
- `rentchain-api/src/routes/impersonationRoutes.ts`
- `rentchain-api/src/lib/impersonationGovernance/*`
- `rentchain-api/src/lib/adminSupportAccess/*`
- `rentchain-api/src/lib/supportConsole/*`
- `rentchain-api/src/routes/supportConsoleRoutes.ts`
- `rentchain-api/src/lib/timeline/timelineAdapter.ts`
- `rentchain-api/src/routes/timelineRoutes.ts`
- `rentchain-api/src/lib/institutionExports/*`
- `rentchain-api/src/lib/institutionTrustExports/*`
- `rentchain-api/src/services/tenantPortal/*`
- existing projection/redaction regression tests

Frontend surfaces inspected:

- support console API/types
- tenant workspace tests and tenant-safe visibility assertions
- operational command center/review workspace tests
- dashboard/timeline surfaces that render projected backend metadata

## Findings

PR #982 added explicit impersonation actor-chain fields to JWT/session user hydration and safe metadata-only impersonation telemetry. Those fields are intentionally useful for internal audit continuity, but they are unsafe for landlord, tenant, public export, user-safe export, analytics, dashboard, and timeline payloads unless explicitly projected.

Existing high-risk surfaces mostly used safe summaries already:

- `timelineAdapter` converts canonical events to display-only timeline items and does not project event metadata.
- `deriveInstitutionExportPackage` uses aggregate/count previews and source refs rather than raw audit event payloads.
- `supportConsole` routes are `system.admin` gated and already use redacted identifiers for diagnostics.
- tenant projection services use explicit tenant-safe contracts.

The gap was lack of a reusable audience-aware regression helper that knows about the new impersonation/support fields.

## Projection Safety Helper

Added backend helper:

- `rentchain-api/src/lib/adminSupportProjectionSafety/adminSupportProjectionSafety.ts`

Audience categories:

- `tenant`
- `landlord`
- `admin_support`
- `export_public`
- `export_user_safe`
- `internal_debug`

Unknown audience values fail safe as `export_user_safe`.

## Deny-By-Default Internal Fields

For tenant, landlord, public export, user-safe export, and unknown audiences, the helper strips:

- `realActorId`
- `realActorRole`
- `effectiveActorId`
- `effectiveActorRole`
- `impersonationSessionId`
- `impersonationReason`
- `impersonationStartedAt`
- `impersonationActive`
- `actorChain`
- `supportProjectionSafe`
- `visibilityClass`
- `sourceActionFamily`
- `policyDecision`
- `internalOnly`
- `tenantVisible`
- `debug`
- `debugPayload`
- `internalDebug`
- `routeSource`
- token, secret, credential, authorization, cookie, stack, raw payload, provider payload, and raw report fields

Objects marked `visibilityClass: admin_support_internal` project to an empty safe object for user-facing audiences.

## Admin/Support Safe Summaries

For `admin_support` and `internal_debug`, impersonation-like metadata projects to a metadata-only summary:

- `sessionId`
- lifecycle state
- reason category
- timestamps
- actor role summary without raw actor ids
- target summary without raw target ids
- policy outcome summary
- `metadataOnly: true`
- `tenantVisible: false`
- `supportSafe: true`

This preserves operational review value without exposing raw actor-chain identifiers in generic support projections.

## Export Protection

Institution export previews were regression-tested with an impersonation audit event containing raw actor-chain metadata, provider payloads, token-like values, debug payloads, and internal visibility flags.

The generated export preview keeps only count/source-reference lineage:

- audit event count
- deterministic audit event source id
- no raw support/admin metadata
- no actor-chain fields
- no token/debug/provider values

No new export categories were added.

## Timeline / Dashboard Protection

Timeline conversion was regression-tested with impersonation metadata embedded in a canonical event. The resulting timeline item contains only title, summary, timestamp, domain, status, and actor label fields. Raw metadata and actor-chain fields are not projected.

Dashboard and operations surfaces continue consuming their existing safe summaries; no frontend projection behavior was changed.

## Known Limitations

- This mission does not retrofit every historical projection helper to call the new sanitizer at runtime.
- Support console routes remain admin-gated and can show dedicated safe diagnostic resources; future support surfaces should use this helper or an equivalent audience-aware projection contract.
- Future persisted impersonation sessions should use the same audience categories before any landlord, tenant, export, or timeline projection.
- Server-side revocation/session persistence remains outside this mission.
- Tenant trust exports remain JSON-first as the canonical audit package in this phase. A future mission should add a tenant-friendly PDF trust export summary while preserving JSON as the canonical, projection-safe audit package.

## Guardrail Confirmation

This mission does not widen support/admin access, expose support internals to landlord/tenant views, change auth behavior, alter Firestore rules, add dependencies, change provider/payment/pricing logic, create routes, or add public workflows.
