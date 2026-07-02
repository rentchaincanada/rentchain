# Lease Ledger Navigation Discoverability Audit v1

Issue: #1277  
Mission: `audit/lease-ledger-navigation-discoverability-v1`  
Status: audit only, no implementation changes

## Context

PR #1276 made `/leases/:leaseId/ledger` clearer and more usable once reached. During QA, the remaining product issue was discoverability: a new landlord could reach the lease ledger from `/leases`, but the broader navigation model was not obvious from other landlord workflows.

This audit reviews current landlord entry points to `/leases/:leaseId/ledger`, identifies where access is missing or unclear, and scopes a focused follow-up implementation mission.

## Current known ledger entry points

### Route

`rentchain-frontend/src/App.tsx` registers the landlord lease ledger route at `/leases/:leaseId/ledger`.

There is also a separate `/tenant/ledger` tenant-facing route and a general `/ledger` route. Those should not be treated as replacements for landlord lease-level ledger discovery.

### Dashboard Decision Queue Preview

`rentchain-frontend/src/pages/DashboardPage.tsx` preserves decision-provided routes through `operationalHref`. If a decision's recommended action href contains `/ledger`, the visible copy becomes `Payment ledger - Review obligation` with an action such as `Open ledger`.

Assessment: this is appropriate for lease-level payment decisions. Dashboard should continue to route directly to the ledger only when the decision already has specific lease/payment context. Portfolio-level revenue pressure should continue routing to analytics or a portfolio payments view rather than a single lease ledger.

### Dashboard Upcoming Actions and Calendar Preview

Upcoming Actions and Calendar Preview also use `operationalHref`, so they follow the decision item's recommended destination instead of independently deciding whether a ledger is appropriate.

Assessment: this is acceptable. The follow-up should preserve this behavior and only improve labels when a decision destination is already a lease ledger.

### Operations

`rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx` classifies payment work under `Payments / obligations`. Decision evidence links use source workflow destinations, and lease payment-readiness signals can route to `/leases/:leaseId/ledger`.

Assessment: Operations should continue sending lease-scoped payment and obligation reviews to the lease ledger. The category label is clear enough for the queue, but action labels should prefer `Review payments` or `Open payment ledger` when the destination is a lease ledger.

### Decision context and review surfaces

`rentchain-frontend/src/lib/decisions/decisionContext.ts` adds a `Lease ledger` link for decisions with a `leaseId`. Decision inbox, evidence pack, review workspace, and review timeline tests all cover ledger destinations for payment or delinquency review context.

Assessment: this is an important governed-review path and should remain available. It is less useful as primary landlord navigation because it depends on an existing decision/review item.

### `/leases`

`rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx` builds a lease-specific `ledgerPath` and renders a `Ledger` action beside lease summary, document, and email actions.

Assessment: this is the strongest general discovery path today, but the label is terse and may be easy to miss among other row/card actions, especially on mobile. The future implementation should make the lease list/card shortcut consistently visible and label it as `Payment ledger` or `Open ledger`.

### `/leases/:leaseId/summary`

`rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx` exposes an `Open ledger` action near `Print / Save PDF`, evidence package download, and back-to-leases actions.

Assessment: this is good placement. The follow-up should keep it and consider consistent wording such as `Payment ledger` if the lease list changes to the same label.

### `/leases/:leaseId/workflows/:workflowKey`

`rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx` exposes a `Ledger` action in the workflow overview next to `Back to leases` and `Lease summary`.

Assessment: the route has ledger access, but the label is minimal. Use the same lease-level payment ledger wording as the lease list and summary surfaces.

### `/properties` and `/properties/:propertyId`

`rentchain-frontend/src/components/properties/PropertyDetailPanel.tsx` can build `ledgerHref` for occupied/upcoming unit lease context and also renders a `Ledger` button for active lease risk rows.

Assessment: property detail has contextual ledger access where lease context exists. The label should be clearer, and mobile visibility should be preserved because property detail is a natural place for landlords to look up a unit, tenant, and payment status.

### Tenant profile surfaces

`rentchain-frontend/src/pages/TenantsPage.tsx` computes a selected tenant's current lease ledger path and renders a `Lease ledger` card with `View ledger`, `Record payment`, and `Export ledger` actions when a current lease can be resolved. `rentchain-frontend/src/components/tenants/TenantDetailPanel.tsx` can navigate to the lease ledger from tenant context and shows an informational toast if no lease ledger is available.

