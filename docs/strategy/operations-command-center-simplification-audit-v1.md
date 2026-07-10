# Operations Command Center Simplification Audit v1

Branch: `audit/operations-command-center-simplification-v1`
Scope: `/operations` audit and future implementation plan only; no UI, backend, routing, auth, data model, billing, account, legal, or theme implementation.

## Executive Summary

`/operations` is currently trying to be a command center, source-workflow router, decision triage layer, manual review queue, and embedded review workspace in one page. The underlying data sources are useful, and the page already has strong safety posture: it is read-heavy, manual-review-oriented, and routes back to source workspaces rather than mutating records directly.

The problem is hierarchy. The current first impression is dense and abstract. Landlords need the page to answer:

- What needs attention today?
- What is overdue?
- What is blocked?
- What is waiting on tenant, landlord, or contractor?
- What can I complete quickly?
- Which items have evidence or audit trail?

The smallest safe next implementation PR should be frontend-only:

`polish/operations-command-center-simplification-v1`

It should reorganize the existing `/operations` page around clearer daily-work buckets, keep `/dashboard` as the high-level executive summary, keep `/decision-inbox` as the normalized decision queue, keep `/landlord/unified-inbox` as messaging, and preserve source-workspace routing.

## Current Route / File Map

### Route ownership

- Route: `/operations`
- Route file: `rentchain-frontend/src/App.tsx`
- Shell: `RequireAuth` -> `LandlordNav` -> lazy `OperationalCommandCenterPage`
- Page file: `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- Test file: `rentchain-frontend/src/pages/OperationalCommandCenterPage.test.tsx`

### Related route boundaries

- `/dashboard`
  - `rentchain-frontend/src/pages/DashboardPage.tsx`
  - Executive/portfolio summary, decision queue preview, upcoming actions, calendar preview, workspace routing.
- `/decision-inbox`
  - `rentchain-frontend/src/pages/DecisionInboxPage.tsx`
  - Normalized decision inbox with filters, automation/agent-action context, evidence/review links, and operator review panels.
- `/landlord/unified-inbox`
  - `rentchain-frontend/src/pages/UnifiedInboxPage.tsx`
  - Message inbox with safe backend-provided source actions and read-state persistence.
- `/properties`
  - `rentchain-frontend/src/pages/PropertiesPage.tsx`
  - Property/unit records, action requests, occupancy context, lease risk, export/print behavior.
- `/tenants`
  - `rentchain-frontend/src/pages/TenantsPage.tsx`
  - Tenant records and tenant-specific operational context.
- `/leases`
  - `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
  - Lease workspace list with safe landlord-facing references.
