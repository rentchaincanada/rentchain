# Unified Messaging Inbox IA V1

## Scope

This audit defines how RentChain communications should flow into a unified messaging model and how message-derived decisions should surface in Dashboard 2.0 and Operations.

Reviewed communication areas:

- Landlord and tenant direct messages.
- Tenant portal communications.
- Maintenance-related messages.
- Contractor work-order messages and future contractor portal messaging.
- Notice-related communications.
- Lease signing communications and provider lifecycle notifications.
- System notifications.
- Support/admin messages and escalation-style notifications where present.
- Existing unified inbox architecture.

This is a documentation-only audit. It does not change messaging code, inbox UI, notification delivery, routes, database records, Cloud Run, Vercel, or tests.

## Current Communication Surfaces

| Surface | Representative source | Current role | IA finding |
| --- | --- | --- | --- |
| Unified Inbox | `rentchain-api/src/services/unifiedInbox/*`, `UnifiedInboxPage.tsx` | Role-based activity aggregator for tenant, landlord, contractor audiences. | Useful as a safe activity stream, but not yet a canonical decision queue. |
| Landlord Messages | `messagesRoutes.ts`, `MessagesPage.tsx` | Dedicated conversation workspace for landlord replies and thread management. | Should remain the primary reply/composition workspace. |
| Tenant Communications | `tenantCommunicationsService.ts`, tenant communications workspace state | Tenant-safe conversation projection and tenant-side response state. | Should be simplified around "needs reply", "active", and "informational" states. |
| Maintenance communications | Maintenance requests, work order updates, contractor communications | Operational discussion attached to a maintenance request or work order. | Should be embedded in Maintenance and generate decisions only when blocked, urgent, or awaiting landlord response. |
| Contractor communications | Contractor work orders, contractor messages, work order communications | Future contractor portal communication stream. | Should connect through work-order context, not become a standalone landlord dashboard feed. |
| Notices | Tenant notices and lease notice workflows | Formal or semi-formal tenancy communication. | Notice relevance should be explicitly classified and routed to Notices/Lease workflow, not ordinary chat. |
| Lease signing communications | Signing request events, signing emails, webhook lifecycle | Provider-driven lifecycle and email delivery state. | Signing lifecycle is audit/evidence context; only failures or required actions should become decisions. |
| System notifications | Derived notifications and service emails | Product/system status and task nudges. | Should remain informational unless tied to a concrete landlord action. |
| Support/admin messages | Admin/support notification derivation where available | Internal or support escalation signals. | Should enter landlord decision flow only as safe support escalation metadata. |

## Implemented Unified Inbox Shape

The current unified inbox already has strong projection and safety foundations:

- Audiences: tenant, landlord, contractor.
- Source kinds: message, maintenance, screening, lease, application, notice, viewing, work order, contractor message.
- Statuses: unread, read, archived, muted, resolved.
- Priorities: critical, high, normal, low.
- Public records expose a safe subset: id, source kind, audience role, title, body, priority, status, timestamps, and read metadata.
- Adapters exclude raw IDs, tokens, secrets, provider payloads, storage paths, private notes, and risk metadata.

IA conclusion: keep the unified inbox as a cross-source activity layer, but do not treat every inbox event as a landlord decision.

## Primary Inbox Recommendation

RentChain should use a dual model:

1. Messaging workspace
   - Primary place to read and reply to conversations.
   - Supports landlord, tenant, maintenance, contractor, and support-style threads.
   - Owns composition, reply, thread history, read state, and message context.

2. Decision queue
   - Primary place to prioritize actionable message-derived work.
   - Receives only normalized message decisions.
   - Does not replace the messaging workspace.

The landlord dashboard should not become the primary inbox. It should display only top critical communication decisions and count summaries.

## Standalone Versus Embedded Messaging

Messaging should be both standalone and embedded, but with different responsibilities.

| Placement | Responsibility | Examples |
| --- | --- | --- |
| Standalone Messaging workspace | Conversation list, reply workflow, unread management, thread search/filtering. | Tenant asking a question, landlord reply, support escalation. |
| Tenant workspace embedded thread | Tenant-specific conversation context and move-in/readiness questions. | Tenant asks about move-in, lease, documents, portal activation. |
| Lease workspace embedded thread/history | Lease-signing and notice-related communication context. | Signing issue, lease question, notice response. |
| Maintenance workspace embedded thread | Work-order and contractor/tenant maintenance communication. | Tenant access issue, contractor quote, completion question. |
| Operations queue | Actionable messages only, normalized by severity. | Tenant awaiting reply, urgent maintenance message, contractor quote requires response. |
| Dashboard | Summary only. | "2 urgent messages" or one critical communication item. |

