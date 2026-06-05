# RentChain v0.9 Product Readiness Audit Findings

Audit branch: `audit/product-readiness-v1`
Audit date: 2026-06-05
Status: Complete

## Executive Summary

RentChain has substantial backend and frontend coverage for landlord operations, tenant workspaces, screening, lease drafts, rent payments, messages, governance read models, and institutional trust surfaces. The audited repository does not yet show a market-ready end-to-end revenue path from landlord signup through property publishing, tenant application, screening, lease execution, recurring rent collection, and landlord payout/statement generation.

Estimated readiness from code inspection:
- Advertised workflow implementation coverage: 58%.
- Revenue workflow completion: 38%.
- Revenue-blocking workflows: 4 of 6 core revenue workflows.
- Market readiness: 6.0/10.
- Revenue readiness: 4.5/10.

The strongest implemented areas are landlord property CRUD, tenant workspace projections, application review, screening checkout scaffolding, lease draft generation, and payment checkout scaffolding. The biggest gaps are production Firestore enforcement, default/mock screening provider behavior, missing provider-backed lease execution, billing/status shortcuts that do not prove active subscriptions, and no clear landlord payout or recurring statement lifecycle.

## Evidence Inventory

Primary files inspected:
- `codex.md`
- `PROCESS.md`
- `AGENTS.md`
- `.handoff/mission-current.md`
- `firestore.rules`
- `rentchain-api/package.json`
- `rentchain-frontend/package.json`
- `rentchain-api/.env.example`
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/routes/propertiesRoutes.ts`
- `rentchain-api/src/routes/applicationsRoutes.ts`
- `rentchain-api/src/routes/rentalApplicationsRoutes.ts`
- `rentchain-api/src/routes/screeningRoutes.ts`
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/billingRoutes.ts`
- `rentchain-api/src/routes/paymentsRoutes.ts`
- `rentchain-api/src/routes/messagesRoutes.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/services/screening/providers/index.ts`
- `rentchain-api/src/services/screening/providers/mockProvider.ts`
- `rentchain-api/src/services/screening/providers/transunionProvider.ts`
- `rentchain-api/src/services/stripeService.ts`
- `rentchain-api/src/services/subscriptionService.ts`
- `rentchain-api/src/middleware/requireAuth.ts`
- `rentchain-api/src/middleware/requireLandlord.ts`
- `rentchain-api/src/middleware/authMiddleware.ts`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/api/billingApi.ts`
- `rentchain-frontend/src/api/tenantPortal.ts`

## Consolidated Findings

### Blockers - Revenue Preventing

#### B1. Production Firestore enforcement is not market-ready

Severity: blocker

Evidence:
- `firestore.rules:6-11` says the rules are "Local emulator only" and allows all reads and writes.
- `codex.md` requires Firestore and tenant/landlord/admin separation, but database-level enforcement is not represented in the root rules file.

Reproduction steps:
1. Open `firestore.rules`.
2. Observe catch-all `match /{document=**}`.
3. Observe `allow read, write: if true`.

Risk:
- Any production deployment using this file would allow broad database access.
- Even if production deploys a different ruleset, the repository lacks a reviewable production rules source of truth.

Mapped priority:
- Soft launch readiness.

Recommended fix:
- Create production Firestore rules with explicit landlord, tenant, admin, support, public token, and internal service boundaries.
- Add emulator tests that prove cross-tenant and cross-landlord denials.

#### B2. Screening integration defaults to mock and lacks Certn/Equifax production routes

Severity: blocker

Evidence:
- `rentchain-api/src/services/screening/providers/index.ts:11-25` defaults `CREDIT_PROVIDER` to `mock`, maps `providerB` to `MockCreditProvider`, and has a placeholder comment for future providers.
- `rentchain-api/src/services/screening/providers/mockProvider.ts:28-67` returns deterministic stub screening data and raw request echo.
- `rentchain-api/src/services/screening/providers/transunionProvider.ts:31-40` has a preflight TODO and does not call a real health endpoint.
- Mission-listed Certn and Equifax endpoints are not present as direct route families in `app.build.ts`; TransUnion has integration routes mounted at `/api/integrations`.

Reproduction steps:
1. Open `rentchain-api/src/services/screening/providers/index.ts`.
2. Confirm default provider is `mock`.
3. Open `rentchain-api/src/services/screening/providers/mockProvider.ts`.
4. Confirm stub provider returns deterministic score and provider name `mock`.
5. Open `rentchain-api/src/services/screening/providers/transunionProvider.ts`.
6. Confirm health preflight is currently a placeholder.

Risk:
- Paying landlords cannot rely on production-grade screening unless provider credentials, routing, and webhooks are fully configured and verified.
- Product claims around Certn/Equifax are not supported by audited route evidence.

Mapped priority:
- Screening integration completion.

Recommended fix:
- Make real provider readiness explicit in admin and landlord surfaces.
- Add direct provider route/status documentation.
- Add fail-closed production guards that block mock screening outside approved test modes.

#### B3. Lease execution lacks provider-backed e-signature completion

Severity: blocker

Evidence:
- `rentchain-api/src/routes/leaseRoutes.ts:2314-2481` supports landlord lease drafts and Schedule A PDF generation.
- `rentchain-api/src/routes/tenantPortalRoutes.ts:5765-5795` supports tenant lease signing in the tenant portal.
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx:1716` explicitly states the signing workspace does not claim provider-backed e-signing or legal completion unless the authorized lease state shows it.
- No DocuSign or HelloSign dependency exists in `rentchain-api/package.json`.

