# Lifecycle Continuity Testing Readiness v1

## Purpose

RentChain now has several stabilized operational layers that intentionally share state. Isolated tests still matter, but they do not prove that a landlord or tenant sees one coherent lifecycle across applicant, lease, occupancy, payment, ledger, obligation, decision, document, and export surfaces.

Lifecycle continuity testing should protect end-to-end workflow truth:

- The same lease should drive landlord operations, property occupancy, tenant profile, tenant workspace, ledger, and documents.
- Payment evidence should flow from canonical payment creation through immutable ledger entries into obligation reconciliation without mutating history.
- Operational review workflow actions should remain separate from financial truth.
- Tenant-facing projections should remain safe, whitelisted, and coherent with landlord-side canonical context.

This document is a readiness plan. It does not change product behavior, data shape, route behavior, or CI requirements in this PR.

## Current Stabilized Systems

- Canonical payments and immutable ledger entries.
- CSV payment import preview and confirmed import flow.
- Payment obligation reconciliation and due-date normalization.
- Jurisdiction-aware lease workflow registry and operational policy evaluator.
- Tenant lifecycle normalization and lease/occupancy coherence.
- Property occupancy display normalization.
- Lease ledger decision workflow state and review trail handling.
- Financial status vs workflow status separation.
- Tenant workspace lease/document linkage.
- Operational reference normalization for UI/export/support contexts.

## Audit Summary

### Backend Tests Reviewed

Relevant backend coverage is spread across pure helpers, services, and route tests:

- Lifecycle and occupancy helpers:
  - `rentchain-api/src/lib/tenants/__tests__/deriveTenantLifecycle.test.ts`
  - `rentchain-api/src/lib/leases/__tests__/deriveLeaseOccupancyCoherence.test.ts`
  - `rentchain-api/src/lib/leases/__tests__/leaseLifecycle.test.ts`
  - `rentchain-api/src/services/leaseLifecycle/__tests__/deriveLeaseLifecycleSummary.test.ts`
- Payments, ledger, imports, reconciliation, and obligations:
  - `rentchain-api/src/lib/payments/__tests__/paymentObligationLedger.test.ts`
  - `rentchain-api/src/lib/payments/__tests__/paymentReconciliation.test.ts`
  - `rentchain-api/src/routes/__tests__/paymentsRoutes.test.ts`
  - `rentchain-api/src/routes/__tests__/paymentsAdjustment.test.ts`
  - `rentchain-api/src/routes/__tests__/ledgerPaymentImportRoutes.test.ts`
  - `rentchain-api/src/services/__tests__/ledgerPaymentImportPreviewService.test.ts`
- Lease, document, and tenant workspace routes:
  - `rentchain-api/src/routes/__tests__/leaseRoutes.active.test.ts`
  - `rentchain-api/src/routes/__tests__/leaseRoutes.integrity.test.ts`
  - `rentchain-api/src/routes/__tests__/leaseDraftRoutes.test.ts`
  - `rentchain-api/src/routes/__tests__/tenantPortalRoutes.test.ts`
  - `rentchain-api/src/routes/__tests__/tenantProfileRoutes.test.ts`
- Decision workflow:
  - `rentchain-api/src/routes/__tests__/decisionRoutes.test.ts`
  - `rentchain-api/src/lib/decisions/__tests__/decisionActions.test.ts`
  - `rentchain-api/src/lib/decisions/__tests__/decisionEngine.test.ts`
- Jurisdiction and policy:
  - `rentchain-api/src/lib/jurisdiction/__tests__/leaseWorkflowRegistry.test.ts`
  - `rentchain-api/src/lib/jurisdiction/__tests__/operationalPolicyEvaluator.test.ts`

### Frontend Tests Reviewed

Relevant frontend coverage is largely page/component oriented:

- Landlord operational pages:
  - `rentchain-frontend/src/pages/PropertiesPage.test.tsx`
  - `rentchain-frontend/src/pages/TenantsPage.test.tsx`
  - `rentchain-frontend/src/pages/LeaseLedgerPage.test.tsx`
  - `rentchain-frontend/src/pages/PaymentsPage.test.tsx`
  - `rentchain-frontend/src/pages/LandlordActiveLeasesPage.test.tsx`
  - `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.test.tsx`
- Tenant workspace:
  - `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.test.tsx`
  - `rentchain-frontend/src/pages/tenant/TenantProfileCommunicationsPages.test.tsx`
