# Recovery Workflow Security Audit v1

## Scope

This document records the Phase 3 Mission 9 security review of RentChain recovery workflows. It is audit-only documentation. It does not change runtime source, authentication flows, Firestore rules, indexes, dependencies, deployment configuration, or production data.

Reviewed implementation areas:

- `rentchain-api/src/routes/adminRecoveryRoutes.ts`
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/services/recovery/`
- `rentchain-api/src/types/recovery.ts`
- `rentchain-api/src/middleware/requireAuth.ts`
- `rentchain-api/src/middleware/requireAuthz.ts`
- `rentchain-api/src/middleware/requireAdmin.ts`
- `rentchain-api/src/middleware/rateLimit.ts`
- `rentchain-api/src/lib/canonicalAudit/appendCanonicalAuditEvent.ts`
- `rentchain-api/src/lib/adminSupportAccess/adminSupportAccessGovernance.ts`
- `rentchain-api/src/lib/adminSupportProjectionSafety/adminSupportProjectionSafety.ts`
- `docs/security/security-inventory.md`
- `docs/security/audit-immutability-contract-v1.md`
- `docs/security/token-refresh-recovery-contract-v1.md`
- `docs/audit/canonical-audit-events-v1.md`

## Current Recovery Surface

No tenant-facing recovery route module was found in the current tree. The active recovery API surface is mounted from `adminRecoveryRoutes.ts` at `/api/admin` in `app.build.ts`.

| Method | Path | Handler | Current auth guard | Permission guard | Rate limit | Response shape |
| --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/api/admin/recovery/inspect` | `inspectWorkflowState`, `buildDecisionReconciliation` | `requireAuth`, then route-local admin/support role check | None | None specific | `{ ok, reconciliation, degraded, degradedReason }` |
| `POST` | `/api/admin/recovery/reconcile` | `applyReconciliationDecision` | `requireAuth`, then route-local admin/support role check | None | None specific | `{ ok, recoveryLog }` |
| `GET` | `/api/admin/recovery/logs` | `listRecentRecoveryActions`, `listRecentRecoveryIntents`, optional `findWorkflowsNeedingRecovery` | `requireAuth`, then route-local admin/support role check | None | None specific | `{ ok, logs, intents, candidates }` |
| `GET` | `/api/admin/recovery/logs/:logId` | `loadSnapshot` against `operatorRecoveryLogs` | `requireAuth`, then route-local admin/support role check | None | None specific | `{ ok, recoveryLog }` |
| `POST` | `/api/admin/recovery/:recoveryId/intent` | `captureRecoveryActionIntent` | `requireAuth`, then route-local admin/support role check | None | None specific | `{ ok, intent }` |
| `POST` | `/api/admin/recovery/:recoveryId/gate/validate` | `validateRecoveryActionGate` | `requireAuth`, then route-local admin/support role check | None | None specific | `{ ok, gate }` |

The routes are mounted after global JSON parsing and after earlier public, auth, internal, and operational route mounts. Each recovery handler still calls `requireAuth` directly before executing recovery logic. Missing or invalid Bearer tokens fail closed through `requireAuth`, disabled-account and landlord/tenant scope mismatch errors map to closed failures, and non-operator roles fail the recovery route's local role gate.

## Authorization Review

Recovery route authorization is implemented through:

- `requireAuth`, which verifies a server-side Bearer token and hydrates the canonical session user.
- `authorityFromRequest`, which derives a recovery authority from `req.user.actorRole || req.user.role`, `req.user.uid || req.user.id`, and `req.user.landlordId || req.user.accountOwnerId`.
- `requireOperator`, which allows only `admin` and `support`.
- Service-level `isOperatorAuthority` checks in `inspectWorkflowState`, `applyReconciliationDecision`, `getRecoveryHistory`, `listRecentRecoveryActions`, `findWorkflowsNeedingRecovery`, `captureRecoveryActionIntent`, `listRecentRecoveryIntents`, and `validateRecoveryActionGate`.

Tenant and landlord callers are denied by the route-local role check and by service-level authority checks. The current implementation does not call `requirePermission("system.admin")`, `requireAdmin`, or `classifyAdminSupportScope` on recovery routes. That means authorization is role-based rather than the stronger permission-governed admin/support pattern used by many neighboring admin routes.

Cross-landlord controls are limited in the recovery path because current recovery endpoints operate on hashed workflow instance keys and do not accept an explicit landlord scope. `normalizeRecoveryAuthority` records a safe landlord reference when present, but recovery reads and list endpoints are not filtered by landlord reference. This is acceptable only for admin-global review. It is weaker for support-scoped diagnostic access because support access governance normally requires an explicit landlord scope.