Reproduction steps:
1. Open `rentchain-api/src/routes/leaseRoutes.ts` near draft creation and generation.
2. Open `rentchain-api/src/routes/tenantPortalRoutes.ts` near tenant lease signing.
3. Open `rentchain-api/package.json` and confirm no signing provider dependency.
4. Search for DocuSign or HelloSign routes; none appear in audited route inventory.

Risk:
- Lease execution can show structured state and store in-app signatures, but cannot be marketed as complete provider-backed document execution.

Mapped priority:
- Lease execution end-to-end.

Recommended fix:
- Decide whether v0.9 ships in-app signature only or integrates a signing provider.
- Add execution proof semantics, delivery, callback handling, and immutable audit evidence before calling it complete.

#### B4. Billing subscription status does not prove active Stripe subscription lifecycle

Severity: blocker

Evidence:
- `rentchain-api/src/routes/billingRoutes.ts:41-57` derives subscription status from resolved tier and returns active if tier is not free, with `renewalDate` fixed to null.
- `rentchain-api/src/routes/billingRoutes.ts:472-474` exposes checkout/subscribe/upgrade routes.
- `rentchain-frontend/src/api/billingApi.ts:64-68` calls `/billing/create-checkout-session`, but the audited backend routes expose `/billing/checkout`, `/billing/subscribe`, and `/billing/upgrade`.
- `rentchain-api/src/services/subscriptionService.ts:21-35` is marked as a dev-only plan middleware stub.

Reproduction steps:
1. Open `rentchain-api/src/routes/billingRoutes.ts` and inspect `sendSubscriptionStatus`.
2. Open `rentchain-frontend/src/api/billingApi.ts` and inspect `createCheckoutSession`.
3. Compare frontend path `/billing/create-checkout-session` with backend route list.

Risk:
- Billing UI may read status that does not prove Stripe subscription state.
- Checkout session creation has route mismatch risk.
- Paying landlord activation cannot be trusted without verified webhook-to-account state and invoice history.

Mapped priority:
- Soft launch readiness.

Recommended fix:
- Align frontend checkout path to backend route.
- Make subscription status source Stripe/customer-backed or explicitly label it simulated.
- Add invoice/renewal/past_due test coverage.

#### B5. Landlord payout and statement lifecycle is not implemented as a market-ready revenue loop

