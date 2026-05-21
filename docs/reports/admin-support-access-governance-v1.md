# Admin and Support Access Governance v1

## Executive Summary

This report documents RentChain's current privileged operational access posture and establishes a metadata-only governance contract for admin/support access review. It does not add admin powers, impersonation tooling, route visibility, Firestore rules, JWT claims, or cross-landlord visibility.

The implementation adds deterministic helper/tests for privileged access context classification, scoped resource references, and audit-reference metadata. The helper is not wired into routes in this mission.

## Current Access Model

Current backend patterns:

- `authenticateJwt` decodes JWTs and attaches `req.user` when an Authorization header is present.
- `requireAuth` verifies RentChain auth tokens and hydrates canonical session users.
- `requireAdmin` permits users with role `admin` or explicit admin email/sub allowlists.
- `requirePermission("system.admin")` is used by many admin route families through RBAC.
- `requireLandlord` and `requireLandlordOrAdmin` allow landlord/admin role access with effective landlord context.
- `requestAuthority` centralizes actor role, actor ID, landlord/tenant scope, `actorLandlordId`, admin/support flags, and warnings/errors.
- `blockImpersonationWrites` blocks writes for the existing tenant-role/landlord-actor impersonation shape.

Current risk:

- Admin and support concepts exist across route middleware, RBAC, request authority, support forensics, and review systems, but the privileged visibility/audit expectations are still implicit.

## Privileged Route Families

Privileged routes identified in `app.build.ts` include:

- `/api/admin` support console and admin operational routes
- `/api/admin` triage, resolution, SLA, alerting, assignment, notification, support operations
- `/api/admin` observability and incident readiness routes
- `/api/admin` release, public exposure, commercial readiness, controlled integrations, production integrations, municipal readiness, ecosystem coordination, platform credentialing, consumer reporting governance, PDF export observability
- `/api/admin` properties, tenants, leases, overview, integrity, saved filters, audit, screening results, screening usage
- `/api/impersonation` existing impersonation route family

This mission does not change any route mount or route behavior.

## Privileged Visibility Semantics

Supported governance modes:

| Mode | Meaning | Visibility |
| --- | --- | --- |
| `denied` | Actor/scope is not sufficient for privileged access metadata. | internal |
| `landlord_operational` | Normal landlord-scoped operational access. | landlord operational |
| `admin_scoped_review` | Admin review of a specific landlord/tenant/resource scope. | admin/support internal |
| `admin_global_review` | Explicit system-admin review without a single landlord scope. | admin/support internal |
| `support_scoped_diagnostic` | Support diagnostic review for an explicit landlord/tenant/resource scope. | admin/support internal |

Support access should be scoped by default. Admin global review requires explicit system-admin context.

## Impersonation and Delegation Expectations

No live impersonation powers are introduced here.

Governance expectations:

- Impersonation/delegation must be explicit in server-side authority context.
- Tenant-visible UI must not receive admin/support internals.
- Write behavior during impersonation must remain blocked unless a future mission explicitly designs scoped write semantics.
- Any future support session should record actor, effective scope, reason, started/ended timestamps, and audit refs.
- `actorLandlordId` override warnings should remain visible to backend governance tooling.

## Projection Expectations

Admin/support projection surfaces may include scoped metadata and internal references, but must not include:

- raw provider payloads
- raw screening/reporting reports
- raw evidence/export payloads
- unrestricted message bodies
- payment credentials
- auth tokens/secrets
- stack traces
- route-source/debug payloads as product data
- unrelated landlord/tenant records

Tenant-safe projections must remain whitelist-based and must not include privileged review internals.

## Audit/Event Expectations

Privileged access should be audit-compatible and append-oriented:

- actor ID and role
- access mode
- requested/effective landlord and tenant scope
- route or workflow action
- resource references as internal metadata
- evidence/export/review refs as internal metadata
- timestamp
- reason or summary
- no raw sensitive payloads

The helper added in this mission builds metadata-only audit refs and sets:

- `tenantVisible: false`
- `metadataOnly: true`
- `supportSafe: true`
- `sensitivePayloadIncluded: false`
- `restrictedPayloadIncluded: false`
- `autonomousEscalationEnabled: false`

## Cross-Tenant and Cross-Landlord Risk Areas

Highest-risk areas to keep reviewing:

- broad `/api/admin` route mounts
- admin property/tenant/lease list views
- support console diagnostics
- evidence and institutional export previews
- review workspace and operational review queue linkage
- incident/security telemetry views
- impersonation route family
- debug/probe/internal diagnostic surfaces

Existing tests already cover some admin projection safety and scoped review boundaries; future route-level tests should expand coverage where privileged reads are introduced.

## Helper Contract

New helper concepts:

- `classifyAdminSupportScope()`
- `normalizePrivilegedAccessResourceRefs()`
- `buildPrivilegedAccessAuditRef()`

The helper is deterministic and metadata-only. It does not enforce permissions, mutate auth state, write audit records, or grant access.

## Known Limitations

- No full support-session framework exists.
- No new audit event writer is introduced.
- No route-level privileged access middleware changes are made.
- No institution-wide review access exists.
- Live admin/support env allowlists are not verifiable from repository files alone.
- Admin and support semantics are still split across RBAC, middleware, route-level checks, and request authority.

## Future Governance Roadmap

Recommended future missions:

1. `fix/admin-support-route-scope-regression-v1`
2. `feat/support-session-audit-log-v1`
3. `fix/impersonation-governance-and-audit-v1`
4. `fix/admin-support-projection-safety-regression-v1`
5. `feat/admin-security-incident-review-surface-v1`
6. `fix/debug-probe-production-gating-v1`
7. `feat/support-escalation-runbooks-v1`

## Confirmation

This mission does not:

- broaden admin/support visibility;
- add impersonation powers;
- change auth provider behavior;
- change JWT format;
- change Firestore rules;
- expose tenant-visible admin/support internals;
- add autonomous support escalation;
- mutate financial records;
- create cross-landlord review visibility.
