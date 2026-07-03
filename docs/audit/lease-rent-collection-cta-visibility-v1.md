# Lease Rent Collection CTA Visibility Audit v1

Date: 2026-07-03
Issue: #1283 follow-up
Mission: `audit/lease-rent-collection-cta-visibility-v1`

## Scope

This audit reviews why the landlord-facing `/leases` page may not show an `Enable rent collection` action even when tenant/payment readiness projections say rent collection is not enabled.

This is a docs-only audit. It does not change payment processing, Stripe integration, lease signing, tenant portal projection, ledger behavior, backend routes, schema, or frontend runtime code.

## Observed State

During PR #1285 manual QA, tenant-side payment readiness showed:

- Payment readiness: `Review rent terms`
- Rent amount: `Available`
- Due day: `Needed`
- Lease dates: `Available`
- Tenant linked: `Linked`
- Lease executed: `In progress`
- Rent collection: `Not enabled`
- Latest status: `No payment started`
- Guidance: `Lease payment setup details still need review before checkout can start.`

The landlord-facing `/leases` list did not show `Enable rent collection`.

## Source Files Reviewed

- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.test.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/lib/payments/paymentStatusGuidance.ts`
- `rentchain-frontend/src/api/leasesApi.ts`
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/services/paymentReadiness/derivePaymentReadiness.ts`
- `rentchain-api/src/services/projections/buildLeasePaymentProjection.ts`
- `rentchain-api/src/services/rentPayments/rentPaymentService.ts`
- `rentchain-api/src/services/projections/__tests__/buildLeasePaymentProjection.test.ts`
- `rentchain-api/src/services/paymentReadiness/__tests__/derivePaymentReadiness.test.ts`

## Current Data Flow

### Backend Projection

`buildLeasePaymentProjection` derives `paymentReadiness` from the lease row, tenant linkage, dates, rent amount, due day, and tenant-safe lease execution metadata.

`derivePaymentReadiness` returns:

- `ready_to_configure` when rent amount, due date, lease dates, and tenant linkage are present.
- `not_ready` when core rent terms need review, including a missing due day.
- `blocked` when the lease record is ambiguous or execution metadata is blocked.

The readiness object also includes `rentTerms.leaseExecuted`, but the current `ready_to_configure` branch is based on rent amount, due date, lease dates, and tenant linkage. Lease execution is still surfaced as a projected field.

`deriveRentPaymentEligibility` gates payment rail enablement. If `paymentReadiness.readinessStatus !== "ready_to_configure"`, it returns `blockedReason: "payment_readiness_not_ready"`.

`getRentPaymentSummaryForLease` then exposes:

- `paymentRail.enabled`
- `paymentRail.blockedReason`
- latest payment history
- payment experience status

### Landlord `/leases`

`LandlordActiveLeasesPage.tsx` renders payment status copy when `rentPaymentSummary` exists:

- `Rent collection enabled` or `Rent collection not enabled`
- payment experience status such as `No payment started`
- blocker guidance from `describeRentPaymentGuidance`

The `Enable rent collection` button exists, but it is rendered only when both are true:

- `lease.rentPaymentSummary?.paymentRail.enabled !== true`
- `lease.paymentReadiness?.readinessStatus === "ready_to_configure"`

If readiness is `not_ready` because the due day is missing, the button is hidden. No disabled or staged action is shown in its place.

### Enable Endpoint

`POST /api/leases/:leaseId/payment-rails/enable` recomputes the lease payment projection server-side. If `leasePaymentProjection.blockedReason` is present, the route returns:

- `400`
- `error: "LEASE_PAYMENT_RAIL_INELIGIBLE"`
- `detail: <blocked reason>`

The frontend therefore avoids showing an enabled `Enable rent collection` action when the backend would reject it.

### Tenant Portal

Tenant checkout creation also fails closed. `tenantPortalRoutes.ts` blocks checkout when `paymentRailEnabled` is not true or the processor is not Stripe, then separately recomputes rent payment eligibility before creating checkout.

Tenant workspace readiness copy maps the same payment-readiness fields into visible tenant status:

- due day needed
- lease executed in progress
- rent collection not enabled
- setup details still need review

## Current CTA Visibility Logic

`Enable rent collection` is not globally missing from `/leases`. It appears in tests and source when the lease is `ready_to_configure` and the rail is not enabled.

The observed lease did not show it because payment readiness was not ready:

- Due day was missing.
- Payment readiness label was `Review rent terms`.
- Rent collection was not enabled.
- The payment rail blocked reason was consistent with `payment_readiness_not_ready`.

The actual visibility gap is that `/leases` exposes the status and reason, but it does not expose a staged landlord action such as `Review rent terms` or `Complete payment setup` for not-ready records.

## Audit Questions

### Where was `Enable rent collection` previously rendered?

The current source renders it in `LandlordActiveLeasesPage.tsx` inside `renderLeaseActions`. It is also covered by `LandlordActiveLeasesPage.test.tsx` for ready-to-configure leases.

This audit did not find a normal `/leases` render path that shows `Enable rent collection` for not-ready leases.

### Which component controls visibility?

`LandlordActiveLeasesPage.tsx` controls visibility for the `/leases` list/card actions.

The backend route `POST /api/leases/:leaseId/payment-rails/enable` independently enforces the same eligibility boundary.

### What conditions now hide it?

The button is hidden whenever:

- rent collection is already enabled, or
- `paymentReadiness.readinessStatus` is not `ready_to_configure`, or
- the lease is in the archived view.

### Is it hidden because due day is missing?