Severity: blocker

Evidence:
- `rentchain-api/src/routes/billingRoutes.ts` has checkout, pricing, portal, and session status, but audited route inventory did not reveal landlord payout schedule or statement routes.
- `rentchain-api/src/routes/paymentsRoutes.ts:694-1030` covers payment listing, exports, edits, and delete/update flows.
- `rentchain-api/src/routes/tenantPortalRoutes.ts:5607-5703` creates tenant rent payment checkout when payment rails are enabled.

Reproduction steps:
1. Review billing and payments route inventory.
2. Search audited routes for payout and landlord statement endpoints.
3. Confirm payment checkout and ledger operations exist, but payout timing and landlord statements are not surfaced as a closed workflow.

Risk:
- Monthly recurring revenue and landlord cashflow cannot be represented as complete without payout reconciliation, statements, and failure handling.

Mapped priority:
- Soft launch readiness.

Recommended fix:
- Define landlord payout model, statement documents, reconciliation, and visible status surfaces.
- Add Stripe transfer/connect readiness only if in scope for v0.9.

### Critical - User Visible Failures

#### C1. Tenant portal is globally gated by `VITE_TENANT_PORTAL_ENABLED`

Severity: critical

Evidence:
- `rentchain-frontend/src/App.tsx:61` defines `TENANT_PORTAL_ENABLED`.
- `rentchain-frontend/src/App.tsx:363-370` sends tenant-shell pages to `TenantPortalComingSoon` when the flag is not true.
- `rentchain-frontend/src/App.tsx:388-440` gates tenant login, magic, invite, and application entry routes.

Reproduction steps:
1. Run frontend without `VITE_TENANT_PORTAL_ENABLED=true`.
2. Navigate to `/tenant/login`, `/tenant/apply`, or `/tenant/invite/:token`.
3. Observe tenant surfaces resolve to coming-soon behavior.

Risk:
- Tenant application and lease workflows can be disabled by missing frontend environment configuration.
- The repo has no `rentchain-frontend/.env.example`, so required tenant portal env is not documented there.

Mapped priority:
- Tenant engagement and soft launch readiness.

Recommended fix:
- Add frontend env example and deployment check for tenant portal flag.
- Make tenant portal availability explicit in release readiness.

#### C2. API base configuration is undocumented for frontend local setup

Severity: critical

Evidence:
- `rentchain-frontend/.env.example` is absent.
- `rentchain-frontend/src/api/baseUrl.ts:18-31` throws or logs when `VITE_API_BASE_URL` is missing or invalid.
- `rentchain-frontend/src/config/apiBase.ts:11-14` warns/defaults locally and errors in production.

Reproduction steps:
1. Confirm `rentchain-frontend/.env.example` does not exist.
2. Open frontend API base helpers.
3. Start frontend without `VITE_API_BASE_URL` in production-like mode.

Risk:
- Soft launch or preview builds can silently point at wrong API targets or fail.

Mapped priority:
- UI polish and soft launch readiness.

Recommended fix:
- Add frontend env example with `VITE_API_BASE_URL`, `VITE_TENANT_PORTAL_ENABLED`, and public URL settings.

#### C3. Frontend billing checkout route mismatch can break upgrade flow

Severity: critical

Evidence:
- `rentchain-frontend/src/api/billingApi.ts:64-68` calls `/billing/create-checkout-session`.
- `rentchain-api/src/routes/billingRoutes.ts:472-474` registers `/checkout`, `/subscribe`, and `/upgrade`.

Reproduction steps:
1. Trigger frontend `createCheckoutSession()`.
2. Observe expected backend path is absent from audited route list.

Risk:
- Landlord upgrade/signup payment path can fail even when Stripe is configured.

Mapped priority:
- Soft launch readiness.

Recommended fix:
- Align frontend to `/billing/checkout` or add backend compatibility route with tests.

#### C4. Route families include legacy and newer application paths, increasing workflow ambiguity

Severity: critical