- Components and helper displays:
  - `rentchain-frontend/src/components/properties/PropertyDetailPanel.test.tsx`
  - `rentchain-frontend/src/components/ledger/PaymentCsvImportPreviewCard.test.tsx`
  - `rentchain-frontend/src/components/tenants/TenantLeasePanel.test.tsx`
  - `rentchain-frontend/src/components/tenants/FinancialActivityPanel.test.tsx`
  - `rentchain-frontend/src/lib/decisions/decisionDisplay.test.ts`
  - `rentchain-frontend/src/lib/jurisdictionLeaseWorkflow.test.ts`
  - `rentchain-frontend/src/lib/leases/leaseLifecycle.test.ts`

### E2E and CI Reviewed

- Playwright is configured in `rentchain-frontend/playwright.config.ts`.
- Current Playwright specs are limited:
  - `rentchain-frontend/tests/playwright/ai-drawer.spec.ts`
  - `rentchain-frontend/tests/playwright/payments.responsive.spec.ts`
- `.github/workflows/ci.yml` currently:
  - builds backend
  - runs frontend Vitest
  - builds frontend
  - does not run backend Vitest in the primary CI workflow
  - does not run Playwright by default

## Coverage Gaps

1. No shared canonical scenario fixture package ties tenant, property, unit, lease, payment, ledger, obligation, decision, and document records together.
2. Many backend tests validate routes or helpers independently, but fewer assert a full workflow payload chain across multiple routes.
3. Frontend tests validate display semantics but usually mock one page at a time, so cross-page consistency can drift.
4. Playwright coverage exists but does not yet cover lifecycle continuity paths such as `/properties` to `/tenants` to `/leases/:leaseId/ledger` to tenant workspace.
5. CI does not currently run backend tests in the primary `ci` workflow, leaving backend route/helper regression protection dependent on local or other workflows.
6. Export behavior is covered in focused tests, but not in an end-to-end continuity scenario that compares UI totals, export rows, and obligation evidence.
7. Decision workflow tests verify transitions, but a continuity smoke should also assert financial obligation values remain unchanged after workflow actions.

## Canonical End-to-End Scenarios

### 1. Applicant to Approved Tenant to Upcoming Occupancy

Start with an applicant record, screening/application approval metadata, generated tenant record, lease draft/lease record, future lease dates, and linked property/unit.

Expected continuity:

- Tenant lifecycle derives approved or lease-pending before occupancy.
- Property unit table shows Upcoming, not Vacant.
- Tenant profile links to the same canonical lease.
- Tenant workspace shows safe lease visibility when invited or activated.

### 2. Upcoming Lease to Active Occupancy to Tenant Workspace Lease Visible

Advance date context or fixture dates so lease start is current.

Expected continuity:

- Unit status derives Occupied.
- Tenant lifecycle derives Active.
- Tenant workspace `/lease` and tenant profile use the same lease/document context.
- Landlord lease summary and ledger routes navigate to the same lease.

### 3. CSV Payment Import to Canonical Payment to Ledger to Obligation Reconciliation

Import a CSV row for a known active lease with tenant, property, unit, amount, date, method, and reference.

Expected continuity:

- Preview parses only allowed fields and omits sensitive banking data.
- Confirm creates canonical `/payments` doc and immutable `/ledgerEntries` row.
- Payment and ledger entries cross-link.
- Lease ledger shows payment entry.
- Payment obligation paid/outstanding state reconciles correctly.
- Tenant profile payments show the imported payment.

### 4. Payment Edit to Adjustment Ledger Entry to Obligation State Preserved

Edit a canonical recorded payment amount.

Expected continuity:

- Existing ledger payment entry is not mutated.
- Adjustment entry is append-only.
- Lease ledger balance reflects exact cents delta.
- Obligation reconciliation remains coherent.
- Non-canonical ledger-only rows remain non-editable.

### 5. Missing Payment to Delinquency Signal to Decision Workflow Action

Create a lease obligation with missing or partial evidence.

Expected continuity:

- Obligation financial status derives Missing, Underpaid, or Manual review required.
- Decision card appears with financial signal separated from workflow status.
- Mark reviewed, snooze, assign, dismiss, and resolve update workflow state only.
- Paid/outstanding/due date/ledger entries remain unchanged.
- Active warning/critical counts exclude inactive workflow statuses.

### 6. Archived Lease to Unit No Longer Occupied

Archive or end a lease without an active replacement lease.

Expected continuity:

- Archived/past lease does not mark unit Occupied.
- Property unit table shows Vacant or Review needed depending on remaining signals.
- Tenant lifecycle derives Past or Archived when explicit.
- Tenant workspace does not select archived lease as current document context when a newer active/upcoming lease exists.

### 7. Tenant Workspace Document Link to Canonical Lease Summary

Use a tenant with current lease and generated or signed lease package.

Expected continuity:

- Tenant workspace lease panel shows the current lease package.
- Tenant documents vault surfaces the same current lease package.
- Landlord tenant profile “Current lease link” uses an operational label and links to the canonical lease route.
- Raw lease IDs are not primary labels.

