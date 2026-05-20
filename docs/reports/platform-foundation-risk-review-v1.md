# Platform Foundation Risk Review v1

## Purpose

This audit reviews RentChain's platform foundation before adding deeper governance infrastructure such as review workspaces, escalation systems, institutional exports, consent governance, and controlled operational agent routing.

This is an architecture and technical debt review only. It does not change product behavior, Firestore schema, routes, auth, payment logic, screening logic, deployment infrastructure, or UI workflows.

## Audit Scope

Reviewed areas:

- Frontend/backend responsibility boundaries.
- Cloud Run and Vercel deployment separation.
- Express route ownership and mount order.
- Firestore collection relationships and query patterns.
- Landlord, tenant, and admin authorization patterns.
- Lease, payment, occupancy, decision, screening, evidence, and operations workflow state.
- Audit/event infrastructure.
- CI, Vercel, Terraform, and deployment safety posture.
- Test coverage and regression protection.
- Scaling, cost, privacy, and institutional-readiness risks.

Representative files inspected:

- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/index.build.ts`
- `rentchain-api/src/middleware/requireAuth.ts`
- `rentchain-api/src/middleware/authMiddleware.ts`
- `rentchain-api/src/middleware/requireAuthz.ts`
- `rentchain-api/src/middleware/requireLandlord.ts`
- `rentchain-api/src/services/sessionUserService.ts`
- `rentchain-api/src/config/requiredEnv.ts`
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/landlordEvidencePackRoutes.ts`
- `rentchain-api/src/routes/adminNotificationRoutes.ts`
- `rentchain-api/src/routes/screeningReconciliationRoutes.ts`
- `rentchain-api/firestore.rules`
- `.github/workflows/ci.yml`
- `.github/workflows/merge-gate.yml`
- `.github/workflows/codex-pr-review.yml`
- `rentchain-frontend/vercel.json`
- `cloudrun.tf`
- `rentchain-api/package.json`
- `rentchain-frontend/package.json`
- Existing lifecycle continuity docs and fixture/test suites.

## Strong Foundation Areas

1. **Backend and frontend deployment separation is clear.**
   The frontend is Vercel-hosted and rewrites `/api/*` to Cloud Run. The API is built from `rentchain-api/src/index.build.ts` and Express routing is centralized in `rentchain-api/src/app.build.ts`. This separation is workable and has supported recent PR/preview QA cycles.

2. **Firestore direct client access is currently denied.**
   `rentchain-api/firestore.rules` denies all client reads and writes. This forces product access through the API layer, which is the correct posture for tenant-facing projections, landlord scoping, institutional exports, and audit-safe governance.

3. **Recent canonicalization work materially strengthened workflow truth.**
   The current codebase now has foundations for canonical payments, immutable ledger entries, obligation reconciliation, due-date normalization, occupancy normalization, tenant document linkage, jurisdiction workflow metadata, jurisdiction policy evaluation, decision workflow separation, and operational command center routing.

4. **Testing foundations are improving in the right direction.**
   The repo now includes deterministic lifecycle continuity fixtures and focused regression suites for payment/ledger/obligations, tenant workspace lease linkage, property occupancy, and decision workflow behavior. This is a strong base for cross-system reliability.

5. **Hard production env checks exist.**
   `assertRequiredEnv()` enforces hard environment requirements in production and warns outside production. This reduces accidental deployment with missing JWT, Stripe, Firebase, email, and pricing configuration.

6. **Permission primitives exist.**
   `requireAuth`, `requirePermission`, `requireLandlord`, role normalization, RBAC permissions, and hydrated session users exist. The foundation is not absent; the risk is consistency and route coverage.

7. **Evidence, audit, and governance concepts are already modeled.**
   Evidence packs, canonical events, audit compliance readiness, operator review sessions, institutional export package derivation, and redaction-oriented governance helpers exist. This is structurally useful for the next governance layer.

8. **Public route debugging has improved.**
   `x-route-source` headers and revision probe endpoints have repeatedly helped identify deployment and route ownership problems during QA. This is useful operational instrumentation.

9. **Screening is moving away from provider lock-in.**
   Provider-agnostic screening workflow UI and safe TransUnion/Manual/Certn/Equifax framing reduce one-provider workflow debt.

