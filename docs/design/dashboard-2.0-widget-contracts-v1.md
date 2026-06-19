# Dashboard 2.0 Widget Contracts V1

## Scope

This document defines stable information contracts for Dashboard 2.0 widgets.

It is a design-only contract. It does not add TypeScript types, API routes, UI components, CSS, backend services, or runtime behavior.

The contracts assume the merged read-only normalized landlord decision queue API and existing domain summaries. They are written to help Dashboard 2.0 implementation avoid drifting into a filing cabinet or duplicate Operations page.

## Shared Contract Principles

All dashboard widgets should follow these rules:

1. Summarize first, route second, never replace the source workspace.
2. Use normalized decision queue items for decision-oriented content.
3. Never expose raw IDs, storage paths, provider payloads, tokens, or private message bodies.
4. Distinguish no data, loading, degraded, and healthy states.
5. Avoid red unless severity is `critical` or a material deadline is missed.
6. Keep mobile content shorter than desktop content.
7. Prefer one clear primary action per widget.

## Normalized Decision Queue Assumptions

Dashboard decision widgets should consume queue items with fields equivalent to:

```ts
type DashboardDecisionQueueItem = {
  id: string;
  landlordId: string;
  sourceType: string;
  sourceId: string;
  workspace:
    | "dashboard"
    | "operations"
    | "tenant"
    | "lease"
    | "property"
    | "maintenance"
    | "payments"
    | "notices"
    | "evidence_compliance";
  severity: "critical" | "warning" | "needs_review" | "upcoming" | "informational";
  title: string;
  description: string;
  recommendedActionLabel: string;
  recommendedActionHref: string;
  dueAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status: "open" | "pending" | "blocked" | "resolved" | "dismissed";
  dedupeKey: string;
  sortKey: string;
  priorityRank: number;
  relatedEntityRefs?: {
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
    leaseId?: string;
    maintenanceRequestId?: string;
    noticeId?: string;
  };
};
```

Dashboard should display only safe labels and route labels derived from this model. It should not display `sourceId`, `dedupeKey`, or raw related IDs as user-facing text.

## Widget: Portfolio Status

| Field | Contract |
| --- | --- |
| Purpose | High-level business health. |
| Primary question | "Is my portfolio healthy?" |
| Inputs | Portfolio counts, occupancy summary, rent/payment summary, maintenance summary, decision severity counts. |
| Decision queue dependency | Severity aggregate counts and top critical presence. |
| Output | Health label, critical count, occupancy status, rent status, maintenance status, lease/document readiness status. |
| Primary action | Open Operations filtered to critical or needs-attention items. |
| Empty state | Setup prompt for first property/unit. |
| Degraded state | Show unavailable metric labels per source; do not create synthetic warnings. |
| Mobile | One health card, one primary action, two supporting facts. |

Recommended display fields:

- `overallStatus`: stable, needs_attention, critical_review.
- `criticalCount`.
- `warningCount`.
- `occupancySummary`.
- `rentCollectionSummary`.
- `maintenanceSummary`.
- `leaseReadinessSummary`.

## Widget: Decision Queue Preview

| Field | Contract |
| --- | --- |
| Purpose | Show top actionable decisions. |
| Primary question | "What do I need to handle first?" |
| Inputs | Normalized decision queue items. |
| Decision queue dependency | Primary source. |
| Output | Top critical/warning/needs-review items. |
| Primary action | Item action opens `recommendedActionHref`; secondary action opens Operations. |
| Empty state | "No open decisions." |
| Degraded state | "Decision queue unavailable" without stale red state. |
| Mobile | Top three items max. |

Dashboard filters:

- Include `status` open, pending, or blocked.
- Exclude resolved and dismissed.
- Include severity critical, warning, needs_review, and near-term upcoming.
- Exclude informational by default.
- Limit to 3 to 5 items.

Message-derived source types allowed:

- `message_thread`
- `message_unread_priority`
- `message_notice_relevance`
- `message_maintenance_follow_up`
- `message_support_escalation`
- `unified_inbox_event` only when action-required.

## Widget: Upcoming Actions

| Field | Contract |
| --- | --- |
| Purpose | Preview time-bound work. |
| Primary question | "What is coming up?" |
| Inputs | Queue items with `upcoming` severity, due dates, lease lifecycle, notice timing, maintenance scheduling. |
| Decision queue dependency | Upcoming queue items and due date ordering. |
| Output | Date-ordered upcoming action rows. |
| Primary action | Route to owning lease, notice, tenant, or maintenance workspace. |
| Empty state | "No upcoming actions in this window." |
| Degraded state | Show schedule unavailable without warnings. |
| Mobile | Timeline list, max three rows. |

Upcoming rows should include:

- Title.
- Due date or timeframe.
- Workspace label.
- Short action label.

Rows should not include long legal, notice, or lease guidance.