### 8. Jurisdiction Workflow Guidance Without Legal Automation

Use NS, ON, and missing/unsupported province fixtures.

Expected continuity:

- Lease operations shows jurisdiction workflow guidance.
- Operational policy evaluator returns safe guidance and disclaimer.
- No legal compliance claim appears.
- No notices are generated, sent, or enforced automatically.

### 9. Manual Review to Reviewed/Resolved Workflow State With History Preserved

Use an obligation that requires manual review.

Expected continuity:

- Manual review card remains visible historically after workflow action.
- Review workflow trail appends actions.
- Active decision counts exclude reviewed/resolved/dismissed/snoozed items.
- Financial status remains derived from payment/obligation evidence.

### 10. Property Unit Table to Occupancy Count to Lease Operations Consistency

Use one occupied unit, one upcoming unit, one vacant unit, and one conflicting/review-needed unit.

Expected continuity:

- Unit table labels match normalized occupancy helper output.
- Occupancy counts match visible statuses.
- Lease risk overview uses canonical rent source.
- Lease/ledger links open the related canonical records.

## Cross-System Regression Matrix

| System | Source of truth | Dependent surfaces | Risk if broken | Test type needed | Priority |
| --- | --- | --- | --- | --- | --- |
| Tenant lifecycle | `deriveTenantLifecycle`, tenant/applicant/lease/screening fields | `/tenants`, tenant profile, admin tenants, dashboard summaries | Tenants appear active/past/applicant inconsistently | helper unit + backend route payload + frontend label smoke | Critical |
| Lease execution | `deriveLeaseExecution`, lease status/signature/document fields | lease operations, tenant workspace `/lease`, move-in readiness | Lease appears active or signable when execution is incomplete | helper unit + tenant route integration + lease operations component test | Critical |
| Occupancy display | lease dates/status + property/unit linkage + occupancy coherence helper | `/properties`, lease operations, tenant profile | Units shown Vacant/Occupied incorrectly | helper unit + property route/page regression | Critical |
| Canonical payments | `/payments` docs + canonical payment IDs | `/payments`, tenant profile payments, lease ledger | Edits target wrong IDs or payment rows disappear | backend route integration + frontend edit guard test | Critical |
| Immutable ledger | `ledgerEntries` append-only rows | lease ledger, exports, balances, tenant profile activity | History mutation or balance drift | backend integration + export fixture test | Critical |
| CSV imports | import batch preview/confirm endpoints | `/payments`, lease ledger import panel, tenant profile payments | Duplicate payments, sensitive data exposure, unmatched imports | backend route integration + frontend preview/confirm component tests | Critical |
| Payment obligations | obligation derivation/reconciliation helpers | lease ledger obligations table, delinquency signals, decisions | Paid evidence ignored or due date wrong | backend route integration with exact ledger payload | Critical |
| Decision workflow | decision actions + review trail | lease ledger decisions, dashboard decision counts | Workflow actions appear to alter accounting or stale active counts | backend transition tests + frontend action display tests | High |
| Jurisdiction workflow | jurisdiction registry + policy evaluator | lease operations, property hints, dashboard guidance | Unsafe legal claims or missing jurisdiction fallback | helper unit + UI smoke for disclaimer | High |
| Tenant workspace documents | canonical lease document context + tenant-safe attachments | tenant `/lease`, `/attachments`, profile, landlord tenant profile link | Tenant sees stale/missing/wrong lease package | backend tenant route integration + frontend tenant workspace tests | High |
| Operational references | operational label helpers and explicit Internal ID labels | UI cards, exports, support/debug panels | Raw datastore IDs become business labels | frontend display tests + export row tests | Medium |
| Exports | normalized export builders | CSV/PDF exports from ledger/payments/properties | Datastore dump semantics leak to landlords | backend/export utility + frontend safe download smoke | Medium |

## Suggested Test Harness Approach

### Stage 1: Pure Helper Tests

Keep testing pure derivation helpers directly:

- lifecycle state
- lease execution
- occupancy coherence
- obligation reconciliation
- jurisdiction policy
- decision display/state classification

These tests should be fast, deterministic, and date-controlled.

### Stage 2: Backend Route Integration Tests

Add route-level tests with Firestore mock data for canonical scenario payloads:

- `/api/leases/:leaseId/ledger`
- `/api/ledger/imports/payment-csv/preview`
- `/api/ledger/imports/payment-csv/confirm`
- `/api/payments/:paymentId`
- `/api/tenant/lease`
- `/api/tenant/attachments`
- `/api/decisions/:decisionId/action`

The goal is to assert the actual API payloads used by UI routes, including field aliases such as `dueDate`, `metadata.dueDate`, `documentUrl`, and `leaseDocumentContext`.