10. **Operational UI normalization has reduced raw ID leakage.**
    Recent operational reference work has improved visible labels across payments, tenant profiles, leases, evidence packs, and command center surfaces.

## Critical Risks

### C1. Route ownership and mount order are becoming fragile

`rentchain-api/src/app.build.ts` is the single production route assembly point and currently mixes:

- public routes,
- auth routes,
- internal routes,
- landlord routes,
- admin routes,
- broad `/api` routers,
- debug/probe endpoints,
- duplicated route mounts,
- compatibility routes,
- payment special-case mounts,
- catchall and route-source diagnostics.

This creates avoidable route fallthrough risk. Recent QA already surfaced cases where requests fell through to unexpected route sources. The file is still operationally manageable, but it is too large and too broad for institutional-grade route governance.

**Risk:** new routes can be mounted after broad routers, shadowed by catchalls, or unintentionally exposed through a broad `/api` mount.

**Must fix soon:** create a route registry or route ownership map, then add route-level tests for critical endpoint ownership.

### C2. Authorization context is not centralized enough for future governance

The codebase has good primitives, but many routes still manually derive landlord scope using patterns such as:

- `req.user?.landlordId || req.user?.id`
- `req.user?.actorLandlordId || req.user?.landlordId || req.user?.id`
- local `normalizeRole()` functions

This pattern is common across route families. It is currently workable, but it makes landlord, tenant, admin, impersonation, and support contexts harder to reason about as review workspaces and institutional access grow.

**Risk:** inconsistent server-side authority resolution, especially for admin/support paths, tenant workspace projections, evidence packs, exports, and cross-organization workflows.

**Must fix soon:** introduce a shared request authority/context resolver and migrate sensitive route families gradually.

### C3. Admin and governance routes rely on full-collection scans

Several admin/governance/readiness surfaces load entire collections, including examples in:

- `adminNotificationRoutes.ts`
- `screeningReconciliationRoutes.ts`
- `landlordEvidencePackRoutes.ts`
- `adminCommercialReadinessRoutes.ts`
- admin overview/triage/alerting/readiness services

Some of these are admin-only, which reduces tenant leakage risk, but not scaling cost.

**Risk:** institutional volume will produce high Firestore read cost, slow endpoints, timeouts, and brittle operational dashboards.

**Must fix before institutional exports and large review queues:** add indexed read models, pagination, and query budgets for admin/governance surfaces.

### C4. Event and audit infrastructure is fragmented

The codebase has multiple event/audit concepts:

- `canonicalEvents`
- `events`
- `tenantEvents`
- ledger events
- decision action history
- operator review sessions
- audit compliance readiness
- admin audit views
- telemetry events

This is a strength in coverage but a risk in consistency. There is no obvious single event taxonomy with required actor, subject, scope, visibility, source, sensitivity, and retention fields.

**Risk:** evidence packs, consent governance, review workspaces, and institutional exports may derive from inconsistent histories.

**Must fix soon:** define a canonical event/audit taxonomy and migration-safe adapter rules for existing event sources.

### C5. Consent and sensitive-data governance is not yet a platform-wide contract

There are strong localized patterns, especially around screening usage summaries, redactions, tenant-safe projections, and CSV sensitive-column omission. However, there is no obvious platform-wide sensitivity registry or export projection registry that every evidence/export/tenant-facing route must use.

**Risk:** future institutional exports and evidence packs could accidentally include fields that were safe in one context but not another.

**Must fix before expanding institutional exports:** define field sensitivity classes, projection rules, and export package allowlists.

### C6. Dev/demo/debug surfaces need a production exposure inventory

The production build includes several probes and debug-style endpoints such as route probes, build probes, and debug build pings. The codebase also contains demo/mock/dev concepts across frontend and backend.

Examples found during audit:

- `/api/__probe/*`
- `/api/__debug/*`
- `adminDemoRoutes`
- `devDiagnosticsRoutes` and related dev route files in the repo
- frontend demo/mock automation timeline fallbacks
- file hygiene issue: `rentchain-api/src/health/firebase RENAME.ts`

Some are intentionally useful for QA, but institutional readiness requires knowing exactly which are public, auth-gated, or production-safe.

