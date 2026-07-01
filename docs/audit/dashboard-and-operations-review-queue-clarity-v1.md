# Dashboard And Operations Review Queue Clarity Audit v1

Branch: `audit/dashboard-and-operations-review-queue-clarity-v1`
Scope: audit and documentation only; no implementation, payment signal derivation changes, ledger changes, manual review persistence changes, CSV/PDF export, dashboard redesign, Operations redesign, or workflow automation.

## Purpose

Recent QA confirmed two important RC1 foundations:

- PR #1262 made payment decision signals materially trustworthy by aligning Dashboard/Operations payment decisions with ledger evidence.
- PR #1263 made Operations manual review status and assignment metadata persist across refresh, filters, and source workflow navigation.

This audit reviews the next usability layer: Dashboard Decision Queue Preview and Operations Review Queue clarity, scannability, routing language, and demo readiness.

## Enterprise Validation Filter

This mission advances:

- Revenue: clearer payment, application, vacancy, and revenue-pressure decisions support one-building pilot confidence.
- Operational efficiency: operators can triage fewer, clearer cards instead of parsing dense metadata.
- Enterprise readiness: Dashboard and Operations should communicate the same decision concepts with different levels of detail.
- Customer validation: RC1 demo surfaces should explain why an item matters and where it will open.

## Files Reviewed

Frontend:

- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/DashboardPage.test.tsx`
- `rentchain-frontend/src/api/landlordDecisionQueueApi.ts`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.test.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/OperationalReviewQueue.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/OperationalReviewQueue.test.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/ReviewWorkspacePanel.tsx`

Backend:

- `rentchain-api/src/routes/landlordDecisionQueueRoutes.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueService.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueTypes.ts`
- `rentchain-api/src/lib/analytics/deriveAgentDecisions.ts`
- `rentchain-api/src/services/unifiedInbox/landlordInboxAdapters.ts`

Related docs:

- `docs/audit/decision-queue-source-of-truth-v1.md`
- `docs/audit/lease-ledger-payment-signal-consistency-v1.md`

## Current Dashboard Decision Queue Preview

Dashboard consumes:

```text
DashboardPage
  -> fetchLandlordDecisionQueue({ status: "open_state", limit: 6 })
  -> GET /api/landlord/decision-queue
```

The preview renders at most four rows:

```text
title
workspace label + due date
severity
Open
```

Current row behavior is intentionally sparse. `DecisionRow` does not render:

- description
- recommended action label
- safe related resource label
- property/building
- unit
- tenant
- amount or payment period
- reason for alert
- destination explanation

For undated items, `formatDate(null)` returns `No due date`. That is technically accurate for some queue records, but it reads like missing data instead of a deliberate state.

## Observed Dashboard Labels And Destinations

The observed labels are not hardcoded in Dashboard. They come from decision/analytics/unified-inbox adapters and are normalized into the decision queue.

| Dashboard label | Source area | Observed destination | Audit finding |
| --- | --- | --- | --- |
| `Review submitted applications` | `deriveAgentDecisions.ts`, `improve_application_conversion` | `/applications` with application funnel context where scoped | Destination is plausible, but card should say it opens submitted applications/application funnel review. |
| `View vacancy readiness` | `deriveAgentDecisions.ts`, vacancy readiness fallback | `/analytics?entry=vacancy-readiness` | Destination is plausible, but title sounds like a passive view, not a decision. |
| `Review revenue pressure` | `deriveAgentDecisions.ts`, revenue pressure | `/analytics?entry=revenue-pressure` | Destination is plausible, but Dashboard should clarify what pressure means and whether it is portfolio or property scoped. |
| `Lease action available` | `adaptLandlordLeaseInboxToInboxEvent(...)` fallback title | `/messages` in observed QA | This is too generic. If the item routes to Messages, the title should indicate communication/lease message context. |
| Payment decisions | decision inbox payment path | `/leases/:leaseId/ledger` | Correct destination after PR #1262, but Dashboard cards need safe amount/due/context projection. |

