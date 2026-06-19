# Dashboard 2.0 To Operations Boundaries V1

## Scope

This document defines the boundary between Dashboard 2.0 and Operations.

It is a design-only document. It does not implement dashboard UI, Operations UI, routing, backend APIs, CSS, or navigation shell changes.

## Boundary Summary

Dashboard is the operational home.

Operations is the operational triage workspace.

Dashboard should answer:

- Is my portfolio healthy?
- What matters today?
- What requires a decision?
- What is coming up?
- How is the business performing?

Operations should answer:

- Show me every open decision.
- Filter by severity, workspace, due date, and source.
- Let me triage cross-domain work.
- Help me route into the correct workspace.

## Dashboard Responsibilities

Dashboard owns:

- Portfolio health summary.
- Top critical and warning decisions.
- Upcoming action preview.
- Financial pulse.
- Portfolio detail routing.
- Calm empty states and activation guidance.

Dashboard does not own:

- Full queue filtering.
- Detailed workflow review.
- Full inbox.
- Full ledger.
- Full audit trail.
- Full maintenance workbench.
- Full compliance/trust center.

## Operations Responsibilities

Operations owns:

- Full normalized decision queue.
- Filters by severity, workspace, status, source type, due date, and related domain.
- Saved operational views, if later implemented.
- Dense triage and cross-domain scanning.
- Routing to source workspaces.

Operations does not own:

- Source-specific edit forms.
- Legal guidance pages.
- Full tenant portal views.
- Full document viewers.
- Full evidence exports.

## Dashboard Inclusion Rules

Dashboard should show a decision when at least one is true:

- Severity is critical.
- It is a warning with direct landlord action.
- It blocks signing, rent collection, move-in, maintenance, notice, payment, or tenant response.
- It is upcoming and inside the defined action window.
- It is a message-derived item requiring landlord response or escalation.

Dashboard should not show a decision when:

- It is informational.
- It is resolved or dismissed.
- It is an ordinary unread message.
- It is a low-urgency readiness detail better handled in a source workspace.
- It is duplicate context already represented by a higher severity item.
- It lacks a safe action destination.

## Operations-Only Items

These should usually stay out of Dashboard and live in Operations or a source workspace:

- Informational queue items.
- Full needs-review backlog.
- Low-priority setup/readiness details.
- Ordinary unread messages.
- Full maintenance request list.
- Full property action request list.
- Evidence/export activity history.
- Trust/compliance audit trails.
- Debug/source generator items.
- Resolved, dismissed, or historical decisions.

## Severity Boundary

| Severity | Dashboard treatment | Operations treatment |
| --- | --- | --- |
| critical | Always show until cap is reached. | Full item with filters and route. |
| warning | Show if action-required or materially time-sensitive. | Full item. |
| needs_review | Show only if blocking or among top few decisions. | Full item. |
| upcoming | Show in Upcoming Actions window. | Full item in upcoming/date views. |
| informational | Hide by default. | Available only if Operations later supports informational filters. |

Dashboard should avoid overusing red. Red is for critical state, material overdue state, or real operational failure. Missing setup, draft readiness, and early upcoming work should use calmer treatment.

## Workspace Routing Boundary

| Workspace | Dashboard role | Operations role | Source workspace role |
| --- | --- | --- | --- |
| Leases | Show blocking lease execution/readiness items. | Filter and prioritize lease decisions. | Resolve signing, documents, Form P readiness, delivery readiness. |
| Tenants | Show move-in or tenant-response blockers only. | Filter and prioritize tenant decisions. | Resolve tenant lifecycle, current lease, portal, move-in state. |
| Payments | Show financial pulse and payment criticals. | Triage delinquency/setup/payment review. | Resolve ledger and payment setup. |
| Maintenance | Show urgent maintenance count/top item. | Triage submitted, blocked, cost-review, contractor-response work. | Resolve request/work order details. |
| Properties | Show property/unit health and material action requests. | Triage property action requests. | Resolve property/unit readiness and occupancy context. |
| Notices | Show imminent or overdue notice deadlines. | Triage notice/response/deadline work. | Resolve notice workflow. |
| Messaging | Show urgent/awaiting-response communication only. | Triage communication decisions. | Read and reply to threads. |
| Evidence/Compliance | Show material trust/evidence blocker only. | Triage if queue-supported. | Resolve in Trust/Compliance or evidence workspace. |

## Messaging Boundary

Dashboard should treat messaging as an operational signal, not an inbox.

Dashboard may show:

- Urgent message count.
- Tenant awaiting reply count.
- One top urgent communication decision.
- Support escalation requiring landlord action.

Dashboard should not show:

- Full thread list.
- Message bodies.
- Ordinary unread count as a warning.
- Contractor chatter.
- Notice/legal excerpts.

Operations should show message-derived decisions when they are normalized as:

- `message_thread`
- `message_unread_priority`
- `message_notice_relevance`
- `message_maintenance_follow_up`
- `message_support_escalation`
- `unified_inbox_event`

The Messaging workspace should own reading, replying, resolving, and thread history.

## Lease, Tenant, Payment, Maintenance, And Property Boundaries

### Lease Issues

Dashboard:

- Show only blocking execution/readiness, active conflict, signing failure, or imminent lifecycle issue.

Operations:

- Show all open lease decisions and warnings.

Leases:

- Own document generation, signing state, Form P readiness, delivery readiness, workflow pages, and lease summary.

### Tenant Issues

Dashboard:

- Show move-in blockers and tenant response blockers only when timely or high value.

Operations:

- Show tenant lifecycle and state-coherence items.

Tenants:

- Own tenant profile, current lease linkage, unit relationship, portal readiness, and move-in readiness.

### Payment Issues

Dashboard:

- Show financial snapshot, overdue/failed count, and top delinquency item.

Operations:

- Show full payment readiness/delinquency queue.

Payments/Ledger:

- Own ledger, payment evidence, setup, failed/underpaid/manual review actions.

### Maintenance Issues

Dashboard:

- Show urgent, blocked, or unreviewed maintenance counts and top item.

Operations:

- Show full maintenance triage lane.

Maintenance:

- Own request detail, assignment, contractor communication, cost approval, completion.

### Property Issues

Dashboard:

- Show material property/unit readiness or occupancy conflicts.

Operations:

- Show property action requests and property-owned needs-review items.

Properties:

- Own property/unit records, occupancy source context, and action requests.

## Preventing Dashboard From Becoming A Filing Cabinet

Dashboard must not absorb source-workspace tables. Use these rules:

1. If a user needs filters, it belongs in Operations or a source workspace.
2. If a user needs to edit, approve, sign, assign, or send, route to the source workspace.
3. If content has more than five rows, summarize it and link out.
4. If content is history, show only recent signal or route to the owning history/audit surface.
5. If content is a document, show status and a safe action, not the document library.
6. If content is a message thread, route to Messaging or the source workspace.

## Peace Of Mind Hierarchy

Dashboard should feel calm by default:

- Healthy status should be visible when nothing is urgent.
- Critical items should be rare and specific.
- Warnings should be grouped by user action, not source generator.
- Upcoming items should not look like failures.
- Empty states should explain absence of data without implying broken setup.
- Legal/compliance readiness should be operational, not alarmist.

## Sticky Workspace Navigation Implications

Future sticky navigation should support this model:

- Dashboard remains the default landing page.
- Operations is adjacent and clearly labelled as the full queue.
- Workspace tabs remain stable across Dashboard, Operations, Properties, Tenants, Leases, Maintenance, Payments, Messaging, and Trust.
- Breadcrumbs appear only after drilling into a specific tenant, lease, property, request, or document.
- Mobile navigation should expose Dashboard and Operations without hiding the primary action.

Dashboard cards should use stable action paths so sticky navigation can preserve context after the user routes into a workspace.

## Dashboard To Operations Handoff

Each dashboard decision item should support:

- A direct source workspace action.
- A secondary "View in Operations" action or context when the item is part of a broader queue.
- A clear workspace label.
- A stable status and severity.

Dashboard should not require the user to understand the source generator. Operations may expose source filters for power users later, but not raw implementation details.

## Recommended Implementation Sequence

1. Use the merged read-only normalized landlord decision queue API.
2. Add Dashboard 2.0 data adapter using the queue for preview sections.
3. Implement Decision Queue Preview on Dashboard with strict caps.
4. Implement Operations full queue consumption with filters.
5. Move legacy dashboard action prompts into Activation/Upcoming Actions where appropriate.
6. Add message-derived decision treatment once messaging source items are available.
7. Add sticky workspace shell/navigation after route behavior is stable.
8. Apply visual polish and charts after hierarchy and routing are working.

## Non-Goals

- No Dashboard 2.0 UI build.
- No Operations redesign implementation.
- No route changes.
- No API changes.
- No CSS or mockups.
- No message inbox implementation.
- No notification delivery changes.
