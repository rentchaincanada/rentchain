# Messaging To Decision Routing Model V1

## Scope

This document defines when communication signals become landlord decision queue items and which workspace should own resolution.

It is a documentation-only routing model. It does not implement message parsing, inbox UI, notification delivery, AI classification, or decision queue code.

## Routing Principle

Messages are not decisions by default.

A message becomes a decision only when it creates one of these conditions:

1. A landlord must reply.
2. A landlord must approve, reject, assign, schedule, or resolve something.
3. A deadline, notice, complaint, or dispute makes the message operationally urgent.
4. A maintenance, contractor, lease, payment, or support workflow is blocked.
5. A high-priority unread message creates material risk.

Ordinary unread messages should stay in Messaging or Unified Inbox.

## Message-Derived Decision Conditions

| Condition | Source type | Severity | Workspace | Recommended destination |
| --- | --- | --- | --- | --- |
| Tenant awaiting landlord reply | `message_thread` | needs_review | tenant | Tenant profile or message thread. |
| Unread high-priority tenant message | `message_unread_priority` | warning | tenant | Message thread with tenant context. |
| Urgent tenant complaint/dispute | `message_thread` | warning or critical | tenant or lease | Tenant profile or lease workspace based on resource. |
| Maintenance message requires landlord response | `message_maintenance_follow_up` | warning | maintenance | Maintenance request detail. |
| Contractor quote requires approval | `message_maintenance_follow_up` | needs_review | maintenance | Work order cost/approval context. |
| Contractor schedule/access issue | `message_maintenance_follow_up` | warning | maintenance | Work order schedule/access context. |
| Message is notice relevant | `message_notice_relevance` | upcoming or warning | notices | Notice workflow or lease workflow page. |
| Message affects lease signing/document readiness | `message_thread` | warning | lease | Lease signing/document panel. |
| Support escalation requiring landlord response | `message_support_escalation` | warning or critical | operations | Operations item or support thread. |
| System notification with no action | `unified_inbox_event` | informational | dashboard or operations summary | No queue item unless action is required. |

## Severity Mapping

| Communication state | Canonical severity |
| --- | --- |
| Verified emergency, urgent maintenance access issue, material support escalation | critical |
| Urgent unread tenant message, notice-relevant message near deadline, blocked maintenance communication | warning |
| Tenant awaiting reply, contractor approval needed, unresolved non-urgent thread | needs_review |
| Notice response deadline or planned follow-up date not yet near | upcoming |
| General read/unread informational update | informational |

Severity must be derived from source context and actionability, not from unread state alone.

## Recommended Normalized Item Mapping

Future decision queue items from messaging should include:

```ts
{
  sourceType:
    | "message_thread"
    | "message_unread_priority"
    | "message_notice_relevance"
    | "message_maintenance_follow_up"
    | "message_support_escalation"
    | "unified_inbox_event";
  workspace: "tenant" | "lease" | "maintenance" | "notices" | "operations" | "dashboard";
  severity: "critical" | "warning" | "needs_review" | "upcoming" | "informational";
  title: string;
  description: string;
  recommendedActionLabel: string;
  recommendedActionHref: string;
  relatedEntityRefs: {
    tenantId?: string;
    leaseId?: string;
    propertyId?: string;
    unitId?: string;
    maintenanceRequestId?: string;
    noticeId?: string;
  };
  dedupeKey: string;
}
```

The item should not expose raw message IDs as user-facing labels.

## Workspace Routing

| Workspace | Owns message-derived decisions when |
| --- | --- |
| Tenant | The thread concerns tenant reply, move-in readiness, tenant lifecycle, or tenant-specific issue resolution. |
| Lease | The thread concerns lease execution, signing, documents, Form P readiness, delivery readiness, or lease lifecycle. |
| Maintenance | The thread concerns maintenance request triage, contractor communication, quote approval, access, schedule, completion, or rework. |
| Notices | The thread has notice/legal-relevance classification or relates to notice deadlines/responses. |
| Operations | The thread is cross-cutting, escalated, support-driven, or lacks a more specific safe owner. |
| Dashboard | Summary preview only; dashboard should not own resolution. |

## Dedupe Rules

Message-derived decisions should dedupe against source workflow decisions.

| Duplicate pattern | Dedupe rule |
| --- | --- |
| Maintenance request already emits "needs review" and tenant sends message on same request | Keep one maintenance decision, attach message context. |
| Notice deadline item and notice-relevant message for same notice | Keep notice deadline item, add message context or raise severity if needed. |
| Tenant awaiting reply and unread high-priority message in same thread | Keep higher severity item with one thread destination. |
| Support escalation and system notification for same support case | Keep support escalation item only. |
| Lease signing failure and message about signing failure | Keep lease signing failure item, attach message context. |

Recommended dedupe key pattern:

```txt
message:<sourceType>:<workspace>:<resourceType>:<resourceId>:<threadOrCaseRef>
```

The displayed item should use safe labels and not expose this raw key.

## Evidence Rules

Message-derived decisions may reference evidence context, but the decision queue should not become an evidence export surface.

Allowed decision metadata:

- Safe thread label.
- Sender/recipient role labels.
- Last activity timestamp.
- Message count.
- Short safe summary or approved excerpt if already landlord-visible.
- Notice/maintenance/lease relationship.

Excluded decision metadata:

- Raw message body dumps.
- Private notes.
- Raw provider payloads.
- Storage paths.
- Tokens or secrets.
- Unrelated tenant metadata.
- Raw internal IDs as labels.

## Dashboard Treatment

Dashboard should consume message decisions as:

- Critical communication count.
- Top urgent communication item.
- Awaiting reply count if non-zero.
- Link to Messaging or Operations.

Dashboard should not display:

- Full threads.
- Ordinary unread message lists.
- Contractor chatter.
- Notice/legal excerpts.
- Support/admin raw details.

## Operations Treatment

Operations should consume message decisions as first-class queue items with filters:

- Communication.
- Tenant.
- Maintenance.
- Notice.
- Support escalation.
- Awaiting response.
- Urgent.

Operations should route users to the owning workspace or message thread for resolution.

## Non-Goals

- No code changes.
- No AI classification implementation.
- No messaging UI changes.
- No new notification delivery.
- No new evidence export behavior.
- No legal advice or notice automation.