## Message State Semantics

| State | Definition | Queue treatment |
| --- | --- | --- |
| Unread | A message has not been read by the current audience. | Informational unless high priority, urgent, or from an active workflow. |
| Urgent | Message is marked critical/high or belongs to an urgent source workflow. | Warning or Critical decision item. |
| Awaiting response | Latest actionable message is from another party and requires landlord reply. | Needs Review or Warning decision item. |
| Unresolved | Thread is open with unresolved operational context. | Needs Review only if landlord has next action. |
| Resolved | Thread no longer requires action. | Remove from decision queue; keep in messaging history. |
| Notice relevant | Message is tied to a formal notice, dispute, complaint, or legal-relevance classification. | Route to Notices or Lease workflow; do not treat as ordinary chat. |
| Evidence relevant | Message should be available to evidence packages as safe metadata/excerpt. | Evidence context, not automatically a decision. |

## What Messages Generate Decisions

Message-derived decisions should be generated only when there is a clear landlord action or material risk.

| Condition | Decision item? | Severity | Owning workspace |
| --- | --- | --- | --- |
| Tenant awaiting landlord reply on an active lease or move-in workflow | Yes | needs_review or warning | tenant |
| Urgent unread tenant message | Yes | warning or critical | tenant |
| Urgent maintenance message | Yes | warning or critical | maintenance |
| Contractor quote requires landlord approval | Yes | needs_review | maintenance |
| Contractor schedule/access issue requires landlord response | Yes | warning | maintenance |
| Tenant dispute or complaint requires review | Yes | warning or critical | tenant or lease |
| Message contains notice/legal relevance | Yes | warning or upcoming depending deadline | notices |
| Support escalation requiring landlord action | Yes | warning or critical | operations |
| General unread message | Usually no | informational | messaging |
| System notification with no action | No | informational | unified inbox |
| Completed signing email/provider notice | No | informational | lease |

## Message Evidence Model

Messaging should support evidence without flooding the decision queue.

Evidence packages and institutional exports should be able to reference:

- Safe message metadata.
- Sender/recipient role labels.
- Sent/received timestamps.
- Thread context.
- Short bounded excerpts when landlord-visible and already allowed by evidence package policy.
- Notice-relevance classification where available.

They should not expose:

- Raw message payloads beyond approved excerpts.
- Private/internal notes.
- Provider IDs.
- Storage paths.
- Tokens.
- Unrelated tenant or support metadata.

## Tenant Portal Simplification

Tenant messaging should be simplified around user intent:

1. Messages needing tenant reply.
2. Active conversations.
3. Documents/notices requiring review.
4. Informational updates.

Tenant portal should avoid exposing landlord operational categories such as Decision Queue, Operations, state coherence, or compliance posture.

## Contractor Messaging Connection

Contractor messaging should eventually connect through work orders:

- Contractor messages belong to a work order or maintenance request.
- Landlords should see contractor communication in Maintenance context.
- Operations should show contractor-derived decisions only when a landlord action is required.
- Contractor portal should receive a narrowed contractor-safe view.

Contractor messages should not become a separate dashboard inbox unless contractor volume justifies a dedicated filter inside Messaging or Operations.

## Dashboard Treatment

Dashboard should display only communication summary signals:

- Critical communication count.
- Top one or two urgent communication decisions.
- "Awaiting reply" count when material.
- Link to Messaging or Operations.

Dashboard should exclude:

- Full message list.
- Ordinary unread counts without actionability.
- Long conversation previews.
- Maintenance thread details.
- Contractor chatter.
- Support/system informational notifications.

## Operations Treatment

Operations should own normalized message-derived decisions:

- Tenant awaiting reply.
- Urgent unread message.
- Maintenance communication blocker.
- Contractor quote or schedule response required.
- Notice-relevant message.
- Support escalation.

Each item should route to the workspace where the landlord can resolve it.

## Recommended Source Types For Future Decision Queue

Add messaging source types to the future landlord decision queue normalization mission:

- `message_thread`
- `message_unread_priority`
- `message_notice_relevance`
- `message_maintenance_follow_up`
- `message_support_escalation`
- `unified_inbox_event`

These should be normalized, deduped, and routed like other operational signals. They should not import the entire unified inbox into the decision queue.

## Non-Goals

- No messaging implementation.
- No inbox UI build.
- No notification delivery changes.
- No code changes.
- No unrestricted AI assistant behavior.
- No new evidence export behavior.
- No tenant visibility expansion.