The route destinations can be valid while still being unclear. The follow-up should not assume every route is wrong; it should improve card copy, context, and destination labels.

## Current Operations Review Queue

Operations consumes multiple sources:

```text
OperationalCommandCenterPage
  -> fetchDecisionInbox()
  -> fetchDashboardSummary()
  -> fetchProperties({ status: "active" })
  -> fetchOperatorReviewManualMetadata()
  -> getActiveLeasesForLandlord()
  -> deriveCommandCenterSignals(...)
  -> applyManualReviewMetadata(...)
  -> deriveOperationalReviewQueueItems(...)
```

The Operations card currently renders, by default:

- priority
- workspace type
- title
- context label
- routing reason
- source
- review status
- assignment
- workflow status
- financial status
- sensitivity
- visibility
- manual review controls
- scoped evidence/resource links

The inline `ReviewWorkspacePanel` also renders a dense metadata block:

- workspace type
- review status
- priority
- routing reason
- assignment
- sensitivity
- visibility
- manual controls
- evidence links
- related resources

This is governance-rich, but it is not scan-friendly when many reviewable items exist.

## Dashboard And Operations Consistency

Dashboard and Operations currently show the same general decision concepts, but at different stages of normalization:

- Dashboard consumes the normalized landlord decision queue.
- Operations uses decision inbox, active lease projections, property projections, and manual metadata to build richer command-center signals.
- Operations therefore often has better safe context labels than Dashboard, because it resolves lease/property context locally.

This creates a clarity gap:

- Dashboard shows a thin preview and may feel vague.
- Operations shows too much metadata at once and can feel overloaded.

The intended product model should be:

```text
Dashboard = top attention summary
Operations = full triage queue
Expanded Operations detail = governance/audit context
Source workflow = record-specific action surface
```

## Upcoming Actions

Dashboard Upcoming Actions uses:

```ts
(queue.items || [])
  .filter((item) => item.dueAt || item.severity === "upcoming")
  .slice(0, 4)
```

This means Upcoming Actions can be empty even when Operations has many reviewable items. That is acceptable if Upcoming Actions is defined as dated or upcoming work only.

However, the empty state should make that distinction explicit. It should not imply there is no operational work when the Decision Queue Preview or Operations queue has review items.

Recommended interpretation:

- Decision Queue Preview: highest-priority review/decision items, dated or undated.
- Upcoming Actions: dated or upcoming items only.
- Operations: full triage queue.

## Recommended Card Hierarchy

### Dashboard Summary Card

Purpose: quick executive/operator attention.

Default visible fields:

- title rewritten as action + object
- safe context line, such as property/unit/tenant when available
- due/deadline line only when meaningful
- reason/action line
- severity
- destination label, such as `Open ledger`, `Open applications`, `Open vacancy readiness`

Hide by default:

- source type
- raw workspace name when destination label is clearer
- dedupe/source IDs
- workflow state
- manual assignment
- sensitivity/visibility
- internal routing reason

Suggested no-date language:

- Use `Action needed` for undated open decisions.
- Use `No deadline` only when a missing deadline is itself meaningful.
- Omit the date line for informational/analytics items if a date would not help.

### Operations Compact Card

Purpose: fast scanning and prioritization.

Default visible fields:

- priority/severity
- concise title
- safe context label
- source category or owning workspace
- manual status
- assigned reviewer
- primary next action or destination label
- one reason sentence

Hide behind details:

- routing reason
- source system
- workflow status
- financial status
- sensitivity
- visibility
- evidence/resource link list
- manual-only governance copy
- technical source labels

Manual controls should be available, but not dominate every card. A compact default could show status/assignee and expose controls through `Manage review`, expansion, or a details drawer.

### Expanded Detail State

Purpose: governance, audit, and evidence review.

Visible in expanded state:

- routing reason
- source
- workflow status
- financial status
- sensitivity
- visibility
- manual-only notice
- evidence/resource links
- related resource labels
- manual status and assignment controls

Expanded details are the correct place for governance-heavy metadata.