## Widget: Financial Snapshot

| Field | Contract |
| --- | --- |
| Purpose | Show rent collection and payment health. |
| Primary question | "How is my business performing financially?" |
| Inputs | Rent obligations, ledger/payment summary, payment readiness, delinquency decision items. |
| Decision queue dependency | Payment critical/warning/needs-review items. |
| Output | Rent expected, rent collected, overdue/failed/underpaid count, setup blockers. |
| Primary action | Open Ledger or Payments workspace. |
| Empty state | "No rent collection data yet." |
| Degraded state | Show snapshot unavailable; do not show stale financial totals without freshness. |
| Mobile | Primary total plus compact status row. |

Decision item source families:

- Payment delinquency.
- Failed payment.
- Underpaid payment.
- Payment setup readiness.
- Missing rent terms only when it blocks collection.

## Widget: Portfolio Detail

| Field | Contract |
| --- | --- |
| Purpose | Provide a compact route map to domain workspaces. |
| Primary question | "Where should I go for details?" |
| Inputs | Property, unit, tenant, lease, maintenance, document, and trust/compliance summary counts. |
| Decision queue dependency | Workspace-level open decision counts. |
| Output | Domain cards or rows with safe counts and action routes. |
| Primary action | Open the relevant workspace. |
| Empty state | Domain-specific setup prompt. |
| Degraded state | Domain unavailable row; other domains remain usable. |
| Mobile | Collapsible domain list. |

Portfolio Detail rows should include:

- Domain label.
- Healthy/needs attention status.
- Count or short summary.
- Workspace route.

They should not include full lists of tenants, leases, messages, maintenance requests, documents, or audit events.

## Widget: Messaging Signal Preview

Messaging should usually be represented inside Decision Queue Preview, but a compact signal may be shown when communication volume is operationally important.

| Field | Contract |
| --- | --- |
| Purpose | Show actionable communication state without becoming an inbox. |
| Primary question | "Is someone waiting on me?" |
| Inputs | Message-derived queue items and safe unified inbox aggregates. |
| Decision queue dependency | Only action-required message items. |
| Output | Awaiting reply count, urgent message count, one top communication decision. |
| Primary action | Open Messaging, Operations filtered to communication, or the owning workspace. |
| Empty state | "No messages need action." |
| Degraded state | "Messaging status unavailable." |
| Mobile | Count and one action route only. |

Do not show:

- Full message list.
- Ordinary unread count as a warning.
- Raw message content.
- Contractor chatter.
- Notice excerpts.

## Widget State Contract

Each widget should support:

```ts
type WidgetState = {
  status: "ready" | "empty" | "loading" | "degraded" | "error";
  generatedAt?: string;
  dataFreshness?: "fresh" | "stale" | "unknown";
  message?: string;
};
```

Rules:

- Loading should not reserve large empty regions on mobile.
- Degraded should identify the affected source only.
- Error should route to a safe retry or workspace, not display raw API errors.
- Stale data must be labelled if shown.

## Dashboard Queue Query Recommendations

Dashboard 2.0 can use a queue request equivalent to:

```txt
GET /api/landlord/decision-queue?status=open&limit=10
```

Optional dashboard-oriented filters:

- `severity=critical`
- `severity=warning`
- `severity=needs_review`
- `severity=upcoming`
- `workspace=lease`
- `workspace=tenant`
- `workspace=payments`
- `workspace=maintenance`
- `workspace=property`
- `workspace=notices`
- `workspace=evidence_compliance`
- `limit=5` for preview widgets.

The merged queue API accepts one severity and one workspace filter value per request. Dashboard implementations that need a mixed preview should either request an unfiltered open queue with a small limit and apply display rules client-side, or issue separate focused requests where that is justified.

Dashboard should not require a new route if the queue API can provide stable sorting and filtering. A later summary endpoint can be considered only if performance or layout needs justify it.

## Safety Contract

Widgets must not display:

- Raw Firestore IDs as labels.
- Raw provider request IDs.
- Storage paths or signed URL internals.
- Payment processor IDs.
- Full message bodies.
- Screening report payloads.
- Private notes.
- Audit debug payloads.
- Legal approval or enforceability claims.

Widgets may display:

- Safe role labels.
- Safe property/unit/tenant labels.
- Count summaries.
- Readiness labels.
- Bounded message/action summaries already safe for landlord projection.

## Mobile Contract

Mobile ordering:

1. Portfolio health.
2. Critical decision preview.
3. Today/upcoming.
4. Financial pulse.
5. Portfolio detail links.

Mobile limits:

- Three decision items max.
- Three upcoming items max.
- One primary action per card.
- Avoid side-by-side dense metrics.
- Avoid hidden-only critical information.

## Non-Goals

- No UI implementation.
- No API implementation.
- No backend normalization changes.
- No chart specification.
- No visual styling.
- No component props committed to code.