**Risk:** accidental information exposure, support confusion, and inability to certify production boundaries.

**Must fix soon:** create a production route exposure inventory and gate/remove nonessential debug surfaces.

## Medium Risks

### M1. Frontend still carries significant derived workflow presentation logic

Recent normalization reduced drift, but major pages still perform substantial transformation and rendering work. Operational Command Center, lease ledger, dashboard, tenant workspace, and property pages are all high-coupling surfaces.

**Risk:** status drift returns when new workflows are added.

**Repair direction:** continue moving workflow derivation to pure shared helpers and keep frontend components as display adapters.

### M2. `ci` does not run backend tests

`.github/workflows/ci.yml` builds the backend but does not run the backend Vitest suite. Frontend tests run in CI. Backend route/helper tests exist and are useful, but they are not part of the main required CI workflow.

**Risk:** backend regressions in payment, auth, route ownership, tenant isolation, or evidence derivation can pass CI if TypeScript still builds.

**Repair direction:** add a targeted backend smoke/regression suite to CI before broadening to full backend tests.

### M3. Firestore collection ownership is implicit

Collections such as `leases`, `tenants`, `properties`, `units`, `payments`, `ledgerEntries`, `rentPayments`, `canonicalEvents`, `tenantEvents`, `screeningOrders`, `financialTransactions`, `operatorReviewSessions`, and governance/admin collections are connected by convention.

**Risk:** future migrations and institutional exports will depend on tribal knowledge.

**Repair direction:** create a collection ownership and relationship registry that documents owner service, primary scope fields, sensitivity, canonical IDs, external IDs, and allowed projections.

### M4. Route-source diagnostics are helpful but not systematic

Some route families set `x-route-source`; others do not. This has helped debug QA failures, but inconsistent coverage makes route ownership harder to validate.

**Repair direction:** add route-source coverage expectations for critical route families or replace with generated route ownership tests.

### M5. Portfolio/admin aggregation has read amplification

Dashboard routes use limits and landlord scoping, but admin, evidence, and reconciliation paths often aggregate across many collections in one request. This is acceptable for current scale but not for institutional volumes.

**Repair direction:** create read-model snapshots for admin triage, evidence packs, and operational command center sources.

### M6. Multiple auth middlewares can confuse enforcement expectations

`authenticateJwt` is a non-blocking decoder while `requireAuth` is enforcing and hydrates canonical session users. Both coexist in `app.build.ts`.

**Risk:** a route can appear protected because auth decoding exists globally but still require explicit route-level enforcement.

**Repair direction:** document route categories and require route tests for public, optional-auth, landlord, tenant, admin, and internal paths.

### M7. Bundle size and frontend density are trending upward

Frontend build dependencies and page count have grown. Previous builds have surfaced chunk-size pressure. This is not an immediate correctness issue, but it affects perceived quality and institutional UX.

**Repair direction:** route-level code splitting, page decomposition, and lightweight layout regression checks.

### M8. Logging redaction is uneven

There are good examples of redaction and safe summaries, but `console.error` and `console.warn` are widely used. Some logs include request paths, stack traces, user objects, or IDs. Most are useful for debugging, but governance requires a standard.

**Repair direction:** define structured logging redaction rules and a safe logger wrapper for production routes.

## Low-Risk Cleanup Items

1. Remove or rename stale files such as `rentchain-api/src/health/firebase RENAME.ts`.
2. Inventory and label demo/mock frontend fallbacks so they cannot appear as production truth.
3. Consolidate similarly named audit services where practical, such as `auditEventService.ts` and `auditEventsService.ts`, after documenting distinct roles.
4. Convert high-value route mount comments in `app.build.ts` into a generated route registry or markdown route map.
5. Add documentation pointers from `docs/testing/lifecycle-continuity-readiness-v1.md` to the new fixture and regression suites.
6. Track raw ID leakage as a standing UI governance lint/test area.
7. Standardize status label helpers across work orders, operations, screening, and lease workflows.
8. Reduce route bootstrap console noise where it does not support production diagnostics.

## Technical Debt Inventory

### Critical