- Lease summary/workflows
  - `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx`
  - `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `/maintenance`
  - `rentchain-frontend/src/pages/MaintenanceRequestsPage.tsx`
- Shell navigation
  - `rentchain-frontend/src/components/layout/LandlordNav.tsx`
  - `rentchain-frontend/src/components/layout/LandlordNav.css`

### Operations supporting components

- `rentchain-frontend/src/components/reviewWorkspaces/OperationalReviewQueue.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/OperationalReviewQueue.test.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/ReviewWorkspacePanel.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/ReviewAssignmentStatusControls.tsx`

## Current Data / Source-of-Truth Map

`OperationalCommandCenterPage` loads and derives data from:

- `fetchDecisionInbox()` -> `/api/landlord/decision-inbox`
  - Source of decision inbox items.
  - Includes severity, status, type, source, related entity, destination, workflow routing, automation preview, agent actions, and delinquency actions.
- `fetchDashboardSummary()`
  - Used for `dashboardData?.kpis?.delinquentCount`.
  - Creates dashboard duplication risk inside `/operations`.
- `getActiveLeasesForLandlord()`
  - Used to derive lease lifecycle, payment readiness, document, signature, renewal timing, and jurisdiction policy signals.
  - Gated behind lease capability entitlement.
- `fetchProperties({ status: "active" })`
  - Used to derive visible vacant-unit occupancy signals and resolve safe labels.
- `fetchOperatorReviewManualMetadata()`
  - Used to overlay manual review status and assignment labels on derived signals.
- `updateOperatorReviewManualMetadata()`
  - Used by manual controls in review queue and embedded review workspace panels.

Important current-state note:

- `rentchain-api/src/routes/landlordDecisionQueueRoutes.ts` and `rentchain-frontend/src/api/landlordDecisionQueueApi.ts` already exist.
- `/dashboard` consumes `/api/landlord/decision-queue`.
- `/operations` does not currently consume the landlord decision queue API directly; it derives its command-center model from decision inbox, leases, properties, dashboard summary, and operator-review metadata.

## Current User Experience Summary

Current `/operations` sections render in this order:

1. Hero/header with page purpose and Operational Inbox bridge.
2. Summary strip:
   - Signals
   - Critical
   - Warnings
   - Needs review
   - Upcoming
   - Open decisions
   - Delinquent
3. Coordination lanes:
   - Lease lifecycle
   - Payments / obligations
   - Occupancy
   - Screening
   - Documents / workspace
   - Operational review
4. Priority routing queue:
   - Search
   - Saved operational views
   - Priority filters
   - Workflow type
   - Review status
   - Assignment state
   - Escalation state
   - Timing / risk
5. Loading/error/empty states.
6. `OperationalReviewQueue`.
7. Priority group lists:
   - Critical
   - Needs review
   - Upcoming
   - Informational
8. For each signal in priority group lists:
   - Source workflow link
   - title/context/why/next action
   - workflow/review/financial/assignment/escalation metadata
   - embedded `ReviewWorkspacePanel`

The page is powerful but visually and conceptually heavy. It shows the same operational item through at least two surfaces: once in `OperationalReviewQueue`, and again in priority group lists with embedded review panels.

## Problems / Gaps

### P0 blockers

None identified in source audit. `/operations` is routed, authenticated, warm-neutral themed, tested, and has source-workspace links.

### P1 demo/product clarity gaps

- `/operations` does not yet read as the landlord's daily work board. It reads as an internal routing/triage console.
- The first screen prioritizes abstract concepts like "signals", "coordination lanes", "source workflow issues", and filter machinery before concrete "what do I do today?" groupings.
- The same work can appear in multiple conceptual forms:
  - summary strip counts
  - coordination lane counts
  - operational review queue item
  - priority group item
  - embedded review workspace panel
- The page has too many filters for a daily command center v1. Saved views plus priority filters plus five dropdown filters make sense for power users, but they dominate the page before the core work list.
- Maintenance, notices, tenant requests, and contractor follow-ups are not first-class daily-work groups yet. Some may be indirectly represented through decision inbox types or source workflow labels, but the user cannot scan them as explicit operational categories.
- Evidence/audit trail is represented through "evidence label", "source workflow evidence", and embedded review workspace panels, but it is not yet a clear top-level "evidence-ready" grouping.

### P2 implementation/data gaps

- `/operations` relies on client-side signal derivation for lease/property/dashboard-derived items. This is useful for a frontend simplification PR, but longer-term canonical operational work should move toward one backend-backed decision/action queue.
- Existing `/api/landlord/decision-queue` is used by `/dashboard`, but `/operations` uses `/api/landlord/decision-inbox`. This creates two related but separate queue concepts.
- Due date, blocked/waiting actor, quick-complete, and evidence-ready fields are not consistently available across all current sources.
- Manual review metadata supports review status and assignment, but not a complete acknowledge/resolve/dismiss lifecycle for all operational items.
- Maintenance/contractor/work-order workflow state is not yet strongly integrated into `/operations` as a first-class source.

### P3 polish / copy gaps

- "Coordination lanes" is accurate but less landlord-action-oriented than "Work by area" or "Source workspaces".
- "Priority routing queue" could become "Today's work" or "Open operational work".
- "Read-only coordination layer" is safety-accurate but may overemphasize limitations in the primary demo surface.
- "Informational" can be useful but should be de-emphasized by default.

## Duplications With Other Pages

### `/dashboard`

Current overlap:

- Dashboard already shows high-level decision queue preview, upcoming actions, calendar preview, workspace routing, portfolio health, and operating status.
- `/operations` repeats high-level counts and includes `dashboardData?.kpis?.delinquentCount`.

Recommended boundary:

- `/dashboard`: executive summary and high-level operating posture.
- `/operations`: daily execution board and source-workspace routing.

Keep on `/dashboard`:

- portfolio health
- KPI confidence/source quality
- decision queue preview
- upcoming actions preview
- calendar preview
- workspace routing

Move or emphasize on `/operations`:

- complete operational work list
- urgent/blocked/overdue/waiting groups
- source-workspace routing
- manual review controls
- evidence/audit indicators

### `/decision-inbox`

Current overlap:

- `/operations` consumes decision inbox items and renders manual review controls and review workspace panels.
- `/decision-inbox` already provides detailed decision filtering, automation/agent-action panels, and operator review session context.

Recommended boundary:

- `/operations`: daily work roll-up with concise next action and destination.
- `/decision-inbox`: normalized decision detail, policy-gated automation/agent context, evidence/review session depth.

### `/landlord/unified-inbox`

Current overlap:

- `/operations` includes an Operational Inbox bridge and points users to `/landlord/unified-inbox`.
- Unified Inbox is the message/action bridge and has safe source actions.

Recommended boundary:

- `/operations`: work execution board.
- `/landlord/unified-inbox`: message thread/action source.

### Record workspaces

Current overlap:

- `/operations` derives lease, property, payment, document, and occupancy signals from source records.

Recommended boundary:

- `/operations` should route into `/properties`, `/leases`, `/maintenance`, `/payments`, `/applications`, `/decision-inbox`, and `/landlord/unified-inbox`.
- It should not replace those workspaces or expose all record details inline.

## Proposed V1 Information Architecture

### Top section: Today's operational summary

Purpose:

- Quickly answer what needs landlord attention.

Suggested content:

- Urgent
- Overdue
- Blocked
- Waiting on tenant
- Waiting on landlord
- Waiting on contractor
- Evidence-ready

Current feasibility:

- Urgent: available via severity/priority group.
- Overdue: partially available only when due dates exist; not consistent across current `/operations` signals.
- Blocked: partially available via decision status, workflow status, lease execution/payment readiness.
- Waiting on tenant/landlord/contractor: partially inferable from workflow/source labels, but should not be overclaimed.
- Evidence-ready: partially represented through review workspace/evidence links.

V1 recommendation:

- Show only buckets that are safely supported.
- Use honest labels for partial/inferred buckets:
  - "Blocked or critical"
  - "Needs landlord review"
  - "Upcoming"
  - "Evidence/source attached"

### Main work sections

Recommended order:

1. Urgent and blocked
2. Waiting / needs review
3. Maintenance and repairs
4. Lease actions
5. Payments and arrears
6. Notices and compliance
7. Tenant/application requests
8. Contractor follow-ups
9. Evidence-ready items
10. Informational / monitoring

Current source mapping:

- Urgent and blocked: critical priority group, blocked status, critical severity, escalated state.
- Waiting / needs review: needs_review priority group, review-needed statuses, unassigned metadata.
- Maintenance and repairs: decision inbox type/queue can include maintenance, but current `/operations` category config does not include first-class maintenance.
- Lease actions: lease lifecycle, documents, renewal timing, jurisdiction policy, execution status.
- Payments and arrears: decision inbox billing/delinquency, payment readiness, dashboard delinquent count.
- Notices and compliance: jurisdiction policy signals and decision inbox compliance, but not a mature notice queue.
- Tenant/application requests: screening decisions and `/applications`; not currently grouped as applications/viewings.
- Contractor follow-ups: not currently first-class.
- Evidence-ready items: review workspace preview evidence links and source workflow destinations.
- Informational / monitoring: current informational priority group.

## Proposed Action Model

Each item should show:

- title
- severity
- status
- related property/unit/tenant/lease label when safe
- due date or age when available
- next action
- source
- link to underlying workspace
- evidence/audit indicator when available

V1 actions should remain route links and manual review metadata updates only:

- Open source workspace
- Open decision inbox detail/context
- Open operational inbox
- Open lease summary/ledger/workflow
- Open property context
- Open applications
- Update manual review status/assignment if already supported by `operatorReviewApi`

Do not add in v1:

- destructive actions
- automatic resolution
- tenant notices
- contractor dispatch
- payment actions
- source record mutation beyond existing manual review metadata

## What Should Remain On `/dashboard`

- Portfolio executive posture
- KPI confidence/source quality
- high-level decision preview
- upcoming/calendar preview
- broad workspace routing
- health/risk summary

## What Should Move From `/dashboard` Into `/operations`

Do not physically move code in the audit PR. For a future simplification PR, consider shifting emphasis:

- full decision queue list belongs in `/operations`
- daily work detail belongs in `/operations`
- upcoming operational actions can remain previewed on `/dashboard` but should link into `/operations`
- detailed manual review controls should not be duplicated on `/dashboard`

## What Should Be Deferred Until Decision Queue Integration/Hardening

- A single canonical operational work item source across `/dashboard`, `/operations`, and `/decision-inbox`.
- Full lifecycle fields for acknowledge/resolve/dismiss across all operational items.
- Complete due-date and waiting-actor fields.
- Consistent source references for maintenance, contractor, notice, payment, lease, and tenant-request items.
- Server-side priority/ranking consistency for all daily-work buckets.

Because the current repo already has `/api/landlord/decision-queue`, the follow-up should first decide whether `/operations` should consume that endpoint directly, extend it, or continue using `/decision-inbox` for detailed decision context.

## What Should Be Deferred Until Maintenance / Contractor Workflows Exist

- Contractor follow-up as a complete first-class bucket.
- Entry notice coordination.
- Contractor accept/decline lifecycle.
- Before/after photo and quote/invoice workflow.
- Tenant-notice evidence tied to maintenance access.
- Work-order completion/source evidence package.

## Risk Notes

- Backend/API risk: avoid changing backend in the first simplification PR unless the audit findings are explicitly upgraded to an implementation mission.
- Projection risk: avoid exposing raw IDs from decision, lease, property, tenant, maintenance, or provider references.
- Workflow risk: do not mutate source records from the command center.
- UX risk: over-grouping by inferred waiting actor could mislead landlords if the data source does not actually know who is blocking work.
- Demo risk: if too many empty buckets appear, `/operations` may feel less useful. The v1 implementation should hide unsupported/empty groups or label them as "No current items".

## Recommended Smallest Next Implementation PR

Branch:

`polish/operations-command-center-simplification-v1`

Objective:

Simplify the current frontend `/operations` hierarchy so it reads as the landlord daily command center while preserving all current data sources, route links, and manual review behavior.

Likely files:

- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.test.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/OperationalReviewQueue.tsx` only if section composition requires a small prop/copy adjustment.
- No backend files for v1 unless explicitly re-scoped.