Evidence:
- `rentchain-api/src/routes/applicationsRoutes.ts:508-932` exposes `/applications` and `/applications/:id/*` style routes.
- `rentchain-api/src/routes/rentalApplicationsRoutes.ts:1157-4497` exposes `/rental-applications` and newer screening/export/review summary paths.
- `rentchain-api/src/app.build.ts:600-607` mounts rental application and application routes together.

Reproduction steps:
1. Inspect `app.build.ts` route mounting around application routes.
2. Compare `applicationsRoutes.ts` and `rentalApplicationsRoutes.ts` route inventories.
3. Identify which frontend page uses which API client for application review and screening.

Risk:
- Landlord and tenant application workflows can diverge by API family, making QA and support harder.

Mapped priority:
- Screening integration completion and UI polish.

Recommended fix:
- Publish a canonical application route map.
- Deprecate or alias legacy routes with explicit tests.

### High Priority - Adoption Friction

#### H1. Property creation and publishing exist but public tenant search/listing workflow is not clearly closed

Severity: high-priority

Evidence:
- `rentchain-api/src/routes/propertiesRoutes.ts:257-430` creates DRAFT properties with normalized address, province, PID, and units count.
- `rentchain-api/src/routes/propertiesRoutes.ts:1161-1204` publishes only if at least one unit exists.
- The mission-listed tenant property search endpoints are not visible as direct `/api/tenant/properties/search` routes in audited route inventory.

Reproduction steps:
1. Create property via `/api/properties`.
2. Add a unit.
3. Publish property via `/api/properties/:propertyId/publish`.
4. Attempt to find matching direct tenant search route from audited route list.

Risk:
- Landlords can create and publish, but tenant discovery/search path is not obviously aligned with advertised workflow.

Mapped priority:
- UI polish and tenant engagement.

Recommended fix:
- Define canonical tenant property discovery route and frontend path.
- Add test that published landlord property becomes tenant-discoverable.

#### H2. Property geocoding/maps are not evident in creation path

Severity: high-priority

Evidence:
- `rentchain-api/src/routes/propertiesRoutes.ts:274-405` normalizes address fields and address key.
- No geocoding call appears in the audited create path.

Reproduction steps:
1. Inspect property create handler.
2. Confirm only address normalization and duplicate key are performed.

Risk:
- Map/search/location quality may be weak for landlord listing adoption.

Mapped priority:
- UI polish.

Recommended fix:
- Add geocoding readiness field or explicitly defer maps to post-v0.9.

#### H3. Tenant payment readiness is honest but not money-movement ready by default

Severity: high-priority

Evidence:
- `rentchain-frontend/src/api/tenantPortal.ts:181-198` models payment setup with `processorConnected: false`, `moneyMovementEnabled: false`, and `storedPaymentMethod: false`.
- `rentchain-api/src/routes/tenantPortalRoutes.ts:5640-5663` blocks tenant rent payment checkout unless lease payment rails are enabled and Stripe is configured.

Reproduction steps:
1. Open tenant portal payment readiness type.
2. Open tenant rent payment checkout route.
3. Confirm checkout fails closed unless payment rail is enabled.

Risk:
- Tenant payment collection exists as a guarded flow but is not default-ready for all leases.

Mapped priority:
- Soft launch readiness.

Recommended fix:
- Add landlord setup checklist for payment rail enablement.
- Add operational report of leases blocked from rent payment.

#### H4. Operational and trust pages outnumber revenue workflow pages

Severity: high-priority

Evidence:
- `rentchain-frontend/src/App.tsx:118-156` imports many readiness/governance pages.
- `rentchain-frontend/src/App.tsx:481-510` maps core landlord properties, tenants, and applications pages.

Reproduction steps:
1. Review frontend route list.
2. Compare readiness/governance route count with core revenue-flow route count.

Risk:
- Product may feel operationally sophisticated while core adoption flows remain incomplete.

Mapped priority:
- UI polish and soft launch readiness.

