# Mobile Bottom Nav Fifth Slot Priority Audit v1

Issue: #1283
Mission: `audit/mobile-bottom-nav-fifth-slot-priority-v1`
Status: audit only, no implementation changes

## Context

Recent mobile, tablet, and narrow-desktop QA found that the landlord bottom navigation has room for one more direct destination beside:

- Dashboard
- Properties
- Applicants
- Inbox

The same QA cycle also surfaced repeated navigation friction around Operations visibility, lease workflows, payment ledger access, analytics destination routes, rent collection setup, and review queue action visibility.

This audit reviews whether the fifth slot should remain an overflow entry or become a direct workspace destination for RC1 landlord workflows.

## Source Files Reviewed

- `rentchain-frontend/src/components/layout/LandlordNav.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.css`
- `rentchain-frontend/src/components/layout/LandlordNav.test.tsx`
- `rentchain-frontend/src/components/layout/navConfig.ts`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/DashboardPage.test.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `docs/audit/lease-ledger-navigation-discoverability-v1.md`
- `docs/audit/lease-rent-collection-cta-visibility-v1.md`

## Current Bottom Nav State

`LandlordNav.tsx` currently renders landlord mobile bottom navigation only for landlord role contexts and excludes admin-like contexts. Tenant navigation is separate in `TenantNav` and should remain unchanged.

The direct mobile tabs are hard-coded in `landlordMobileTabs`:

- `/dashboard` labeled `Dashboard`
- `/properties` labeled `Properties`
- `/applications` labeled `Applicants`
- `/landlord/unified-inbox` labeled `Inbox`

The fifth visible control is currently `More`, which opens the landlord drawer. This means the UI does not have an empty fifth slot; it has a fifth overflow slot.

`LandlordNav.css` defines the mobile tab bar with `grid-template-columns: repeat(6, minmax(0, 1fr))` inside the mobile breakpoint. In practice, the current render uses five controls: four direct tabs plus `More`. That leaves enough visual capacity for a direct fifth workspace while still keeping an overflow control if the grid remains six columns.

`LandlordNav.test.tsx` explicitly confirms the current setup order:

- Dashboard
- Properties
- Applicants
- Inbox
- More

The same tests confirm that `Leases`, `Tenants`, and `Messages` are not direct bottom tabs today.

## Current Drawer and Workspace Navigation State

`navConfig.ts` includes the relevant landlord destinations:

- `Dashboard` at `/dashboard`
- `Operations` at `/operations`
- `Properties` at `/properties`
- `Applications` at `/applications`
- `Leases` at `/leases`
- `Inbox` at `/landlord/unified-inbox`
- `Analytics` at `/analytics`
- `Payments` at `/payments`

Important current visibility detail: `Operations` has `showInDrawer: false`, even though `LandlordNav.tsx` includes `operations` in `stickyWorkspaceIds`. This makes Operations visible in the desktop workspace bar, but not in the mobile drawer's primary workspace list.

This matches the recent QA friction: `/operations` is reachable from Dashboard CTAs and route links, but it is not directly discoverable from the mobile bottom nav or drawer.

## Route and Workflow Coverage

`App.tsx` registers all candidate routes under `LandlordNav`:

- `/operations`
- `/leases`
- `/leases/:leaseId/summary`
- `/leases/:leaseId/workflows/:workflowKey`
- `/leases/:leaseId/ledger`
- `/payments`
- `/analytics`

`DashboardPage.tsx` and `DashboardPage.test.tsx` show that Dashboard routes several high-priority workflows outward:

- Lease renewal and lease workspace decisions can route to `/leases`.
- Lease-level payment decisions can route to `/leases/:leaseId/ledger`.
- Upcoming Actions exposes an `Open Operations` CTA to `/operations`.
- Financial Snapshot exposes a payments workspace route such as `/payments?context=current_month&period=2026-06&source=dashboard`.
- Revenue pressure routes to `/analytics?entry=revenue-pressure`.
- Vacancy readiness routes to `/analytics?entry=vacancy-readiness`.

`OperationalCommandCenterPage.tsx` centralizes multiple action categories:

- Lease lifecycle
- Payments / obligations
- Occupancy
- Screening
- Documents / workspace
- Operational review

It also derives lease-scoped destinations for payment readiness, lease ledger, lease summary, renewal workflows, and document readiness. This makes Operations more than a single queue: it is the cross-workspace triage layer for RC1 landlord follow-through.

## Candidate Comparison

### Operations

Strengths:

- Best matches the repeated QA friction around Operations visibility.
- Aggregates lease lifecycle, payments, occupancy, screening, document readiness, and operational review signals.
- Complements Dashboard: Dashboard surfaces summaries and previews; Operations is the review and execution queue.
- Already has explicit Dashboard CTA support through `Open Operations`.
- Avoids choosing one domain when the fifth slot needs to represent cross-workflow actionability.

Risks:

- Could feel duplicative if users think Dashboard already is the command center.
- Requires clear label and icon so it reads as the action queue, not a generic settings area.
- Needs drawer visibility alignment because Operations is currently hidden from the mobile drawer.

Assessment: strongest candidate for RC1.

### Leases

Strengths:

- Lease setup, signing, rent readiness, renewals, ledger access, and tenant workspace readiness have been recurring QA themes.
- `/leases` is a primary landlord workspace and a natural home for lifecycle follow-through.
- Lease rows now expose clearer ledger and payment setup actions after recent fixes.

Risks:

- Narrower than Operations. Payment readiness, ledger issues, documents, and occupancy conflicts often start as operational review work rather than pure lease browsing.
- Adding Leases may still leave Operations under-discoverable.
- Many lease-specific routes are already reachable from Dashboard, Properties, Tenant Profile, and Operations when lease context exists.