Suggested implementation:

1. Rename/reframe the top hero copy around "today's operational work" instead of generalized operational visibility.
2. Replace the summary strip with action-oriented buckets:
   - Blocked or critical
   - Needs landlord review
   - Upcoming
   - Open decisions
   - Payment/arrears
   - Evidence/source attached
3. Collapse or demote "Coordination lanes" into a compact "Source workspaces" band.
4. Make the primary list the work board.
5. Avoid showing both `OperationalReviewQueue` and the full priority group lists with embedded `ReviewWorkspacePanel` by default. Choose one primary list and move the other behind a disclosure or remove the duplicate default surface.
6. Keep advanced filters available but demote them behind a "Filter work" disclosure on first load.
7. Preserve empty/loading/error states.
8. Preserve all source-workspace links.
9. Preserve manual review metadata controls.

Acceptance criteria for implementation:

- `/operations` first screen answers what needs attention today.
- Urgent/blocked/needs-review items are visible before advanced filtering.
- Source workspace routing remains intact.
- Operational Inbox and Decision Inbox bridges remain visible but not dominant.
- Advanced filters are still available.
- Manual review controls remain available.
- No backend/API/routing/auth/data behavior changes.
- No raw/internal/provider/storage IDs are visible.
- Desktop, reduced desktop, and mobile remain readable.
- No horizontal overflow.

