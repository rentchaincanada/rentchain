# Dashboard 2.0 Wire IA V1

## Scope

This document defines the Dashboard 2.0 information architecture for the landlord operational home.

It assumes the normalized landlord decision queue will become the source for decision-oriented widgets after the read-only queue API is available. It does not require that API to be merged before this design is useful.

This is a design-only document. It does not implement UI, routes, API changes, backend services, CSS, or visual mockups.

## Product Intent

Dashboard 2.0 should answer five landlord questions in order:

1. Is my portfolio healthy?
2. What requires my attention today?
3. What decisions must I make?
4. What actions should I take next?
5. How is my business performing?

The dashboard should be an operational home, not a filing cabinet. It should summarize, prioritize, and route. Source workspaces should hold the detail.

## Global Hierarchy

Dashboard 2.0 should use this hierarchy:

1. Portfolio Status
2. Decision Queue
3. Upcoming Actions
4. Financial Snapshot
5. Portfolio Detail

This order is intentional. A landlord should see health first, urgent decisions second, planned work third, financial performance fourth, and entity-level detail last.

## Section 1: Portfolio Status

| Field | Definition |
| --- | --- |
| Purpose | Provide a calm top-level answer to whether the rental business is healthy. |
| Primary user question | "Is anything materially wrong right now?" |
| Data source | Portfolio summary data, normalized decision queue aggregates, lease/payment/maintenance/property summaries. |
| Decision queue dependency | Uses aggregate counts by severity and workspace, not full queue rows. |
| Action path | Critical count links to Operations filtered to critical; portfolio entities link to Properties, Tenants, Leases, or Maintenance. |
| Owning workspace | Dashboard owns the summary; Operations and domain workspaces own resolution. |
| Empty state | "No active portfolio records yet" with a setup path to add property/unit. |
| Degraded/loading state | Show last known stable portfolio counts only if freshness is explicit; otherwise show neutral loading without false warnings. |
| Mobile behavior | First card only: health label, critical count, next best action. Secondary stats stack below. |

Recommended content:

- Overall health label: Stable, Needs Attention, Critical Review.
- Critical issue count.
- Rent collection status.
- Occupancy signal.
- Maintenance signal.
- Lease/document readiness signal.

Avoid:

- Long explanations.
- Every warning.
- Red health labels for incomplete onboarding unless something is actually risky.

## Section 2: Decision Queue

| Field | Definition |
| --- | --- |
| Purpose | Show the highest priority landlord decisions requiring review or action. |
| Primary user question | "What do I need to decide or fix first?" |
| Data source | Normalized landlord decision queue. |
| Decision queue dependency | Primary dependency. Items must come from normalized source types and severity model. |
| Action path | Each item routes to `recommendedActionHref` in its owning workspace. "View all" routes to Operations. |
| Owning workspace | Operations owns the full queue. Dashboard owns a preview. |
| Empty state | "No open decisions" with a neutral explanation that informational activity remains in workspaces. |
| Degraded/loading state | If queue is unavailable, show "Decision queue unavailable" and do not synthesize critical items from stale local data. |
| Mobile behavior | Show at most three items: first critical, then warning, then needs-review/upcoming. Keep item copy one or two lines. |

Dashboard inclusion rules:

- Include all critical items up to a small cap.
- Include high-value warning and needs-review items with direct landlord action.
- Include time-sensitive upcoming items only when they are due soon.
- Exclude informational items.
- Exclude ordinary unread messages unless they are normalized as urgent or awaiting-response decisions.

Recommended display fields:

- Severity label.
- Title.
- Short description.
- Recommended action label.
- Workspace tag.
- Due date only when relevant.

Do not show:

- Raw internal IDs.
- Dedupe keys.
- Source debug metadata.
- Full message bodies.
- Legal/compliance claims.

## Section 3: Upcoming Actions