| Finding | Why it matters | Repair direction |
| --- | --- | --- |
| Broad route mounting and route ownership sprawl | New endpoints can be shadowed, fall through, or become hard to govern | Route registry, ownership tests, route-source consistency |
| Decentralized authority context derivation | Future review, support, tenant, admin, and institution contexts need deterministic scope | Shared server-side authority resolver |
| Full-collection admin/governance reads | Institutional portfolios will hit Firestore cost and latency limits | Indexed read models, pagination, query budgets |
| Fragmented event/audit taxonomy | Evidence, consent, exports, and review trails need reliable lineage | Canonical event taxonomy and adapters |
| No platform-wide sensitivity/projection registry | Export and evidence expansion could expose fields inconsistently | Field sensitivity registry and allowlisted projections |

### Medium

| Finding | Why it matters | Repair direction |
| --- | --- | --- |
| Backend tests not required by main CI | Backend regressions can pass if the API builds | Add targeted backend regression job |
| Frontend-heavy workflow transforms | State drift can return in complex pages | Shared pure derivation helpers and thinner UI adapters |
| Implicit Firestore relationship map | Migrations and exports depend on tacit knowledge | Collection ownership registry |
| Uneven route-source diagnostics | QA route validation remains manual | Route-level test coverage and registry |
| Logging/redaction inconsistency | Sensitive context can leak to logs over time | Production-safe logger/redaction policy |

### Low

| Finding | Why it matters | Repair direction |
| --- | --- | --- |
| Stale/dev file names and demo remnants | Reduces confidence and increases support noise | Hygiene cleanup branch |
| Duplicate or overlapping docs/runbooks | Harder onboarding for contributors | Docs index and owner metadata |
| Large page/component files | Harder maintenance and visual regression risk | Incremental decomposition |

## Recommended Repair Order

1. **Route and exposure inventory**
   - Produce a generated or maintained map of public, optional-auth, landlord, tenant, admin, internal, webhook, and debug routes.
   - Add tests for critical route ownership and catchall behavior.

2. **Shared authority context resolver**
   - Centralize landlord, tenant, admin, actor, impersonation, and support context resolution.
   - Migrate sensitive route families first: tenant workspace, evidence packs, exports, admin triage, messages, payments, and screening.

3. **Collection ownership and relationship registry**
   - Document source-of-truth collection, owner service, required scope fields, canonical links, sensitivity class, and projection rules.

4. **Event/audit taxonomy v1**
   - Standardize actor, subject, scope, event type, visibility, source, sensitivity, retention, and correlation IDs.
   - Add adapter rules for existing event collections.

5. **Sensitive field and export projection registry**
   - Establish allowlisted projection profiles for tenant-facing UI, landlord operations, admin/support, evidence packs, and institutional exports.

6. **Backend regression CI**
   - Add a focused backend test job for route ownership, auth isolation, payment-ledger-obligation continuity, tenant workspace document linkage, and evidence/export projection safety.

7. **Operational read models**
   - Create indexed read models or cached snapshots for admin triage, notifications, evidence packs, screening reconciliation, and command center sources.

8. **Production diagnostics hardening**
   - Review debug/probe endpoints and route-source diagnostics for production exposure. Keep only those with clear operational value.

9. **Frontend workflow adapter cleanup**
   - Keep pages thin; move status/label/routing derivation into tested helpers.

10. **Scaling and bundle hygiene**
   - Track frontend bundle growth and split large operational pages after the higher-risk backend governance issues are addressed.

## Blocker Mapping

### Review workspaces

Blocked by:

- Route/authorization consistency.
- Event/audit taxonomy.
- Decision/workflow ownership model.
- Indexed operational read models.

Not blocked by:

- Current UI polish debt.
- Low-risk file naming cleanup.

### Evidence infrastructure

Blocked by:

- Event/audit taxonomy.
- Field sensitivity and projection registry.
- Evidence pack route ownership and scope tests.
- Raw/internal reference labeling policy.

Not blocked by:

- Frontend density improvements, as long as evidence payloads remain safe.

### Consent governance

Blocked by:

- Canonical consent event taxonomy.
- Tenant/applicant/screening consent linkage rules.
- Projection registry for screening and application data.
- Clear retention metadata.

Not blocked by:

- Provider option UI, which is already provider-agnostic enough for the next phase.

