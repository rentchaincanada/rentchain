# Delegated Access Audit and Activity Model V1

## Scope

This document defines the audit and activity event model needed for delegated access.

This is documentation-only. It does not implement event storage, backend routes, Firestore schema, UI, export APIs, or enforcement logic.

## Purpose

Delegated access must preserve defensible activity history. The platform must be able to answer:

1. Who performed the action?
2. Which landlord were they acting for?
3. What role and permission scope authorized the action?
4. What resource was affected?
5. What changed?
6. When and from which available session/device context did it happen?
7. Was the action allowed, denied, revoked, or expired?

This model should be append-safe, metadata-first, and projection-safe.

## Required Event Fields

| Field | Required | Description |
| --- | --- | --- |
| `eventId` | Yes | Immutable audit event identifier. |
| `eventType` | Yes | Stable delegated access event name. |
| `actorUserId` | Yes | Authenticated user who took the action. |
| `actingForLandlordId` | Yes | Landlord workspace the actor was operating under. |
| `delegatedRole` | Yes for delegates | Role active at the time of action. Landlord owner actions may use `landlord_owner`. |
| `permissionScope` | Yes | Granted scope evaluated for the action. |
| `sessionId` | Recommended | Authentication/session reference when available. |
| `actionType` | Yes | Operational verb, such as `invite_created`, `message_sent`, `payment_export_requested`, `work_order_assigned`. |
| `targetResourceType` | Yes | Resource category affected by the action. |
| `targetResourceId` | Yes when applicable | Safe resource reference or canonical resource ID where allowed internally. User-facing projections should not expose raw IDs. |
| `timestamp` | Yes | Server timestamp. |
| `ipAddress` | If available | IP metadata for security review. |
| `deviceMetadata` | If available | User agent/device/browser metadata, normalized and non-sensitive. |
| `before` | Where applicable | Minimal before state for mutable actions. |
| `after` | Where applicable | Minimal after state for mutable actions. |
| `outcome` | Yes | `allowed`, `denied`, `revoked`, `expired`, `failed`, or `blocked`. |
| `reason` | Optional | Human-entered or system-generated reason, sanitized. |
| `metadataOnly` | Yes | Must be `true` for audit events. |
| `appendOnly` | Yes | Must be `true`. |
| `immutable` | Yes | Must be `true`. |

## Permission Scope Shape

`permissionScope` should be explicit enough for later audit review.

Recommended shape:

```json
{
  "role": "property_manager",
  "workspaceScopes": ["dashboard", "operations", "properties", "tenants", "leases"],
  "propertyScopes": ["property_ref_1", "property_ref_2"],
  "resourceScopes": [],
  "permissionFlags": ["view", "create", "edit", "message", "assign"],
  "billingAccess": false,
  "exportAccess": false
}
```

The exact storage schema can differ later, but audit events must capture the evaluated permission context in a stable, reviewable form.

## Event Types

### Access Lifecycle Events

| Event type | Description |
| --- | --- |
| `delegated_invite_created` | Landlord owner creates invitation. |
| `delegated_invite_sent` | Invitation email is queued/sent. |
| `delegated_invite_accepted` | Delegate accepts and links their account. |
| `delegated_invite_expired` | Invitation expires unused. |
| `delegated_invite_cancelled` | Landlord owner cancels pending invite. |
| `delegated_role_changed` | Delegate role changes. |
| `delegated_scope_changed` | Property/workspace/resource scope changes. |
| `delegated_access_revoked` | Landlord owner revokes access. |
| `delegated_session_invalidated` | Active delegated session is invalidated after revocation or role/scope change. |

### Access Use Events

| Event type | Description |
| --- | --- |
| `delegated_workspace_opened` | Delegate opens a landlord workspace. |
| `delegated_resource_viewed` | Delegate views sensitive scoped resource when audit level requires it. |
| `delegated_message_sent` | Delegate sends or replies to a message. |
| `delegated_operation_assigned` | Delegate assigns work, queue item, contractor, or staff. |
| `delegated_work_order_updated` | Delegate changes work order state/details. |
| `delegated_schedule_updated` | Delegate creates/edits schedule item or note when persisted later. |
| `delegated_payment_viewed` | Delegate views payment data when role permits. |
| `delegated_payment_action_attempted` | Delegate attempts payment-affecting action. |
| `delegated_evidence_uploaded` | Delegate uploads evidence. |
| `delegated_export_generated` | Delegate generates an export. |
| `delegated_access_denied` | Server denies action due to missing role/scope/permission. |

## Target Resource Types

Recommended `targetResourceType` values:

- `landlord_workspace`
- `dashboard`
- `operation`
- `property`
- `unit`
- `tenant`
- `lease`
- `payment`
- `message_thread`
- `inbox_record`
- `schedule_item`
- `schedule_note`
- `maintenance_request`
- `work_order`
- `contractor_job`
- `screening_activity`
- `evidence_item`
- `export_package`
- `delegate_invitation`
- `delegate_grant`
- `billing_settings`

## Before/After Requirements

Before/after fields should be minimal and safe.

Use before/after for:

- Role changes.
- Scope changes.
- Revocations.
- Work order status changes.
- Assignment changes.
- Message status changes.
- Payment metadata edits when allowed.
- Evidence visibility changes.
- Export scope selection.

Do not copy:

- Raw private message bodies unless explicitly required and redacted.
- Payment method secrets.
- Provider payloads.
- Storage paths.
- Tokens.
- Credentials.
- Full screening reports.
- Unredacted tenant PII beyond necessary labels/references.

## Immutable Audit Requirements

Delegated audit events must be:

- Append-only.
- Server timestamped.
- Written by backend-controlled audit helpers.
- Non-overwritable after creation.
- Safe to export later with redaction.
- Independent of frontend state.
- Preserved after delegate revocation.
- Preserved after property manager or contractor company turnover.

Audit write failures for low-risk view events may be handled differently from high-risk mutation events, but high-risk actions should not silently proceed if required audit capture is unavailable.

## Denied Action Audit

Denied actions should be logged when practical, especially for:

- Revoked delegate access.
- Out-of-scope property access.
- Payment mutation/export attempts.
- Evidence/export attempts.
- Billing/settings attempts.
- Contractor attempts to access non-assigned jobs or tenant/payment/lease data.

Denied-action audit helps detect stale sessions, shared devices, malicious access, or misconfigured roles.

## Activity Views

Future owner-facing activity views should support:

- Filter by delegate.
- Filter by property.
- Filter by workspace.
- Filter by action type.
- Filter by date range.
- Highlight high-risk actions.
- Show revocation and role history.
- Export owner-visible audit summaries.

V1 implementation can start with capture before building all review surfaces.

## Non-Goals

- This model does not implement audit collection writes.
- This model does not define Firestore collection names.
- This model does not implement audit retrieval APIs.
- This model does not implement legal certification or chain-of-custody.
- This model does not create a SIEM integration.
- This model does not grant any delegated permissions by itself.
