# Security Inventory

## Scope

This inventory records the current security and operational hardening baseline for RentChain Phase 3. It is audit-only documentation: no runtime source, configuration, Firestore rule, index, dependency, deployment, or data changes are part of this document.

Primary mission-listed paths were checked against the current repository. Several listed names have moved or do not exist in the present tree: `rentchain-api/src/middleware/auth.ts`, `rentchain-api/src/middleware/authorization.ts`, `rentchain-api/src/services/auth.service.ts`, `rentchain-frontend/src/contexts/AuthContext.tsx`, `rentchain-frontend/src/config/firebase.ts`, `rentchain-frontend/src/services/auth.service.ts`, `rentchain-frontend/.env.production`, `rentchain-api/.env.production`, `docs/api/auth/auth-flows.md`, `docs/api/auth/session-lifecycle.md`, `docs/governance/projections.md`, and `docs/governance/audit-immutability.md`. Current matching files are referenced below.

## Table Of Contents

1. [Authentication And Session Management](#authentication-and-session-management)
2. [Token Recovery And Reset](#token-recovery-and-reset)
3. [Role Boundaries And Authorization](#role-boundaries-and-authorization)
4. [Admin And Support Controls](#admin-and-support-controls)
5. [Audit Immutability](#audit-immutability)
6. [Firebase Initialization Security](#firebase-initialization-security)
7. [Firestore Indexes And Rules](#firestore-indexes-and-rules)
8. [Environment Isolation](#environment-isolation)
9. [Incident Readiness](#incident-readiness)
10. [Governance Zones And Projection Safety](#governance-zones-and-projection-safety)
11. [Threat Model Summary](#threat-model-summary)
12. [Security Assumptions](#security-assumptions)

## Authentication And Session Management

Current backend authentication uses two JWT verification paths. `requireAuth` extracts a Bearer token, verifies it with `verifyAuthToken`, hydrates the canonical session user, attaches `req.user` and `req.entitlements`, and maps disabled-account or scope-mismatch conditions to closed failures (`rentchain-api/src/middleware/requireAuth.ts:5-40`). The broader `authenticateJwt` middleware allows public auth and health paths, dev-only paths outside production, CORS preflight, and one tenant portal dev bypass before optionally decoding a Bearer token into `req.user` (`rentchain-api/src/middleware/authMiddleware.ts:25-124`). The main app mounts public/auth/internal routes first, then applies `authenticateJwt` globally, and later mounts protected admin, landlord, tenant, and operational routes (`rentchain-api/src/app.build.ts:370-394`, `rentchain-api/src/app.build.ts:410-633`).

JWT claims include subject, email, role, optional landlord and tenant scope, permissions, revoked permissions, impersonation attribution fields, and version `1` (`rentchain-api/src/auth/jwt.ts:4-20`). Signing requires `JWT_SECRET`; token signing defaults to seven days unless a route supplies an override (`rentchain-api/src/auth/jwt.ts:22-40`). Auth config loads environment values and has a local development fallback secret plus a two-hour `JWT_EXPIRES_IN` default (`rentchain-api/src/config/authConfig.ts:10-13`).

Session hydration can either trust token claims plus entitlement derivation or load user/account records when `AUTH_HYDRATE_FROM_DB` is enabled. The hydration path rejects disabled accounts and landlord or tenant scope mismatches, and merges entitlement, permission, revocation, and impersonation fields into the returned session user (`rentchain-api/src/services/sessionUserService.ts:99-171`, `rentchain-api/src/services/sessionUserService.ts:240-270`).

Frontend session state is stored in browser storage by `authToken` helpers. Tokens are read from session and local storage, legacy keys are migrated, and tenant tokens are separate from the main auth token (`rentchain-frontend/src/lib/authToken.ts:3-113`). `AuthContext` validates JWT shape and expiry with a short skew, restores tokens from storage, clears invalid or expired tokens, calls `/api/me` for hydration, stores login/signup/2FA tokens, and clears local state during logout (`rentchain-frontend/src/context/AuthContext.tsx:65-164`, `rentchain-frontend/src/context/AuthContext.tsx:189-210`, `rentchain-frontend/src/context/AuthContext.tsx:212-339`, `rentchain-frontend/src/context/AuthContext.tsx:341-513`). A debug overlay redacts token display to presence, length, and a preview rather than showing the bearer value (`rentchain-frontend/src/context/AuthContext.tsx:564-610`).

Frontend Firebase initialization reads Vite-provided public config and throws when required public config is missing (`rentchain-frontend/src/lib/firebase.ts:4-25`). Firebase Auth readiness and current ID token lookup are isolated in `firebaseAuthToken` (`rentchain-frontend/src/lib/firebaseAuthToken.ts:8-49`). Frontend route guards hide or redirect UI paths but do not replace backend authorization: `RequireAuth` gates missing users and unapproved landlords, `RequireAdmin` checks `/me` for admin role, `RequireRole` checks the hydrated role, and `RequireTenant` resolves tenant workspace access with a tenant token (`rentchain-frontend/src/components/auth/RequireAuth.tsx:10-140`, `rentchain-frontend/src/components/auth/RequireAdmin.tsx:20-74`, `rentchain-frontend/src/components/auth/RequireRole.tsx:11-28`, `rentchain-frontend/src/components/auth/RequireTenant.tsx:78-205`).

Current risk posture: backend token verification and route-specific guards are the enforcement boundary. Client-side route guards are present but are only navigation controls. Logout returns success without server-side token revocation (`rentchain-api/src/routes/authRoutes.ts:2144-2146`).

## Token Recovery And Reset

The audited backend auth route table contains signup, password-reset confirmation notification, onboarding token resolution and acceptance, login, demo login, 2FA verification/setup/confirm/regenerate/trust/disable, `/me`, logout, and demo status routes (`rentchain-api/src/routes/authRoutes.ts:697-2148`). The inventory did not find implemented `/api/auth/refresh`, `/api/auth/resetPassword`, or `/api/auth/verifyEmail` handlers in the current `authRoutes.ts` route list.

Password-reset confirmation notification is rate limited separately and validates email plus display name before sending a notification email. It requires an email sender value to be configured and logs delivery status without documenting any credential value here (`rentchain-api/src/routes/authRoutes.ts:38-47`, `rentchain-api/src/routes/authRoutes.ts:974-1016`). The login and signup routes use `rateLimitAuth`; login also checks `AUTH_LOGIN_ENABLED` and `PASSWORD_LOGIN_ENABLED` before accepting credentials (`rentchain-api/src/routes/authRoutes.ts:610-627`, `rentchain-api/src/routes/authRoutes.ts:1534-1729`).

Onboarding recovery and acceptance flows support contractor, tenant, and landlord invite tokens. Landlord invite lookup uses hashed token matching, expiry checks, and accepted-state checks before proceeding (`rentchain-api/src/routes/authRoutes.ts:321-594`, `rentchain-api/src/routes/authRoutes.ts:1068-1532`). Tenant auth has a separate password login route that verifies a stored password hash and signs a tenant JWT for seven days (`rentchain-api/src/routes/tenantAuthRoutes.ts:9-50`).

2FA flows use a pending token for verification and separate authenticated routes for setup, confirmation, backup-code regeneration, trusted-device issuance, and disablement (`rentchain-api/src/routes/authRoutes.ts:1805-2118`). Phone OTP support is in memory, with a 10-minute window and a maximum-send counter (`rentchain-api/src/services/phoneOtpService.ts:1-45`).

Current risk posture: reset and recovery surfaces are rate limited where implemented, and invite acceptance checks token state and expiry. The current logout endpoint does not revoke outstanding JWTs server-side.

## Role Boundaries And Authorization

Role and permission definitions are centralized in RBAC. Roles include owner, admin, landlord, contractor, manager, staff, tenant, and auditor; permission names cover property, tenant, payment, lease, screening, reporting, and system administration actions (`rentchain-api/src/auth/rbac.ts:1-26`). Role-to-permission mapping and effective permission calculation are defined in the same module (`rentchain-api/src/auth/rbac.ts:28-72`).

`requirePermission` checks `req.user.role`, calculates effective permissions with additions and revocations, and fails closed to 403 on unexpected guard errors (`rentchain-api/src/middleware/requireAuthz.ts:4-33`). `requireRole` enforces explicit role membership after `requireAuth` (`rentchain-api/src/middleware/requireRole.ts:5-23`). `requireAdmin` accepts a hydrated admin role or configured email/subject allowlists (`rentchain-api/src/middleware/requireAdmin.ts:3-30`). `requireLandlordOrAdmin` accepts landlord/admin roles, requires landlord context, and fails unauthenticated or forbidden when role or scope is missing (`rentchain-api/src/middleware/requireLandlordOrAdmin.ts:4-40`).

Request authority resolution normalizes roles including admin, landlord, tenant, operator, contractor, support, and unknown. It derives actor, user, landlord, tenant, effective landlord, and effective tenant context, records warnings/errors, and exposes helpers for landlord, tenant, and admin authority requirements (`rentchain-api/src/auth/requestAuthority.ts:1-145`).

Admin routes generally combine `requireAuth` and `requirePermission("system.admin")`, including audit, support console, support operations, observability, incident readiness, and security incident review surfaces (`rentchain-api/src/routes/adminAuditRoutes.ts:8-31`, `rentchain-api/src/routes/supportConsoleRoutes.ts:112-131`, `rentchain-api/src/routes/adminSupportOperationsRoutes.ts:108-132`, `rentchain-api/src/routes/adminObservabilityRoutes.ts:8-22`, `rentchain-api/src/routes/adminObservabilityIncidentReadinessRoutes.ts:142-171`, `rentchain-api/src/routes/adminSecurityIncidentRoutes.ts:11-40`).

Current risk posture: role and permission evaluation is centralized for permission-gated endpoints, while some route families still use hardcoded role checks or endpoint-specific helpers. Frontend role hiding exists but does not form a security boundary.

## Admin And Support Controls

Admin/support access governance is modeled as metadata. Privileged access modes distinguish denied, landlord operational, admin global review, admin scoped review, and support scoped diagnostic access. The context explicitly records tenant visibility false, cross-landlord visibility disabled, impersonation disabled, autonomous escalation disabled, financial mutation disabled, and audit requirement true (`rentchain-api/src/lib/adminSupportAccess/adminSupportAccessGovernance.ts:5-56`, `rentchain-api/src/lib/adminSupportAccess/adminSupportAccessGovernance.ts:139-207`).

Privileged access audit references normalize resource and evidence refs within landlord and tenant scope, keep records metadata-only, and mark sensitive and restricted payloads as not included (`rentchain-api/src/lib/adminSupportAccess/adminSupportAccessGovernance.ts:209-274`). Support session audit references likewise classify session state and reason, normalize resource refs, exclude sensitive/restricted/provider/evidence/export/credential data, and state that support powers, impersonation, autonomous escalation, and financial mutation are not enabled (`rentchain-api/src/lib/supportSessionAudit/supportSessionAudit.ts:52-91`, `rentchain-api/src/lib/supportSessionAudit/supportSessionAudit.ts:236-307`).

The support console resource route requires authentication plus `system.admin`, validates resource query inputs, builds a support console payload, records a redacted canonical event asynchronously, and returns the payload (`rentchain-api/src/routes/supportConsoleRoutes.ts:64-131`). Security telemetry for this access hashes IP and browser-header values, marks raw IP and raw browser-header values invisible, and keeps signals internal and non-exportable (`rentchain-api/src/routes/supportConsoleRoutes.ts:21-57`).

Support operations reads several operational collections, sanitizes records to an allowlist of fields, derives a support operations profile, and requires `system.admin` for list and detail routes (`rentchain-api/src/routes/adminSupportOperationsRoutes.ts:16-60`, `rentchain-api/src/routes/adminSupportOperationsRoutes.ts:62-132`). Admin support projection safety strips restricted key patterns and internal keys for user-safe audiences, and summarizes impersonation-like metadata for admin/support audiences (`rentchain-api/src/lib/adminSupportProjectionSafety/adminSupportProjectionSafety.ts:11-52`, `rentchain-api/src/lib/adminSupportProjectionSafety/adminSupportProjectionSafety.ts:81-158`).

Current risk posture: admin/support diagnostics are permission-gated and metadata-oriented. The audited support controls describe read/review posture and do not grant automated remediation, impersonation, or financial mutation.

## Audit Immutability

The current audit landscape includes several Firestore collections and event systems. The general `events` collection is written by `auditEventsService`, `auditEventService`, event dispatcher paths, payments/ledger/tenant/workflow services, tenant event routes, and other domain services (`rentchain-api/src/services/auditEventsService.ts:8-18`, `rentchain-api/src/services/auditEventService.ts:37-53`, `rentchain-api/src/events/eventDispatcher.ts:104`, `rentchain-api/src/routes/eventsRoutes.ts:131-248`). Admin audit events are written to `adminAuditEvents` and read by the admin audit view (`rentchain-api/src/services/admin/adminAuditEvents.ts:32-57`, `rentchain-api/src/services/admin/adminAuditView.ts:68-143`). Registry audit events are written to `registryAuditLog` (`rentchain-api/src/services/registry/registryAuditService.ts:5-27`).

Canonical audit events are append-oriented. `appendCanonicalAuditEvent` creates safe hashed references, marks records metadata-only, append-only, immutable, and raw IDs excluded, and writes with `create()` when available or refuses to overwrite an existing document before `set(..., { merge: false })` (`rentchain-api/src/lib/canonicalAudit/appendCanonicalAuditEvent.ts:60-138`). The safe append wrapper logs a skipped append rather than failing the caller if audit storage is unavailable (`rentchain-api/src/lib/canonicalAudit/appendCanonicalAuditEvent.ts:141-153`). Review state transitions and recovery intent/gate validation use this canonical audit path with metadata-only and raw-ID-excluded markers (`rentchain-api/src/lib/canonicalAudit/reviewStateTransitionAudit.ts:19-55`, `rentchain-api/src/services/recovery/recoveryIntentService.ts:139-202`, `rentchain-api/src/services/recovery/recoveryIntentService.ts:205-343`).

Canonical event writing through `writeCanonicalEvent` writes to `canonicalEvents` with `merge: false`, but it does not perform the same existing-document precheck as the canonical audit helper (`rentchain-api/src/lib/events/buildEvent.ts:11-12`, `rentchain-api/src/lib/events/buildEvent.ts:132-135`). Older `events`, `adminAuditEvents`, and `registryAuditLog` writes use add/set paths rather than a documented immutable write contract (`rentchain-api/src/services/auditEventService.ts:51-52`, `rentchain-api/src/services/admin/adminAuditEvents.ts:43-57`, `rentchain-api/src/services/registry/registryAuditService.ts:16-26`).

Audit reads are mixed. Admin audit requires `system.admin` (`rentchain-api/src/routes/adminAuditRoutes.ts:8-31`). The `auditEventsRoutes` recent, tenant, property, and debug relay routes do not call route-level `requireAuth` or `requirePermission`; when mounted after global auth decode, they rely on upstream middleware behavior and route placement (`rentchain-api/src/routes/auditEventsRoutes.ts:12-82`, `rentchain-api/src/app.build.ts:393-394`).

Security telemetry retention is defined as internal, non-portable, non-exportable metadata with 180-day active/archive and 365-day purge windows plus a 30-day purge-pending grace period. The summary explicitly states destructive purge job implementation is false (`rentchain-api/src/lib/securityTelemetry/securityTelemetryRetention.ts:10-22`, `rentchain-api/src/lib/securityTelemetry/securityTelemetryRetention.ts:76-88`, `rentchain-api/src/lib/securityTelemetry/securityTelemetryRetention.ts:197-223`).

Current risk posture: the strongest immutability semantics are in canonical audit helpers. Other audit/event collections are append-like by convention in the audited writers but are not uniformly protected by immutable helper semantics.

### Verification

Phase 3 audit immutability verification is documented in four companion files:

- `docs/security/audit-immutability-contract-v1.md` defines the append-only contract for `events`, `adminAuditEvents`, `registryAuditLog`, `canonicalEvents`, and audit-adjacent ledger event collections.
- `docs/security/audit-immutability-status-v1.md` records current writer semantics, including the full compliance of `appendCanonicalAuditEvent`, partial compliance of `writeCanonicalEvent`, and merge-risk posture of `eventDispatcher.recordDomainEvent`.
- `docs/security/audit-immutability-verification-checklist-v1.md` gives design-time PR checks and read-only operator checks for staging and production.
- `docs/security/audit-immutability-roadmap-v1.md` recommends report-only index-based verification as the next Phase 4 step before Firestore rules or schema-level enforcement.

The verification contract does not implement runtime enforcement. It documents the current state: canonical audit records have explicit immutable markers, older event collections remain append-like by convention, and general event read routes should be reviewed for explicit route-level scope guards in a future mission.

## Firebase Initialization Security

Backend Firebase Admin initialization runs the Firestore environment guard before initialization in both the canonical config path and the legacy wrapper (`rentchain-api/src/config/firebase.ts:3-18`, `rentchain-api/src/firebase.ts:1-18`). The canonical config exports Firestore, `db`, and `FieldValue`, and sets `ignoreUndefinedProperties` (`rentchain-api/src/config/firebase.ts:20-25`). It logs the configured project ID at startup (`rentchain-api/src/config/firebase.ts:27-28`).

The Firestore guard treats production startup as production mode, while non-production startup requires `FIRESTORE_EMULATOR_HOST` unless `ALLOW_LOCAL_PROD_FIRESTORE=true`. It rejects local `GOOGLE_APPLICATION_CREDENTIALS` unless the explicit override is enabled, and throws before Firebase Admin initialization on unsafe local startup (`rentchain-api/src/config/firestoreEnvironmentGuard.ts:25-88`). Local Firestore safety documentation confirms local/test processes must not access production Firestore by default and that the guard runs before Firebase Admin initialization and direct Firestore client creation in identified modules (`docs/security/local-firestore-safety-model-v1.md:3-17`, `docs/security/local-firestore-safety-model-v1.md:39-64`).

Frontend Firebase config is public client configuration from Vite environment values. The code requires the public API key and auth domain to exist, then initializes or reuses the Firebase app and returns Auth (`rentchain-frontend/src/lib/firebase.ts:4-25`). The inventory does not quote any Firebase public config values, service account values, or environment secret values.

Current risk posture: local Firestore protection is explicit and fail-fast. There are two backend Firebase wrapper paths in use, and both call the guard before creating Firestore clients.

## Firestore Indexes And Rules

The API-local Firestore rules file is fail-closed for all document reads and writes (`rentchain-api/firestore.rules:1-8`). The local Firestore safety model separately documents that root emulator rules are local-development-only and are not production authorization policy (`docs/security/local-firestore-safety-model-v1.md:66-70`).

`rentchain-api/firestore.indexes.json` currently defines 27 composite indexes and zero field overrides. Collection group counts are: `events` 3, `ledgerEvents` 5, `payments` 1, `properties` 1, `reportingConsents` 2, `ledgerEventsV2` 4, `registryImports` 1, `registryMatches` 7, and `registryAuditLog` 3 (`rentchain-api/firestore.indexes.json:1-394`).

Sensitive or governance-relevant index coverage includes event queries by landlord/application/tenant/property timestamps (`rentchain-api/firestore.indexes.json:3-59`), ledger and payment queries by tenant/property/date/event type (`rentchain-api/firestore.indexes.json:60-177`, `rentchain-api/firestore.indexes.json:247-284`), reporting consent queries by landlord/status/tenant (`rentchain-api/firestore.indexes.json:197-245`), registry import/match queue queries including search-token array contains (`rentchain-api/firestore.indexes.json:286-364`), and registry audit lookups by registry record, property, or import batch (`rentchain-api/firestore.indexes.json:365-390`).

Current risk posture: indexes expose sensitive collection and field names as deployment metadata, but they do not themselves grant read access. Current API-local Firestore rules are fail-closed.

## Environment Isolation

Backend local scripts set Firestore emulator variables for dev and test commands. `dev`, `test`, focused backend test scripts, and backend e2e scripts set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `ALLOW_LOCAL_PROD_FIRESTORE=false` before running (`rentchain-api/package.json:10-31`). The local emulator runbook states local backend development and tests must use the emulator, not local service account credentials, and documents startup failure when emulator host is missing or local credentials are present without override (`docs/runbooks/local-firestore-emulator.md:3-23`, `docs/runbooks/local-firestore-emulator.md:50-76`, `docs/runbooks/local-firestore-emulator.md:114-126`).

Local environment template audit records fake placeholder defaults, local development requirements, and production requirements for required and recommended variables without weakening boot validation. It confirms no real credentials, no live Stripe keys, no production URLs, no production email addresses, and no production environment variable changes in that template mission (`docs/qa/local-env-template-audit-v1.md:19-65`, `docs/qa/local-env-template-audit-v1.md:89-100`).

CI runs backend build and frontend tests/builds under Node 20, with frontend tests receiving a local API base URL (`.github/workflows/ci.yml:24-75`). Merge gate requires backend CI, frontend CI, and two Vercel checks before it is satisfied (`.github/workflows/merge-gate.yml:52-163`).

Current risk posture: local development and test isolation are documented and enforced by scripts plus the Firestore guard. This inventory did not find committed `.env.production` files at the mission-listed frontend or backend paths.

## Incident Readiness

Security incident governance defines incident categories, severity levels, response states, affected resource refs, evidence links, manual-only flags, and no automated token revocation, credential rotation, or account locking (`rentchain-api/src/lib/securityIncidents/securityIncidentGovernance.ts:1-88`, `rentchain-api/src/lib/securityIncidents/securityIncidentGovernance.ts:193-223`, `rentchain-api/src/lib/securityIncidents/securityIncidentGovernance.ts:277-341`). The corresponding foundation report states the same incident metadata posture and confirms no Firestore incident collection, external alerting integration, token revocation automation, credential rotation automation, account locking automation, or malware scanner integration was added by that foundation (`docs/reports/security-audit-and-incident-response-foundations-v1.md:3-8`, `docs/reports/security-audit-and-incident-response-foundations-v1.md:163-174`, `docs/reports/security-audit-and-incident-response-foundations-v1.md:197-210`).

Admin security incident review routes require `system.admin` and expose list/detail views derived from telemetry and audit event collections (`rentchain-api/src/routes/adminSecurityIncidentRoutes.ts:11-40`, `rentchain-api/src/services/admin/adminSecurityIncidentReview.ts:18-68`). Observability incident readiness routes also require `system.admin`, sanitize loaded records to allowlisted fields, and derive readiness profiles from observability events, incidents, recovery readiness, escalations, post-incident reviews, SLA evaluations, alerts, release governance, public exposure hardening, evidence packs, review sessions, and audit events (`rentchain-api/src/routes/adminObservabilityIncidentReadinessRoutes.ts:39-88`, `rentchain-api/src/routes/adminObservabilityIncidentReadinessRoutes.ts:90-171`).

System observability summary is admin-only (`rentchain-api/src/routes/adminObservabilityRoutes.ts:8-22`). Support console access records security telemetry with hashed IP and browser-header values and marks telemetry as internal, metadata-only, non-portable, and non-exportable (`rentchain-api/src/routes/supportConsoleRoutes.ts:21-57`). Security telemetry retention evaluation and summary maintain internal retention state but do not implement destructive purge jobs (`rentchain-api/src/lib/securityTelemetry/securityTelemetryRetention.ts:101-223`).

Current risk posture: incident and observability review surfaces exist for admin review, but the audited incident foundation is manual-only and does not automate containment actions.

## Governance Zones And Projection Safety

Tenant, landlord, admin/support, internal debug, export public, and export user-safe audiences are represented in projection safety code. Restricted key patterns include token, secret, password, credential, raw/provider payload, raw report, stack, authorization, and cookie keys; user-safe audiences strip internal keys and admin-support-internal payloads (`rentchain-api/src/lib/adminSupportProjectionSafety/adminSupportProjectionSafety.ts:1-52`, `rentchain-api/src/lib/adminSupportProjectionSafety/adminSupportProjectionSafety.ts:132-158`).

Support access governance keeps privileged access tenant-invisible, blocks cross-landlord visibility by default, records denied states when scope or role is invalid, and requires audit events for privileged access contexts (`rentchain-api/src/lib/adminSupportAccess/adminSupportAccessGovernance.ts:38-56`, `rentchain-api/src/lib/adminSupportAccess/adminSupportAccessGovernance.ts:139-207`). Support session audit records also mark payload data as excluded or reference-only and disable support powers, impersonation, autonomous escalation, and financial mutation (`rentchain-api/src/lib/supportSessionAudit/supportSessionAudit.ts:73-91`, `rentchain-api/src/lib/supportSessionAudit/supportSessionAudit.ts:286-306`).

Canonical audit and recovery intent paths explicitly mark metadata-only and raw IDs excluded (`rentchain-api/src/lib/canonicalAudit/appendCanonicalAuditEvent.ts:97-127`, `rentchain-api/src/services/recovery/recoveryIntentService.ts:159-179`, `rentchain-api/src/services/recovery/recoveryIntentService.ts:181-201`). These are the strongest projection-safe audit markers in the audited set.

## Threat Model Summary

The platform currently protects against unauthenticated API access through JWT verification and route-level guards, against role overreach through RBAC and request authority helpers, against tenant/landlord/admin projection leakage through server-side scope checks and projection helpers, against unsafe local Firestore access through emulator guardrails, against unbounded public token probing through rate limit profiles, and against unrestricted support diagnostics through admin permission gates and metadata-only projections.

Visible residual risk areas in the current inventory are factual, not remediation instructions: older audit/event collections do not uniformly share the canonical append helper contract; some routes depend on global auth decode plus local route behavior rather than a visible route-level permission guard; logout does not revoke already issued JWTs server-side; incident response remains manual-only; and no mission-listed production environment files were present for direct inspection.

## Security Assumptions

- JWT validation depends on `JWT_SECRET` integrity and route use of `requireAuth`, `authenticateJwt`, or equivalent guards.
- Frontend route guards are navigation controls; backend routes remain the authority boundary.
- Production Firestore access depends on backend server-side credentials and current deployment configuration, not frontend access.
- API-local Firestore rules are fail-closed, and local emulator rules are documented as local-only.
- Firestore indexes support queries but do not grant data access.
- Metadata-only and raw-ID-excluded markers are meaningful only where the writing service actually uses those contracts.
- Production credential values, service account files, and environment secrets are not committed and were not inspected in this inventory.