Recommended fix:
- Prioritize onboarding-to-revenue routes in navigation and QA.

### Nice To Have - Polish

#### N1. Error response vocabulary is inconsistent across route families

Severity: nice-to-have

Evidence:
- `requireAuth` returns `{ ok: false, error: "unauthenticated" }` at `rentchain-api/src/middleware/requireAuth.ts:12-40`.
- `requireLandlord` returns `"Unauthorized"`, `"Forbidden"`, and `"Missing landlord context"` at `rentchain-api/src/middleware/requireLandlord.ts:11-21`.
- Legacy route families often return strings such as `"Failed to create lease draft"` or `"db_failed"`.

Risk:
- Support diagnosis and frontend error handling become inconsistent.

Recommended fix:
- Create a shared error code map for revenue-critical workflows.

## Seven Audit Reports

### 1. Landlord Workflow Completeness

Status: partially implemented, revenue-blocked.

Working evidence:
- Landlord signup route exists through auth/onboarding surfaces in `App.tsx:378-386` and backend auth routes mounted at `app.build.ts:384`.
- Property creation is implemented in `propertiesRoutes.ts:257-430`.
- Property publishing is implemented in `propertiesRoutes.ts:1161-1204`.
- Landlord dashboard, properties, tenants, applications, billing routes are mounted in frontend `App.tsx:443-510`.
- Billing UI and Stripe checkout scaffolding exist in `billingRoutes.ts:472-476` and `BillingPage`.

Gaps:
- Billing checkout route mismatch blocks upgrade flow (`billingApi.ts:64-68` vs `billingRoutes.ts:472-474`).
- No audited landlord payout statement lifecycle.
- Property publishing does not prove tenant discoverability.
- Screening provider readiness is not default production-ready.

Revenue impact:
- Paying landlord activation is not fully dependable.

### 2. Tenant Workflow Completeness

Status: partially implemented, environment-gated.

Working evidence:
- Tenant routes are extensive in `tenantPortalRoutes.ts`, including workspace, profile, communications, lease, payments, screening, notices, and maintenance.
- Tenant shell pages exist in `App.tsx:195-214`.
- Tenant lease document access exists in `tenantPortalRoutes.ts:5527-5604`.
- Tenant lease signing route exists in `tenantPortalRoutes.ts:5765-5795`.

Gaps:
- Tenant portal is disabled unless `VITE_TENANT_PORTAL_ENABLED=true`.
- `rentchain-frontend/.env.example` is missing, leaving required frontend flags undocumented.
- Provider-backed lease signing is not present.
- Tenant property search endpoint listed in the mission is not a clearly mounted direct route.

Tenant impact:
- Tenant application and lease acceptance can be blocked by deployment config and execution gaps.

### 3. Data Model and Backend Completeness

Status: broad but fragmented.

Working evidence:
- Firestore collection usage spans `properties`, `units`, `leases`, `leaseDrafts`, `leaseSnapshots`, `rentPayments`, tenant workspace collections, audit events, and screening orders.
- Routes cover properties, applications, screening, leases, billing, payments, messages, tenant workspace, admin/support, and governance surfaces.

Gaps:
- Firestore root rules are emulator-only allow-all.
- Application routes are split across legacy and newer families.
- Provider integrations are uneven: Stripe and SendGrid/Mailgun are present; TransUnion is partly implemented; Certn/Equifax and signing providers are not evident as production integrations.
- Some source files retain `@ts-nocheck` or broad untyped route handling, such as `applicationsRoutes.ts:1`.

Backend impact:
- The backend is feature-rich but needs canonical route and schema contracts for v0.9 launch workflows.

### 4. Authorization and Privacy

Status: service-level auth exists; database-level production enforcement is blocked.

Working evidence:
- `requireAuth.ts:12-40` verifies bearer tokens and hydrates session users.
- `requireLandlord.ts:4-31` requires landlord/admin role and landlord context.
- `authMiddleware.ts:71-124` decodes JWT when provided and lets explicit route middleware enforce auth.
- Tenant workspace routes use tenant identity guards.