### Stage 3: Frontend Component and Page Tests

Use existing page tests to assert display semantics:

- human-readable operational labels
- no raw IDs as primary labels
- financial status separated from workflow status
- tenant workspace document and lease state labels
- import preview/confirm selection behavior

### Stage 4: Lightweight Playwright Smoke Tests

Add a small number of smoke paths after fixture setup is stable:

- route loads without crash
- canonical labels appear
- key navigation links route to the expected path
- no test writes occur unless the scenario explicitly uses a seeded preview environment

### Stage 5: Fixture-Driven Scenario Seeds

Create reusable scenario factories rather than copying ad hoc objects across tests. Suggested structure:

- `rentchain-api/src/testScenarios/lifecycleContinuity.ts`
- `rentchain-frontend/src/testScenarios/lifecycleContinuity.ts`
- or a docs-backed fixture contract first, then implementation in follow-up PRs.

The first fixture set should include stable IDs for:

- landlord
- property
- units 101/102/103
- active tenant
- applicant tenant
- active lease
- upcoming lease
- archived lease
- canonical payment
- ledger payment
- obligation evidence
- manual review decision
- generated lease document
- signed lease document

## Minimal Future E2E Smoke Paths

Recommended initial Playwright route coverage:

1. `/properties`
   - property unit table renders Occupied, Upcoming, Vacant, and Review needed fixtures.
2. `/tenants`
   - active tenant profile opens and current lease link is operational.
3. `/leases`
   - active/upcoming lease rows load and route to summary/ledger.
4. `/leases/:leaseId/ledger`
   - ledger entries, obligations, decisions, import panel, and due dates render coherently.
5. `/payments`
   - canonical payment rows render, edit guard is visible only where safe, import CTA loads.
6. Tenant workspace `/tenant/lease`
   - current lease document context displays signed/generated/pending state.
7. Tenant workspace `/tenant/messages`
   - tenant-visible conversation thread loads when seeded.

## CI Readiness

Current CI shape from `.github/workflows/ci.yml`:

- backend job installs and builds backend
- frontend job installs, runs frontend tests, and builds frontend
- backend tests are not part of this primary CI workflow
- Playwright is not part of this primary CI workflow

Recommended staged CI additions:

1. Add a targeted backend lifecycle-continuity test command once scenario fixtures exist.
2. Add a frontend lifecycle-continuity smoke command for page-level display semantics.
3. Add Playwright smoke tests behind a separate optional or scheduled job before making them required.
4. Keep full Playwright out of the critical merge path until fixture reliability and preview auth are stable.
5. Track runtime budget explicitly; continuity tests should be fewer and higher signal than broad exhaustive E2E.

## First Implementation Follow-Up Missions

1. `test/lifecycle-continuity-fixtures-v1`
   - Create shared backend fixture factories and documented canonical IDs.
   - No new product behavior.

2. `test/payment-ledger-obligation-e2e-v1`
   - Assert CSV import confirm creates canonical payment and ledger entry, then obligation route payload reconciles correctly.

3. `test/tenant-workspace-lease-linkage-e2e-v1`
   - Assert tenant `/lease`, `/attachments`, landlord tenant profile, and lease summary agree on current lease/document context.

4. `test/property-occupancy-regression-suite-v1`
   - Assert property unit statuses, counts, lease links, and edit modal hydration stay coherent.

5. `test/decision-workflow-regression-suite-v1`
   - Assert decision actions update workflow state and review trail while financial/obligation values remain unchanged.

6. `test/jurisdiction-policy-guidance-regression-v1`
   - Assert NS/ON/missing jurisdiction guidance appears with disclaimer and does not generate legal actions.

7. `test/export-operational-reference-regression-v1`
   - Assert CSV/PDF exports use operational labels and do not expose raw datastore fields as landlord-facing schema.

## Acceptance Checklist for Future Continuity Tests

- Tests use canonical scenario fixtures instead of unrelated ad hoc records.
- Backend route tests assert payloads consumed by actual UI pages.
- Frontend tests assert user-visible semantics, not implementation details.
- E2E smoke tests stay minimal and deterministic.
- Financial truth, workflow status, and document visibility remain explicitly separated.
- Tenant-facing data uses safe projections and does not leak cross-tenant data.
- Internal IDs appear only in support/debug contexts with explicit labels.

## Known Risks

- Adding broad E2E tests too early could create flaky merge gates without improving safety.
- Fixtures can become a second source of truth if they are not tied to documented canonical scenario contracts.
- Backend tests are numerous but not currently run by the primary CI workflow; adding them all at once may create runtime or stability pressure.
- Date-sensitive lifecycle and obligation scenarios need controlled clocks or fixed fixture dates.
