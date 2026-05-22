# Admin Support Route Scope Regression v1

## Executive summary

This mission adds regression protection for RentChain's privileged admin/support route scope boundaries. It does not add admin powers, support-session tooling, impersonation powers, route visibility, Firestore rules, JWT changes, autonomous escalation, or product behavior.

The hardening is test and documentation focused:

- privileged admin/support route mounts are pinned ahead of broad fallback routers;
- admin/support metadata references remain scoped, internal, and metadata-only;
- unrelated landlord/tenant/resource references are excluded from privileged audit references;
- debug/probe/internal diagnostics remain governed by the existing diagnostic and internal-token posture;
- existing admin/support readiness routes remain projection-safe and internal-only.

## Privileged route families audited

High-risk route families reviewed in `rentchain-api/src/app.build.ts` and related tests:

| Surface | Current owner | Risk class | Regression posture |
| --- | --- | --- | --- |
| `/api/admin/support-console/*` | `supportConsoleRoutes.ts` | support diagnostics | Mounted before generic admin routes; existing tests verify metadata-only support diagnostics and redacted audit events. |
| `/api/admin/support-operations/*` | `adminSupportOperationsRoutes.ts` | support readiness | Mounted before generic admin routes; existing tests verify admin-gated access and sensitive payload exclusion. |
| `/api/admin/observability-incident-readiness/*` | `adminObservabilityIncidentReadinessRoutes.ts` | incident/security readiness | Mounted before generic admin routes; existing tests verify admin-gated access and sensitive telemetry exclusion. |
| `/api/admin/public-exposure-hardening/*` | `adminPublicExposureHardeningRoutes.ts` | public exposure readiness | Mounted before generic admin routes; existing tests verify no secrets/tokens/credential payload leakage. |
| `/api/admin/pdf-export-observability/*` | `adminPdfExportObservabilityRoutes.ts` | export observability | Mounted before generic admin routes; existing tests verify admin-only access and whitelisted PDF metadata. |
| `/api/admin/*` generic admin | `adminRoutes.ts` and admin route family | privileged operations | Existing auth tests verify representative admin routes require admin authority. |
| `/api/impersonation/*` | `impersonationRoutes.ts` | authority-sensitive delegation | Route ownership is pinned before broad screening/admin fallback routes; no new impersonation capability is introduced. |
| `/api/internal/*` | internal route family | internal jobs/diagnostics | Existing internal-token gates remain unchanged. |
| `/api/__probe/*`, `/api/__debug/*`, `/api/_echo`, `/api/_build` | diagnostic surfaces | debug/probe | Existing diagnostic gating and build metadata redaction remain unchanged. |

## Authority assumptions

Current privileged access relies on existing server-side controls:

- `requireAuth` verifies authenticated user context.
- `requireAdmin` and `requirePermission("system.admin")` gate admin route families.
- `requireLandlord`, `requireLandlordOrAdmin`, and `requestAuthority` preserve landlord/tenant authority semantics in landlord-scoped surfaces.
- `INTERNAL_JOB_TOKEN` gates internal job routes and production diagnostics where applicable.
- Admin/support helper metadata remains internal and does not grant permissions.

This mission does not change any of those controls.

## Route ownership findings

The API still contains many broad `/api` and `/api/admin` mounts, so route order remains part of the API contract. The new regression assertions pin representative high-risk privileged routes before:

- generic `adminRoutes.ts`;
- broad `screeningJobsAdminRoutes.ts`;
- the final `/api` catchall.

This reduces the risk that support, incident, export-observability, or impersonation routes silently fall through to unrelated handlers as new route families are added.

## Projection-safety expectations

Admin/support route payloads and helper metadata must not expose:

- raw provider payloads;
- raw screening/reporting reports;
- raw evidence/export payloads;
- unrestricted message bodies;
- payment credentials;
- tokens, secrets, cookies, or webhook secrets;
- stack traces;
- debug payloads;
- route-source metadata as product data;
- unrelated landlord/tenant/resource references.

The new helper-level regression tests assert that scoped admin/support audit references are metadata-only, tenant-internal fields are not tenant-visible, and unrelated evidence/export/review refs are removed.

## Regression coverage added

Added or extended deterministic coverage:

- `apiRouteOwnershipRegression.test.ts`
  - pins support console, support operations, incident readiness, public exposure hardening, PDF export observability, and impersonation route ownership;
  - prevents these high-risk route families from drifting behind generic admin/fallback routes.
- `adminSupportAccessGovernance.test.ts`
  - asserts scoped support diagnostic references remain metadata-only;
  - excludes unrelated landlord/tenant evidence/export/review refs;
  - confirms admin/support contexts do not imply impersonation, financial mutation, tenant-visible internals, or autonomous escalation.

## Scope risks discovered

No runtime scope leak was fixed in this mission. The audit did confirm persistent structural risks:

- broad `/api` and `/api/admin` mount order remains fragile;
- admin/support route families use a mix of `requireAdmin`, `requirePermission("system.admin")`, route-local role checks, and derived governance helpers;
- no full support-session audit system exists yet;
- no full impersonation governance framework exists yet.

These are documented follow-up risks, not behavior changes in this PR.

## Known limitations

- Tests pin representative high-risk route families, not every admin route in the repository.
- This does not create an institution-wide review access model.
- This does not add tenant-visible support/admin state.
- This does not add support-session persistence.
- This does not replace broad route mounts with a generated route registry.
- Live admin/support env allowlists are not verifiable from repository files alone.

## Future governance roadmap

Recommended next hardening steps:

1. Add a generated route ownership registry for `/api/admin/*` route families.
2. Add support-session audit logging with explicit scope, reason, started/ended timestamps, and actor context.
3. Add impersonation governance and audit tests before expanding any delegation tooling.
4. Add admin/support projection safety tests for every new privileged read surface.
5. Continue narrowing broad `/api` mounts to reduce route fallthrough risk.

## Explicit confirmations

- No permissions were widened.
- No admin/support visibility was broadened.
- No impersonation powers were added.
- No auth provider, JWT, Firestore rule, or schema behavior changed.
- No tenant-visible privileged internals were introduced.
- No autonomous escalation behavior was introduced.
- No financial records were mutated.