### Institutional exports

Blocked by:

- Collection ownership registry.
- Sensitivity classes and export allowlists.
- Audit lineage standard.
- Query scaling/read-model strategy.
- Production route exposure inventory.

Not blocked by:

- Minor dashboard layout debt.

## Scaling Risk Summary

Highest scaling risks:

1. Admin/governance endpoints that load entire collections.
2. Evidence packs that assemble multiple large collections per request.
3. Screening reconciliation that scans applications, canonical events, financial transactions, and orders.
4. Operational command center and dashboard surfaces if they continue aggregating directly from live collections.
5. PDF/export generation if large portfolios are exported synchronously.
6. Frontend page growth and bundle size as operational surfaces accumulate.

Recommended scaling posture:

- Add query budgets and pagination to every admin/governance route.
- Promote high-traffic operational summaries into indexed read models.
- Keep exports asynchronous for large portfolios.
- Track Firestore read counts per operational route in logs or telemetry.

## Governance Readiness Summary

RentChain is directionally strong but not yet institutional-ready.

Ready foundations:

- Canonical payment and ledger model.
- Tenant lifecycle and occupancy normalization.
- Operational status separation.
- Jurisdiction workflow metadata.
- Evidence and export concepts.
- Provider-agnostic screening workflow UI.
- Growing continuity test foundation.

Not ready yet:

- Platform-wide route ownership governance.
- Platform-wide authority context resolution.
- Event/audit taxonomy.
- Sensitivity/projection registry.
- Scaled read models for admin/institutional surfaces.
- Formal production debug/probe exposure policy.

Overall assessment:

RentChain can continue adding landlord-facing workflow improvements, but deeper review workspaces, institutional exports, consent governance, and controlled agent routing should wait until the critical repair items are sequenced.

## Recommended Next Architectural Priorities

1. `audit/api-route-ownership-and-exposure-inventory-v1`
2. `fix/server-authority-context-resolver-v1`
3. `docs/firestore-collection-ownership-registry-v1`
4. `feat/canonical-event-taxonomy-v1`
5. `feat/sensitive-field-projection-registry-v1`
6. `test/backend-critical-route-and-auth-regression-v1`
7. `feat/operational-read-model-foundation-v1`
8. `fix/production-debug-surface-hardening-v1`

## Safe To Defer

- Large frontend decomposition.
- Bundle-size optimization beyond monitoring.
- Cosmetic dashboard polish.
- Low-risk docs/runbook consolidation.
- Dead-code cleanup for non-mounted files after route exposure inventory.
- Deep provider integration work for screening.

## Must Fix Soon

- Route ownership inventory.
- Shared authority context resolver.
- Backend critical regression tests in CI.
- Collection ownership and sensitivity registry.
- Event/audit taxonomy.
- Admin/governance read-model strategy.
- Production debug/probe endpoint policy.

## DO NOT IGNORE

1. **Do not build review workspaces on decentralized authority checks.**
   Review workspaces will combine decisions, evidence, tenants, leases, payments, messages, and assignments. They need one server-side context resolver before they become operationally central.

2. **Do not expand institutional exports before field sensitivity and projection allowlists exist.**
   Export safety cannot rely on every route manually remembering what is sensitive.

3. **Do not add more broad `/api` routers without route ownership tests.**
   Prior QA already showed route fallthrough can happen. A route registry and tests are cheaper than debugging preview deployments repeatedly.

4. **Do not treat admin-only full-collection scans as institution-ready.**
   They may be acceptable for today, but they will become cost and latency problems at portfolio scale.

5. **Do not let audit events remain fragmented while building evidence infrastructure.**
   Evidence packs need consistent actor, subject, scope, visibility, source, and sensitivity semantics.

6. **Do not rely on frontend filtering for authority-sensitive separation.**
   All tenant, landlord, admin, support, institutional, and public-share access must continue to resolve server-side.

7. **Do not allow debug/probe routes to drift undocumented into production.**
   Keep only intentional production diagnostics, and document what each exposes.

## Verification

This PR is documentation-only. No product code, tests, infrastructure, routes, auth, payment, screening, or Firestore rules were changed.

Recommended verification:

- `git diff --check`