Assessment: tenant context is a reasonable path to ledger discovery. It should remain disabled or explanatory when no current lease is available, and it must not expose raw IDs as labels.

### Payments page

`rentchain-frontend/src/pages/PaymentsPage.tsx` explains that recorded payments and lease ledger activity are intentionally separate to avoid double counting.

Assessment: the current payments overview does not provide a lease-specific ledger shortcut. That is acceptable for portfolio-level rows without lease context, but rows or workspace items with a specific lease should offer `Open payment ledger` in the future.

## Missing or unclear entry points

1. Ledger labels are inconsistent: `Ledger`, `Open ledger`, `View ledger`, `Lease ledger`, `Payment ledger`, and `Payments / obligations source workflow` all appear in nearby workflows.
2. `/leases` has a ledger action, but `Ledger` may be too terse for landlords who are looking for payments, balances, or obligations.
3. Lease workflow and property detail surfaces expose `Ledger`, but those labels do not clearly communicate payment or obligation context.
4. Payments overview explains the separation from ledger activity but does not help a landlord get from a lease-scoped payment row to that lease's ledger.
5. Dashboard and Operations routing is mostly correct, but future changes should keep the distinction between lease-level payment decisions and portfolio-level revenue analytics explicit.
6. Mobile discoverability should be tested explicitly because a row action that is technically present can still be buried behind dense cards or action wrapping.

## Recommended product direction

Group ledger access under both lease actions and payment actions:

- Lease surfaces should expose a stable `Payment ledger` or `Open ledger` shortcut.
- Payment-decision surfaces should use action-oriented labels such as `Review payments` or `Open payment ledger`.
- Property and tenant detail surfaces should expose ledger access only when they can resolve a current lease.
- Portfolio revenue, analytics, and aggregate payments surfaces should not route to a single lease ledger unless a specific lease is selected.
- Advanced review/evidence surfaces should keep ledger links available for governed context, but those should not be the only way a landlord discovers the ledger.

## Recommended follow-up implementation mission

Mission: `fix/lease-ledger-navigation-shortcuts-v1`

Scope:

- Frontend navigation labels and shortcuts only.
- Lease, property, tenant, dashboard decision, operations, and payments-overview presentation only where a specific lease context already exists.
- No ledger calculation changes.
- No payment write behavior changes.
- No backend changes.
- No dashboard decision derivation changes.
- No route redesign.

Acceptance criteria:

1. `/leases` active lease rows/cards expose a consistent ledger action that is readable on mobile, preferably `Payment ledger` or `Open ledger`.
2. `/leases/:leaseId/summary` exposes a clear lease-level payment ledger action.
3. `/leases/:leaseId/workflows/:workflowKey` exposes the same clear ledger wording.
4. Property detail occupied/upcoming lease context exposes a clear ledger shortcut without raw internal IDs.
5. Tenant profile/current lease context exposes a clear ledger shortcut when a lease exists and an explanatory disabled/unavailable state when it does not.
6. Operations payment/obligation decisions continue routing to the lease ledger when a lease-scoped destination exists.
7. Dashboard Decision Queue Preview and Upcoming Actions continue using lease ledger routes only for lease-level payment decisions.
8. Portfolio revenue pressure continues routing to analytics or a portfolio-level payments/revenue view, not a single lease ledger.
9. Payments overview offers a ledger shortcut only when a payment row or workspace item has a specific lease context.
10. Mobile users can discover lease ledger access within one or two taps from lease, property, or tenant context.
11. No raw internal IDs are exposed as user-facing labels.

Suggested validation for the future implementation:

- Targeted tests for lease list, lease summary, lease workflow, property detail, tenant detail, dashboard decision routing, operations payment decisions, and payments overview when lease context exists.
- Frontend build.
- `git diff --check`.
- Manual QA on mobile and desktop for `/leases`, `/leases/:leaseId/summary`, `/properties/:propertyId`, tenant profile, `/operations`, `/dashboard`, and `/payments`.

## Out of scope for this audit

- Implementing shortcuts or label changes.
- Changing dashboard decision derivation.
- Changing lease ledger behavior.
- Changing payment logic.
- Changing backend routes or projections.
- Changing tenant-facing `/tenant/ledger`.