## Suggested Tests

Update or add tests in `OperationalCommandCenterPage.test.tsx` for:

- route renders the simplified command-center heading/copy.
- urgent/blocked/needs-review bucket counts are visible.
- source workspace links still route to `/landlord/unified-inbox`, `/decision-inbox`, `/leases`, `/properties`, and payment ledger where fixture data supports it.
- advanced filters remain available.
- loading/error/empty states remain available.
- manual review metadata updates still call `updateOperatorReviewManualMetadata`.
- safe display labels do not fall back to raw-looking IDs.

Run existing adjacent tests:

- `npm run test -- OperationsPage`
- `npm run test -- OperationalCommandCenterPage`
- `npm run test -- DashboardPage`
- `npm run test -- DecisionInboxPage`

If exact test names differ, run the closest matching Vitest filters.

## Manual QA Checklist For Future Implementation

Desktop:

- `/operations` opens with a clear daily-work summary.
- urgent/blocked/needs-review items are visible without hunting through filters.
- source workspace links work.
- operational inbox and decision inbox links work.
- advanced filters can be opened/used/reset.
- manual review controls still work.
- no horizontal overflow.

Reduced desktop/mobile:

- top summary buckets wrap cleanly.
- primary work list remains readable.
- filters do not dominate the first screen.
- action links remain tappable.
- no horizontal overflow.

Regression routes:

- `/dashboard`
- `/decision-inbox`
- `/landlord/unified-inbox`
- `/properties`
- `/leases`
- `/maintenance`

## Explicit Non-Goals

- No simplified `/operations` UI in this audit PR.
- No backend/API changes.
- No auth changes.
- No data model changes.
- No billing/account/legal/theme work.
- No new operational behavior without approval.
- No source record mutation.
- No production or seed data changes.
- No removal of existing functionality.

## Merge / Defer Recommendation

Merge this audit/planning PR if docs validation and targeted frontend tests/build pass.

Proceed next to:

`polish/operations-command-center-simplification-v1`

Defer backend queue consolidation until after the frontend simplification is reviewed, unless implementation discovers that current data cannot honestly support the proposed daily-work buckets.