| Field | Definition |
| --- | --- |
| Purpose | Make planned operational work visible without turning it into warnings too early. |
| Primary user question | "What is coming up soon?" |
| Data source | Normalized decision queue items with `upcoming` severity, lease lifecycle/notice timing, maintenance schedule, renewal/move-out timing. |
| Decision queue dependency | Uses upcoming items and due dates from the normalized queue. |
| Action path | Routes to lease workflow pages, notice workflow, maintenance request, or tenant/lease profile. |
| Owning workspace | Operations owns full action list; domain workspaces own completion. |
| Empty state | "No upcoming actions in the selected window." |
| Degraded/loading state | Show date-window unavailable state; avoid converting missing calendar data into warnings. |
| Mobile behavior | Timeline-style list with next two or three actions and a link to Operations. |

Recommended content:

- Lease expiry and renewal review.
- Notice deadlines and response dates.
- Move-out preparation.
- Maintenance scheduling.
- Tenant move-in blockers only when time-sensitive.

Upcoming actions should become warnings only when a defined threshold is crossed, such as a missed date, response overdue, or workflow blocked.

## Section 4: Financial Snapshot

| Field | Definition |
| --- | --- |
| Purpose | Show whether the rental business is collecting and tracking money as expected. |
| Primary user question | "How is my rental income performing?" |
| Data source | Payment/ledger summaries, rent obligations, payment readiness, delinquency decisions. |
| Decision queue dependency | Uses payment-related queue items for overdue, failed, underpaid, and setup blockers. |
| Action path | Routes to Ledger, Payments, or lease payment readiness context. |
| Owning workspace | Payments/Ledger owns detail; Dashboard owns snapshot. |
| Empty state | "No rent collection data yet" with setup path if eligible. |
| Degraded/loading state | Show financial snapshot unavailable; do not display stale rent collected values without freshness. |
| Mobile behavior | One primary number plus two supporting stats; detailed breakdown collapses. |

Recommended content:

- Rent expected this period.
- Rent collected.
- Overdue/failed/underpaid count.
- Payment setup readiness when it blocks collection.

Avoid:

- Dense ledger tables.
- Payment processor internals.
- Overdue warnings when rent terms are simply not configured unless the landlord is actively using rent collection.

## Section 5: Portfolio Detail

| Field | Definition |
| --- | --- |
| Purpose | Provide a compact map of the landlord's properties, units, leases, tenants, and maintenance state. |
| Primary user question | "Where do I go for the details?" |
| Data source | Properties, units, tenants, leases, maintenance summaries, occupancy projections. |
| Decision queue dependency | Uses queue counts by workspace to annotate detail rows, not to replace workspace detail. |
| Action path | Routes to Properties, Tenants, Leases, Maintenance, Ledger, or Trust/Compliance as applicable. |
| Owning workspace | Domain workspaces own detail and edits. |
| Empty state | "Add your first property" or "No active records in this area." |
| Degraded/loading state | Show affected domain unavailable, not whole dashboard failure if one domain is down. |
| Mobile behavior | Collapsible sections; show counts first, detail links second. |

Recommended content:

- Property/unit occupancy summary.
- Active lease count.
- Tenant move-in/readiness status count.
- Open maintenance count.
- Evidence/export/trust status only when material.

Portfolio Detail should not become the full property table, tenant table, maintenance list, or lease list.

## Dashboard Versus Operations Boundary

Dashboard owns:

- Health summary.
- Top few decisions.
- Today's or soonest actions.
- Financial pulse.
- Entity navigation.

Operations owns:

- Full normalized queue.
- Filters by severity, workspace, due date, source type, and status.
- Dense triage.
- Cross-domain review.
- Saved views and operational lanes.

Dashboard must avoid becoming a duplicate Operations page. It should answer "what matters now?" and route to Operations for "show me everything."

## Decision Inclusion Rules

Show on Dashboard:

- Critical items.
- Warnings with immediate landlord action.
- Needs-review items that block signing, rent collection, move-in, maintenance, notices, or tenant response.
- Upcoming items inside the selected action window.
- Message-derived decisions only when urgent, awaiting landlord response, notice relevant, maintenance blocking, or support escalation.

Keep Operations-only:

- Informational items.
- Resolved/dismissed items.
- Ordinary unread messages.
- Low-priority readiness checks.
- Long guidance text.
- Duplicate source-specific readiness panels.
- Debug/source-generator data.

## Messaging-Derived Decisions

Messaging should appear on Dashboard only as decision-quality signals:

- Urgent tenant message.
- Tenant awaiting landlord reply.
- Maintenance message requiring landlord response.
- Contractor quote or schedule issue.
- Notice-relevant message.
- Support escalation requiring landlord action.

Dashboard should not show:

- Full inbox.
- Ordinary unread count as a warning.
- Message body previews beyond safe short summaries.
- Contractor chatter.
- System notifications with no action.

## Domain Signal Placement

| Signal family | Dashboard treatment | Operations treatment | Owning workspace |
| --- | --- | --- | --- |
| Lease execution/signing | Top warning only if blocking or inconsistent. | Full queue item with route to lease workspace. | Leases |
| Tenant move-in readiness | Summary count or top blocker only. | Tenant-scoped needs-review item. | Tenants |
| Payment delinquency | Critical/warning preview. | Payment queue lane. | Payments/Ledger |
| Payment setup readiness | Show only when it blocks collection. | Needs-review item. | Payments or Leases |
| Maintenance submitted/blocked | Show urgent count/top item. | Maintenance lane. | Maintenance |
| Property action requests | Show only material unresolved count. | Property lane. | Properties |
| Notices/lease expiry | Upcoming or warning based on timing. | Notice/lease lifecycle lane. | Notices or Leases |
| Evidence/compliance | Show only material export/evidence/trust posture issues. | Evidence/compliance lane when implemented. | Trust/Compliance |
| Messaging | Urgent/awaiting response only. | Communication-filtered queue. | Messaging or owning source workspace |

## Calm Hierarchy Rules

Dashboard 2.0 should preserve peace of mind by:

- Using red only for critical or materially overdue items.
- Treating missing setup separately from operational failure.
- Showing counts and routes before long explanations.
- Grouping related warnings under one item.
- Keeping compliance/readiness language operational, not legal.
- Avoiding duplicate labels across Dashboard, Operations, Leases, and Tenants.

## Filing Cabinet Prevention

Do not place these on the dashboard:

- Full tenant list.
- Full lease list.
- Full maintenance list.
- Full inbox.
- Full document library.
- Full audit trail.
- Full compliance center.
- Full ledger.

Instead, show summary counts, health, top blockers, and routes into owned workspaces.

## Sticky Workspace Shell Support

Dashboard 2.0 should be compatible with a future sticky workspace shell:

- Sticky global title: "Dashboard" or "Operational Home".
- Sticky workspace navigation: Dashboard, Operations, Properties, Tenants, Leases, Maintenance, Payments, Trust.
- Breadcrumbs for drill-down pages, not dashboard cards.
- Mobile sticky bottom or top navigation should prioritize Dashboard, Operations, Properties/Tenants, and Messages.

Dashboard content should not rely on page-level context that disappears when the title bar is sticky.

## Implementation Sequence Recommendation

1. Use the merged read-only decision queue API as the decision-oriented source.
2. Add a Dashboard 2.0 adapter contract that consumes queue summaries without changing visual layout.
3. Replace dashboard decision/action panels with queue-driven preview widgets.
4. Add Operations full-queue consumption.
5. Add financial snapshot and upcoming actions refinements.
6. Add sticky workspace shell/navigation improvements.
7. Apply visual polish only after IA behavior is stable.

## Non-Goals

- No visual mockups.
- No component implementation.
- No CSS.
- No route changes.
- No API changes.
- No backend changes.
- No dashboard build.
