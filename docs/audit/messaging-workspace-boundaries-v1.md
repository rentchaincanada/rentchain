# Messaging Workspace Boundaries V1

## Scope

This document defines boundaries between the messaging workspace, unified inbox, dashboard, operations, tenant workspace, maintenance workspace, notice workflows, lease workflows, contractor communication, and support/admin communication.

It is a documentation-only model. It does not change routes, navigation, inbox UI, notification delivery, or backend services.

## Boundary Summary

| Surface | Primary job | Communication role | Should not do |
| --- | --- | --- | --- |
| Messaging | Conversation management. | Read, reply, search, filter, and manage threads. | Prioritize all landlord operations. |
| Unified Inbox | Cross-role activity stream. | Show safe role-scoped activity from multiple sources. | Become the decision queue. |
| Dashboard | Portfolio operational home. | Show only top communication risks and counts. | Show full inbox or long threads. |
| Operations | Full landlord decision queue. | Triage actionable message-derived decisions. | Replace message reply workspace. |
| Tenant workspace | Tenant lifecycle context. | Show tenant-specific messages and reply blockers. | Show global communication queue. |
| Lease workspace | Lease execution and lifecycle context. | Show signing, notice, document, and lease-related communication context. | Become general messaging. |
| Maintenance workspace | Maintenance execution context. | Show tenant/contractor maintenance messages. | Route unrelated tenant chat. |
| Notices | Formal notice workflow context. | Show notice-relevant messages and response deadlines. | Treat ordinary chat as formal notice. |
| Contractor workspace | Work-order communication context. | Show contractor messages linked to assigned work. | Expose landlord/tenant private context outside scope. |
| Support/admin | Escalation and internal support context. | Surface safe landlord-facing support escalations. | Expose internal admin notes or payloads. |

## Standalone Messaging Boundary

Standalone Messaging should own:

- Thread list.
- Conversation detail.
- Reply composer.
- Read/unread state.
- Resolved/archived/muted state.
- Sender/recipient context.
- Safe tenant/property/lease labels.
- Thread search and filters.

Standalone Messaging should not own:

- Portfolio health.
- Full operations prioritization.
- Lease document readiness.
- Maintenance approval workflows.
- Notice deadline logic.
- Payment delinquency resolution.

## Unified Inbox Boundary

Unified Inbox should remain a safe role-scoped activity aggregation layer.

It should own:

- Role-based inbox records.
- Safe cross-source projections.
- Activity status and priority labels.
- Source kind labels.

It should not own:

- Long-term queue prioritization.
- Landlord decision source of truth.
- Message reply workflow if a dedicated Messaging workspace exists.
- Tenant or contractor data outside explicit projections.

## Operations Boundary

Operations should own:

- Prioritized landlord decision queue.
- Cross-domain filters.
- Severity sorting.
- Message-derived action items.
- Routing to source workspaces.

Operations should not own:

- Full message threads.
- Message composition.
- General unread inbox browsing.
- Legal or notice drafting automation.

## Dashboard Boundary

Dashboard should own:

- Portfolio status summary.
- Top critical communication indicator.
- Awaiting reply count.
- Link into Messaging or Operations.

Dashboard should exclude:

- Full message previews.
- Ordinary unread counts without actionability.
- System notification streams.
- Contractor chatter.
- Support/admin internal context.

## Tenant Workspace Boundary

Tenant workspace should own:

- Tenant-specific conversations.
- Tenant awaiting reply state.
- Move-in or lease-context messages.
- Tenant portal readiness messaging.

Tenant workspace should not own:

- Portfolio-wide communication triage.
- Other tenants' message context.
- Contractor operational details unrelated to tenant-facing maintenance.

## Maintenance Boundary

Maintenance workspace should own:

- Maintenance request thread context.
- Contractor quote messages.
- Schedule/access coordination.
- Completion, rework, signoff, and cost-review communication.

Maintenance-derived message decisions should route to Maintenance, not generic lease summary pages.

## Notice Boundary

Notice workflows should own:

- Notice-relevant message classification.
- Notice response timing.
- Renewal/no-response context.
- Notice follow-up.

Ordinary tenant chat should not be treated as notice-relevant unless an explicit source or workflow classification exists.

## Lease Signing Boundary

Lease signing communications should own:

- Signing request sent/failed context.
- Provider lifecycle communication status.
- Return route and completion guidance.
- Signed document availability context.

Signing completion events should be audit/evidence context. They should produce queue items only when failed, blocked, or awaiting landlord action.

## Contractor Boundary

Contractor messaging should be tied to work orders.

Recommended future path:

1. Contractor messages live inside work-order context.
2. Landlord sees contractor-derived decisions in Operations only when action is required.
3. Contractor portal sees a contractor-safe view of assigned work messages.
4. Dashboard shows only critical contractor-related blockers.

## Support/Admin Boundary

Support/admin communications should surface to landlords only as safe support escalation items when landlord action is required.

Do not expose:

- Internal support notes.
- Admin investigation context.
- Raw system logs.
- Provider payloads.
- Sensitive tenant or screening metadata.

## Message Noise Controls

To avoid dashboard and operations overload:

1. Do not promote every unread message.
2. Promote only actionable, urgent, blocked, notice-relevant, support-escalated, or workflow-linked messages.
3. Deduplicate message items against source workflow decisions.
4. Use safe short summaries only.
5. Route to the source workspace where the work is resolved.

## Recommended Navigation Model

Recommended landlord navigation:

- Dashboard: operational home with communication summary.
- Operations: full decision queue, including message-derived decisions.
- Messages: standalone conversation workspace.
- Maintenance: work-order communication and execution.
- Tenants: tenant-specific messages and readiness.
- Leases: lease-specific signing, notice, document, and delivery communication.

The visible primary nav should avoid presenting both Unified Inbox and Messages as equivalent destinations unless their purposes are clearly named.

## Future Implementation Sequence

1. Add messaging source types to the read-only landlord decision queue normalization service.
2. Normalize only actionable message-derived conditions first.
3. Preserve Unified Inbox as an activity source.
4. Keep Message workspace as the reply/composition surface.
5. Add Operations filters for Communication, Awaiting response, Urgent, Maintenance, Notice, and Support.
6. Revisit landlord navigation labels after Dashboard 2.0 and Operations boundaries are implemented.

## Non-Goals

- No code changes.
- No UI redesign.
- No inbox implementation.
- No notification delivery changes.
- No contractor portal implementation.
- No AI message classification.
- No legal notice automation.