Current posture: unauthenticated, tenant, and landlord access fails closed. Permission-level admin governance and support scoped diagnostic governance are not yet enforced on recovery routes.

## Input Validation And State Safety

Implemented validation:

- `workflowType` is constrained to `screening`, `lease`, `maintenance`, `payment`, or `decision`.
- `workflowId` is normalized through `asSafeText` and capped at 240 characters.
- Workflow IDs containing `/`, `\`, or NUL are treated as unsafe and return a degraded safe inspection rather than querying raw document paths.
- `decisionType` is constrained to `ACCEPT_CANONICAL`, `ACCEPT_DERIVED`, or `EVIDENCE_REVIEW_REQUIRED`.
- Intent `actionType` is constrained to `ACCEPT_CANONICAL`, `ACCEPT_DERIVED`, or `EVIDENCE_REVIEW_REQUIRED`.
- Intent capture requires a non-empty reason and `authorizationConfirmed: true`.
- Reasons and reason codes are normalized, stripped of angle brackets, whitespace-collapsed, and length-capped.
- Duplicate recovery logs and duplicate captured intents are rejected.
- No implementation path mutates the original decision continuity snapshot.

Current gaps:

- The route accepts broad Express JSON payloads up to the app-level 10 MB body limit. Reason fields are truncated to 800 characters rather than rejected when oversized.
- Malformed workflow IDs beyond slash, backslash, and NUL checks are not rejected consistently. The inspect path returns degraded `200` for unsafe references; mutation paths can return `400` or `404` depending on lookup behavior.
- State-machine validation is divergence-based, not a full transition matrix. `applyReconciliationDecision` blocks no-op recovery and invalid decision types, but it does not enforce a domain-specific pending-to-approved style state transition graph.
- `GET /api/admin/recovery/logs` accepts `limit` as `Number(query.limit || 25)` and clamps inside service calls. Non-numeric values are not explicitly rejected, but service slicing currently yields an empty result rather than a server error.

Current posture: recovery requests have meaningful type and decision validation, and unsafe raw path references are handled safely. Oversized payload rejection and formal state-machine transition validation should be tightened in a future mission.

## Rate Limiting Review

`rateLimit.ts` defines profiles for auth-sensitive, public-token, tenant-workspace-entry, evidence-export-review, internal-job, diagnostics, screening, tenant invite, and referral surfaces. `app.build.ts` applies those profiles to diagnostics, public token routes, internal jobs, landlord evidence/export/review surfaces, and tenant invite entry points.

No rate limiter is applied to `/api/admin/recovery` at the app mount, router level, or individual recovery endpoint level. Recovery mutation endpoints and recovery inspection/list endpoints therefore rely on authentication only and are not explicitly protected against repeated authorized or credential-stuffed requests.

Current posture: rate limiting is a high-priority gap for recovery workflows.

## Audit Logging And Immutability

Implemented audit and append-safe behavior:

- `captureRecoveryActionIntent` writes append-only intent records to `operatorRecoveryIntents`.
- `captureRecoveryActionIntent` emits `recovery_intent_captured` through `appendCanonicalAuditEventSafely`.
- `validateRecoveryActionGate` emits `recovery_gate_validated` for missing, mismatched, stale, and satisfied gate validations.
- Canonical audit records are written to the existing `canonicalEvents` collection with `metadataOnly`, `appendOnly`, `immutable`, and `rawIdsIncluded: false`.
- `appendCanonicalAuditEvent` uses Firestore `create()` when available and otherwise refuses to overwrite an existing document before `set(..., { merge: false })`.
- Canonical audit append failures are logged and do not block the recovery caller.
- Recovery logs and timeline entries use `appendDocument`, which also prefers `create()` and otherwise checks existence before `set(..., { merge: false })`.

Current audit gaps:

- `applyReconciliationDecision` writes `operatorRecoveryLogs` and `canonicalRecoveryTimelineEntries`, but it does not emit a canonical audit event for the reconciliation decision itself.
- `GET /api/admin/recovery/logs` and `GET /api/admin/recovery/logs/:logId` read recovery logs without recording privileged access metadata through `adminSupportAccessGovernance`.
- Audit event metadata includes normalized reason summaries. These are capped and stripped of angle brackets, but the current code does not classify or reject sensitive reason text supplied by an operator.

Current posture: recovery intent and gate validation have strong canonical audit coverage. Reconciliation decisions and privileged recovery-log reads should be added to canonical audit coverage in a future mission.

## Projection Safety Review

Implemented safety controls:

- Workflow instance keys use deterministic hashes rather than raw workflow IDs.
- Recovery audit actor and authority references are safe references with `rawIdsIncluded: false`.
- Recovery logs, intents, and timeline entries carry `metadataOnly`, `appendOnly`, and `rawIdsIncluded: false`.
- Route tests assert that inspected and listed recovery payloads do not expose seeded raw workflow IDs, provider payload markers, storage URLs, secret tokens, or bearer secrets.
- `GET /api/admin/recovery/logs/:logId` refuses records unless `rawIdsIncluded === false`.

Current projection gaps:

- Recovery routes do not call `projectAdminSupportMetadataForAudience` or `stripAdminSupportInternalsForUser`.
- Candidate listing can return reconciliation objects derived from decision continuity snapshots. The current service constructs metadata-only reconciliation payloads, but it does not route the final response through the admin/support projection safety helper.
- Support-scoped diagnostic access is not narrowed through `adminSupportAccessGovernance`, so projection safety depends on hashed recovery structures instead of explicit privileged access context.

Current posture: current recovery payloads are metadata-oriented and tested against common raw-ID and sensitive-payload leakage. Explicit admin/support projection helper usage is still missing.

## Token And Session Boundaries

The recovery route and service layer do not create JWTs, refresh JWTs, extend session lifetimes, accept tenant-provided tokens as recovery authority, or issue trusted-device material. Recovery authorization is bound to the server-verified `req.user` created by `requireAuth`.

The existing token recovery contract confirms unsupported refresh/reset/verify endpoints are not implemented and that logout does not perform server-side token revocation. Recovery workflows do not change that contract.

Current posture: no token issuance or session-extension behavior was found in recovery workflows.

## Error Handling And Information Leakage

Implemented behavior:

- Route errors map to generic error codes such as `FORBIDDEN`, `RECOVERY_WORKFLOW_NOT_FOUND`, `RECOVERY_ALREADY_LOGGED`, `RECOVERY_INTENT_ALREADY_CAPTURED`, `RECOVERY_NOT_REQUIRED`, `RECOVERY_REQUEST_INVALID`, and `RECOVERY_ROUTE_FAILED`.
- The inspect route logs unhandled 500-level errors to the server and returns a generic code to callers.
- Unsafe workflow references return degraded diagnostics instead of raw lookup details.
- JSON parse failures are handled globally with `INVALID_JSON_BODY`.

Current gaps:

- The inspect route logs error message and stack on unhandled failures. Stack traces are not returned to the client, but logs should be reviewed for raw identifier or sensitive payload risk.
- Other recovery routes do not consistently log unexpected 500-level errors, which makes operational incident review weaker.
- Oversized payloads rely on the global 10 MB JSON parser limit rather than endpoint-specific validation, so malformed large recovery requests are not rejected with a recovery-specific 400.

Current posture: client-facing errors are generic. Server-side logging and endpoint-specific malformed payload handling need hardening.

## Cross-Service Coordination

Recovery inspection compares decision continuity snapshots, canonical recovery timeline entries, and state-machine provenance events. Reconciliation proposals are derived from divergence categories and remain manual-review-oriented. Intent capture and gate validation are advisory controls that do not mutate source state.

The current system coordinates with state-machine provenance storage and decision continuity snapshots. It does not directly coordinate recovery with billing, entitlement, screening provider adapters, token revocation, or automated incident response. That is consistent with the mission's manual-only recovery posture and protected-area boundaries.

Current posture: recovery workflow coordination is deterministic and supervised, with no hidden autonomous remediation found.

## Test Coverage Review

Existing recovery-focused tests:

- `rentchain-api/src/routes/__tests__/adminRecoveryRoutes.test.ts`
- `rentchain-api/src/services/recovery/__tests__/recoveryIntentService.test.ts`
- `rentchain-api/src/services/recovery/__tests__/decisionStateInspector.test.ts`
- `rentchain-api/src/services/recovery/__tests__/decisionReconciliationService.test.ts`

Coverage present:

- Admin/support-only route access, including tenant denial.
- Safe degraded inspection for unsafe lease references.
- Append-only recovery logs and intent records.
- Intent gate validation for missing, stale, mismatched, and satisfied intents.
- Raw workflow ID and sensitive marker exclusion in selected route payloads.
- Duplicate intent and duplicate reconciliation rejection.
- Source snapshot non-mutation.

Coverage gaps:

- No `timelineRecoveryService.test.ts` file exists, even though the mission-listed expected coverage includes one.
- No direct route tests assert missing or invalid Bearer token behavior against the real `requireAuth` middleware; route tests mock `requireAuth`.
- No route tests assert `requirePermission("system.admin")` because the routes do not use it.
- No rate-limit tests cover recovery endpoints.
- No oversized-payload rejection tests cover recovery endpoints.
- No direct test asserts that `applyReconciliationDecision` emits a canonical audit event because it currently does not.

## Remediation Checklist

| Priority | Finding | Risk | Recommended fix | Scope |
| --- | --- | --- | --- | --- |
| High | Recovery routes use `requireAuth` plus route-local admin/support role checks, but not `requirePermission("system.admin")` or `requireAdmin`. | Admin/support recovery access can diverge from central permission governance and revoked-permission handling. | Add explicit `requirePermission("system.admin")` or a documented recovery-specific permission guard before recovery handlers. | Future mission |
| High | No endpoint-level or mount-level rate limiting protects `/api/admin/recovery`. | Brute-force inspection, repeated mutation attempts, and credential-stuffed admin-token abuse are not throttled by a recovery profile. | Add a recovery rate-limit profile, with tighter mutation limits and reasonable read/list limits keyed by actor-or-IP. | Future mission |
| High | Support access is not scoped through `adminSupportAccessGovernance`. | Support diagnostics can behave as global recovery review rather than scoped support access. | Require privileged access context for support role calls, including requested landlord scope where appropriate. | Future mission |
| Medium | Reconciliation decisions append recovery logs and timeline entries but do not emit canonical audit events. | Important recovery state decisions are absent from the canonical audit event stream. | Add a `recovery_reconciliation_recorded` canonical audit event type or reuse a documented event type with metadata-only safe references. | Future mission |
| Medium | Recovery route responses are not passed through `adminSupportProjectionSafety` helpers. | Projection safety depends on bespoke recovery structures and tests rather than the shared projection contract. | Apply `projectAdminSupportMetadataForAudience(..., "admin_support")` before returning recovery logs, intents, candidates, and inspections. | Future mission |
| Medium | Reason fields are truncated, not rejected, when oversized. | Operators may believe full rationale was captured while audit/log records silently contain partial reason text. | Reject oversized reasons and reason codes with `400 RECOVERY_REQUEST_INVALID`. | Future mission |
| Medium | Recovery state safety is divergence-based, not a formal state-machine transition matrix. | Invalid operational transitions may be logged as acceptable recovery decisions if divergence classification is insufficient. | Define allowed recovery transition paths by workflow type and return `409` for invalid recovery state transitions. | Future mission |
| Medium | No `timelineRecoveryService.test.ts` exists. | Timeline projection and append semantics are only indirectly tested through reconciliation service tests. | Add focused timeline service tests for metadata-only entries, raw-ID exclusion, append semantics, and sensitive text handling. | Future mission |
| Low | Inspect route logs unhandled error stack details server-side. | Internal logs may capture raw identifiers if upstream failures include sensitive error messages. | Replace stack logging with `safeOperationalLog` and sanitized fields. | Future mission |
| Low | Recovery workflow documentation was not previously centralized. | Operators lacked one document listing route guards, rate-limit status, projection posture, and future remediation. | This audit document addresses the documentation gap. | In scope |

## Acceptance Confirmation

- Recovery endpoints were identified and documented with method, path, guard, rate-limit status, and response shape.
- Authentication and authorization boundaries were reviewed against `requireAuth`, `requirePermission`, `requireAdmin`, route-local checks, and service-level checks.
- Input validation, state safety, rate limiting, canonical audit, projection safety, token/session, error handling, and cross-service coordination were reviewed.
- No production data was mutated.
- No Firestore rules, auth core, billing, entitlement, deployment, or screening provider files were changed.
- Remediation items are documented as future missions except for this audit document itself.

## Recommended Next Mission

Implement recovery endpoint hardening in this order:

1. Add recovery-specific rate limiting and route tests.
2. Add explicit `requirePermission("system.admin")` or a recovery-specific permission guard.
3. Add admin/support access governance and projection helper use in recovery route responses.
4. Add canonical audit coverage for reconciliation decisions.
5. Add endpoint validation for oversized reasons and formal recovery transition rules.