Assessment: strong fallback if the product wants lifecycle management to outrank review queue access.

### Payments

Strengths:

- Rent collection, current month payment review, payment ledger, and overdue obligation handling are high-value workflows.
- Dashboard Financial Snapshot already routes to `/payments`.

Risks:

- `/payments` is a recorded-payments overview, while many recent payment issues require lease-specific ledger or payment readiness context.
- A generic Payments tab may send users to the wrong level of detail for obligation reconciliation.
- Payment readiness is often better handled through Operations or lease-specific routes.

Assessment: useful but too narrow and potentially ambiguous for the fifth direct slot.

### Analytics

Strengths:

- Revenue pressure and vacancy readiness are important dashboard-routed destination views.
- Recent layout polish made mobile and desktop analytics routes more usable.

Risks:

- Analytics is monitoring and diagnosis, not daily operational execution.
- Dashboard already acts as the primary analytics entry point.
- Making Analytics a direct mobile slot would not address Operations, lease setup, or rent collection actionability friction.

Assessment: not the best RC1 fifth-slot destination.

### More

Strengths:

- Preserves flexibility.
- Avoids prematurely hard-coding one workflow.
- Keeps the current drawer access pattern and protects against bottom-nav crowding.

Risks:

- It is already the current state, and recent QA still found navigation friction.
- If Operations remains hidden from the drawer, `More` does not solve Operations discoverability.
- Overflow menus are weaker for high-frequency action queues than direct destinations.

Assessment: keep as overflow, but do not let it occupy the only available fifth direct workspace slot if six visual columns are retained.

## Recommendation

Recommended fifth direct slot: `Operations`

Recommended label: `Operations`

Recommended route: `/operations`

Recommended icon: `ClipboardList` from `lucide-react`, matching the existing `navConfig.ts` Operations icon and command-center category language.

Recommended mobile model:

- Keep Dashboard, Properties, Applicants, and Inbox as direct tabs.
- Add Operations as the fifth direct workspace tab.
- Keep `More` as the sixth overflow control if mobile layout continues to support six columns.
- If implementation decides the tab bar should stay at five controls, replace `More` only if the drawer remains reachable from the mobile topbar's existing menu button.

Recommended desktop behavior:

- No desktop/sidebar redesign is needed.
- Desktop workspace navigation already includes Operations through `stickyWorkspaceIds`.
- Future implementation should avoid changing desktop layout unless needed to keep active-state behavior aligned.

Recommended audience:

- Landlord mobile/tablet/narrow layouts only.
- Do not change tenant bottom navigation.
- Do not show landlord Operations to admin-like contexts unless already supported by the existing desktop/workspace rules.

## Rationale

Operations is the best fifth slot because it is the one candidate that aggregates the other candidates' actionable work:

- Lease lifecycle issues can appear in Operations.
- Payment readiness and obligation review can appear in Operations.
- Occupancy conflicts can appear in Operations.
- Screening and document readiness can appear in Operations.
- Manual review and decision follow-through can appear in Operations.

Leases and Payments are important, but they are domain workspaces. Analytics is important, but it is primarily a monitoring destination. Operations is the cross-domain execution workspace where a landlord can continue from Dashboard signals without knowing the exact underlying domain first.

This also resolves a known inconsistency in current navigation: Dashboard and desktop workspace navigation already treat Operations as important, while mobile drawer visibility currently hides it.

## Recommended Follow-Up Implementation Mission

Mission: `fix/mobile-bottom-nav-operations-slot-v1`

This is more precise than `fix/mobile-bottom-nav-fifth-slot-v1` because the audit recommends Operations, not a generic fifth-slot experiment.

### Future Scope

- Frontend landlord navigation only.
- Add Operations as a direct landlord mobile bottom-nav destination.
- Preserve Dashboard, Properties, Applicants, and Inbox.
- Preserve `More` if the six-column layout remains visually acceptable.
- Ensure Operations is discoverable from mobile drawer/topbar behavior.
- Keep tenant navigation unchanged.
- Keep routes and workflow pages unchanged.

### Future Acceptance Criteria

1. Landlord mobile bottom nav includes `Operations` as a direct destination.
2. `Operations` routes to `/operations`.
3. Operations active state is correct on `/operations`.
4. Existing direct tabs remain available: Dashboard, Properties, Applicants, Inbox.
5. Overflow/drawer access remains available through `More` or the mobile topbar menu.
6. The mobile tab bar does not overflow or truncate labels on common mobile widths.
7. Tenant bottom navigation remains unchanged.
8. Admin-like landlord contexts continue to suppress landlord mobile bottom nav as they do today.
9. Desktop workspace navigation remains functionally unchanged.
10. Tests cover tab order, routing, active state, and tenant/admin non-regression.

### Suggested Future Validation

- `npm run test:single -- src/components/layout/LandlordNav.test.tsx src/components/layout/TenantNav.test.tsx`
- Frontend build.
- `git diff --check`.

### Suggested Future Manual QA

- Mobile `/dashboard`: confirm Operations appears and routes to `/operations`.
- Mobile `/operations`: confirm Operations tab active state.
- Mobile `/properties`, `/applications`, `/landlord/unified-inbox`: confirm existing tabs still work.
- Mobile drawer/topbar: confirm overflow pages remain accessible.
- Tablet/narrow desktop: confirm no nav overflow.
- Tenant mobile workspace: confirm tenant nav unchanged.
- Desktop landlord routes: confirm workspace nav still acceptable.

## Non-Goals

- No implementation in this audit.
- No nav changes.
- No routing changes.
- No dashboard changes.
- No Operations redesign.
- No tenant nav changes.
- No icon implementation.
- No mobile layout refactor.