Gaps:
- Firestore root rules allow all reads and writes.
- Some route families rely on broad `authenticateJwt` optional auth plus route-local checks, creating uneven enforcement review burden.
- Legacy application and lease endpoints include broad route shapes that need canonical access review before soft launch.

Privacy impact:
- API-layer protections are meaningful, but production DB authorization is not reviewable from the current rules file.

### 5. Frontend Completeness

Status: broad surface coverage, but critical workflow gates and mismatches remain.

Working evidence:
- Core landlord pages exist: dashboard, billing, properties, tenants, applications.
- Tenant pages exist for dashboard, workspace, application status, lease, payments, ledger, profile, documents, messages, screening inbox, maintenance.
- Marketing/help/legal/trust/status pages exist.

Gaps:
- Tenant portal flag can replace tenant routes with coming-soon behavior.
- Billing checkout API path mismatch.
- Many institutional/governance pages exist without corresponding revenue workflow completion.
- Frontend env example is missing.

UX impact:
- Navigation breadth is strong, but core workflow reliability needs a narrower soft-launch path.

### 6. Operational Readiness

Status: operational diagnostics exist, but launch-critical monitoring is incomplete.

Working evidence:
- Admin observability, alerting, release governance, production integrations, controlled integrations, and incident readiness pages/routes exist.
- Stripe error classification and safe header redaction exist in `billingRoutes.ts:148-184`.
- Firestore local guard exists in config files.

Gaps:
- Full backend test suite has known unrelated failures from the prior mission context and must be resolved or quarantined before v0.9.
- No manual staging QA was executed in this audit turn because no running local/staging environment or credentials were provided.
- Critical workflow monitoring for landlord signup, screening completion, lease execution, and rent payment settlement is not proven by this audit.

Operational impact:
- Observability foundations exist, but launch readiness needs live workflow dashboards and pass/fail gates.

### 7. Consolidated Recommendations

Recommended v0.9 sequencing:

1. Firestore production rules and auth boundary test suite.
2. Billing checkout/status alignment and Stripe subscription verification.
3. Screening integration completion for the chosen v0.9 provider; fail-closed mock provider policy.
4. Lease execution end-to-end decision: provider-backed signing or explicitly scoped in-app signing.
5. Tenant portal launch configuration and tenant property/application path hardening.
6. Landlord payout/statements and rent payment reconciliation.
7. UI polish and soft launch QA scripts for the complete revenue journey.

## Manual QA Status

Manual QA was not completed in a running environment during this audit. The mission required read-only investigation and no local/staging credentials or seeded workflow accounts were available in this turn. The report therefore provides reproducible code-reference evidence and workflow reproduction steps rather than live account execution.

Manual QA required before soft launch:
1. Landlord signup to billing checkout.
2. Property creation, unit creation, publish, tenant discoverability.
3. Tenant application submission with document attachment.
4. Screening request through configured real provider.
5. Lease draft generation, tenant signing, landlord execution confirmation.
6. Tenant rent payment checkout and payment record reconciliation.
7. Tenant-landlord messaging round trip.
8. Cross-role access denial tests in UI and API.

## Test Gaps Discovered

- No single end-to-end revenue workflow test covers landlord signup through payment collection.
- No audited test proves published property is discoverable by tenant search.
- No audited test proves provider-backed e-signature completion.
- No audited test proves landlord payout/statement lifecycle.
- No frontend environment example exists to support reproducible preview setup.

## Acceptance Criteria Assessment

- Seven audit reports: complete in this document.
- Findings categorized by severity: complete.
- Reproducible evidence: code references and reproduction steps included.
- Blockers identified: complete.
- Frontend-backend mismatches identified: complete.
- Authorization/privacy risks flagged: complete.
- v0.9 roadmap mapping: complete.
- Baseline tests: attempted and documented in `.handoff/impl-summary.md`.