## Decision Types By Surface

Recommended display split:

| Decision type | Dashboard | Operations |
| --- | --- | --- |
| Critical payment, ledger, failed/overdue evidence | Yes, top preview if high priority | Yes, full queue |
| Submitted applications needing review | Yes, if high priority or blocking vacancy/revenue | Yes |
| Vacancy readiness and revenue pressure analytics | Yes only when top portfolio attention items | Yes if actionable and scoped |
| Lease lifecycle/renewal/notice timing | Yes if upcoming or near-term | Yes |
| Generic lease message/activity | Only if actionable/urgent | Yes if promoted from message signal |
| Informational context | Usually no | Yes only under informational filters |
| Internal/manual review governance metadata | No | Hidden by default, shown in detail |

## Routing Findings

The observed destinations are mostly plausible:

- `/applications` for submitted application review.
- `/analytics?entry=vacancy-readiness` for vacancy readiness.
- `/analytics?entry=revenue-pressure` for revenue pressure.
- `/leases/:leaseId/ledger` for payment decisions.
- `/operations` for the full queue.

The unclear case is `Lease action available` routing to `/messages`. That may be valid if the source is a lease-related message, but the title should not imply a generic lease workflow. It should identify the message/communication nature when projection-safe.

## Recommended Follow-Up Mission

```text
fix/dashboard-and-operations-review-queue-clarity-v1
```

Recommended scope: frontend-first clarity work with a small backend projection adapter only if needed for safe labels/context.

### Recommended Implementation Scope

1. Dashboard Decision Queue Preview:
   - render a clearer compact card for top 3-4 items
   - show safe context when available
   - show reason/action copy
   - replace generic `No due date` with `Action needed`, `No deadline`, or omit the line depending on item type
   - use destination labels such as `Open ledger`, `Open applications`, `Open analytics`, `Open messages`

2. Operations Review Queue:
   - introduce compact default card layout
   - move advanced metadata behind expansion/details
   - keep manual status/reviewer visible but reduce control weight until the operator chooses to manage the review
   - preserve persisted manual metadata from PR #1263

3. Expanded details:
   - preserve routing reason, source, workflow status, financial status, sensitivity, visibility, evidence links, related resources, and manual-only governance copy
   - ensure no internal review key or raw ID is visible

4. Upcoming Actions:
   - keep it sourced from dated/upcoming operational work only
   - improve empty-state copy so it does not conflict with open review items

5. Tests:
   - Dashboard card renders context/action/destination copy
   - Dashboard undated item does not render confusing `No due date`
   - Operations compact card hides advanced metadata by default
   - Operations detail expansion shows metadata and evidence links
   - manual review status/reviewer still persist and render
   - no raw IDs/internal keys are visible

### Acceptance Criteria

- Dashboard shows the top 3-4 highest-priority decisions with clear action, context, and destination labels.
- Dashboard cards show property/unit/tenant/payment context when projection-safe.
- Undated items do not default to confusing `No due date` copy.
- `Open` destinations remain correct for applications, analytics, messages, operations, and lease ledgers.
- Operations cards are scannable by default.
- Advanced metadata is available through details, expansion, or drawer, not all visible by default.
- Manual review status and assignment remain visible and persist after refresh.
- Source workflow links remain available.
- Upcoming Actions only shows dated/upcoming work, and its empty state explains that other review items may still exist in Decision Queue/Operations.
- No payment signal derivation, ledger logic, manual metadata persistence, workflow automation, CSV/PDF export, or broad Dashboard/Operations redesign is introduced.

## Non-Goals For Follow-Up

Keep these separate:

- payment signal derivation
- ledger calculation
- Operations manual review persistence
- CSV/PDF export
- broad dashboard redesign
- broad Operations redesign
- workflow automation
- new queue persistence model

## Recommended Priority

Priority: high for RC1 demo readiness.

Rationale: the underlying signals and manual metadata now work. The next credibility risk is whether the Dashboard and Operations queue communicate those decisions clearly enough for a one-building pilot and enterprise validation demo.