Yes for the observed state. A missing due day makes `dueDateAvailable` false, which drives `paymentReadiness.readinessStatus` to `not_ready` with the `Review rent terms` label.

### Is it hidden because lease execution is in progress/not complete?

Not directly in the current `derivePaymentReadiness` ready branch. Lease execution is projected and displayed, but the current ready-to-configure check depends on rent amount, due day, lease dates, and tenant linkage. However, payment/readiness copy can still show `Lease executed: In progress`, which contributes to the user's perception that setup is incomplete.

### Is it hidden because signed document is pending?

Not directly by the rent-collection CTA condition. Signed-document and execution readiness are separate projections, though they can appear alongside payment readiness and make the lease look not fully tenant-ready.

### Is it hidden because rent collection is not enabled but payment setup prerequisites are incomplete?

Yes. That is the intended backend safety boundary. The problem is that the UI currently hides the enable action without offering a clear staged action for completing the missing prerequisite.

### Should the CTA be renamed or staged?

Yes. `Enable rent collection` should be reserved for leases where the backend can safely enable the rail.

For not-ready leases, the UI should show a staged action such as:

- `Review rent terms`
- `Complete payment setup`
- `Complete lease payment setup`

The staged action should point to the existing safe lease setup or summary/workflow area where the landlord can resolve missing details, such as due day.

### Should the UI show a disabled CTA with reasons instead of hiding it?

Likely yes, or it should show an adjacent staged action. The current hidden-button behavior avoids a failed backend call but creates a discoverability and actionability gap.

### Should `/leases` route the landlord to the correct payment setup workspace?

Yes, if a safe destination already exists. The existing lease summary route supports a rent/payment section focus via `?section=rent-payment`, and workflow pages expose lease facts plus `Payment ledger`. A follow-up should choose one existing destination and avoid creating a new payment workflow unless explicitly scoped.

### Does tenant payment readiness align with landlord action visibility?

Partially.

The projections align technically: tenant and landlord surfaces both reflect that rent collection is not enabled and setup details need review. The mismatch is action-oriented: the tenant sees why checkout cannot start, while the landlord does not always see a clear next action from `/leases`.

## Root Cause Classification

Primary classification: missing prerequisite explanation/action visibility.

Secondary classification: copy/action mismatch.

This does not appear to be a payment processing bug. Backend eligibility intentionally blocks enablement until payment readiness is `ready_to_configure`.

This does not appear to be a tenant portal projection bug. Tenant copy correctly shows that due day is needed and rent collection is not enabled.

This may feel like a regression because the product previously had or expected a visible `Enable rent collection` path, but current source intentionally renders that exact button only for ready-to-configure leases.

## Expected User-Facing Behavior

On `/leases`, landlords should always have a clear payment-related next step when rent collection is not enabled and lease payment context exists.

Recommended staged behavior:

- If `paymentRail.enabled === true`: show `Rent collection enabled` and keep payment management/ledger access.
- If readiness is `ready_to_configure` and rail is disabled: show enabled `Enable rent collection`.
- If readiness is `not_ready` with `requiredNextAction === "review_rent_terms"`: show `Review rent terms` or `Complete payment setup`, with visible reasons such as `Due day needed`.
- If readiness is `not_ready` with `requiredNextAction === "complete_lease_details"`: show `Complete lease details`, not `Enable rent collection`.
- If readiness is `blocked`: show a disabled/secondary action with a clear reason and avoid calling the enable endpoint.

The UI should avoid implying checkout can start before required setup is complete.

## Recommended Follow-Up

Recommended implementation mission:

`fix/lease-rent-collection-setup-action-visibility-v1`

This name is more precise than `fix/lease-rent-collection-cta-visibility-v1` because the issue is not that the enable CTA is missing in all cases; it is that setup/review actions are missing when the enable CTA is intentionally gated.

### Future Implementation Scope

- Frontend `/leases` action visibility and copy only, unless tests prove a projection bug.
- Add staged payment setup actions for not-ready leases.
- Preserve backend eligibility checks.
- Preserve Stripe/payment processing behavior.
- Preserve tenant portal behavior.
- Do not enable rent collection when backend eligibility would reject it.

### Future Acceptance Criteria

- `/leases` shows `Enable rent collection` only when the lease is eligible to enable the rail.
- `/leases` shows `Review rent terms`, `Complete lease details`, or `Complete payment setup` when rent collection is not enabled but prerequisites are incomplete.
- The action copy explains missing due day, missing tenant link, missing rent amount, or blocked readiness without exposing raw internal IDs.
- The staged action routes to an existing safe lease setup/summary/workflow destination.
- Ready-to-configure leases still enable rent collection successfully.
- Not-ready leases do not call `POST /api/leases/:leaseId/payment-rails/enable`.
- Tenant payment readiness and landlord action visibility remain consistent.
- Existing `/leases`, `/leases/:leaseId/summary`, tenant workspace, and payment ledger routes continue to load.

### Suggested Test Coverage

- `/leases` ready-to-configure lease with rail disabled shows enabled `Enable rent collection`.
- `/leases` missing due day shows `Review rent terms` or equivalent staged action and does not show enabled `Enable rent collection`.
- `/leases` missing core lease details shows `Complete lease details`.
- `/leases` rail enabled shows enabled state and no setup CTA.
- Mobile lease card renders the same staged payment action without layout overflow.

## Validation for This Audit

This audit is docs-only. Validation should include:

- `git diff --check`
- competitor-name scan for the audit artifact
- confirmation that only `docs/audit/lease-rent-collection-cta-visibility-v1.md` changed
