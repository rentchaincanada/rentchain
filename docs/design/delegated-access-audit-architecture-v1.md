# Delegated Access Audit Architecture V1

## Scope

This document defines the audit architecture needed for Delegated Access V1 implementation.

This is design-only. It does not implement audit storage, event helpers, exports, backend routes, UI, Firestore schema, or security rules.

## Audit Objective

Delegated access must preserve defensible activity history.

The platform should be able to answer:

- Who authenticated?
- Which landlord did they act for?
- Which grant, role, and scope authorized the action?
- What resource was accessed or changed?
- What changed?
- Was the action allowed, denied, revoked, expired, or failed?
- When did it happen?
- What session, IP, and device metadata were available?

## Actor Attribution

Delegated actions must distinguish actor from landlord.

Required attribution:

| Field | Meaning |
| --- | --- |
| `actorUserId` | Authenticated user who performed the action. |
| `actingForLandlordId` | Landlord workspace represented. |
| `relationship` | `owner` or `delegate`. |
| `delegateGrantId` | Active grant evaluated for delegate actions. |
| `delegatedRole` | Role evaluated at action time. |
| `permissionScope` | Evaluated scope at action time. |

Audit labels should represent:

`Delegate acted for landlord`

not:

`Landlord acted`

## Event Storage

Preferred approach:

- Use the existing canonical audit/event infrastructure if available.
- Add delegated access event types to that infrastructure.
- Store immutable, append-safe, metadata-first events.
- Keep lifecycle events and high-risk use events queryable by landlord, actor, role, and timestamp.

If a separate delegated audit collection is needed, it should still follow canonical audit conventions and not become a competing event system.

## Event Categories

### Lifecycle Events

- `delegated_invite_created`
- `delegated_invite_sent`
- `delegated_invite_accepted`
- `delegated_invite_expired`
- `delegated_invite_cancelled`
- `delegated_role_changed`
- `delegated_scope_changed`
- `delegated_access_revoked`
- `delegated_session_invalidated`

### Use Events

- `delegated_workspace_opened`
- `delegated_resource_viewed`
- `delegated_message_sent`
- `delegated_operation_assigned`
- `delegated_work_order_updated`
- `delegated_schedule_updated`
- `delegated_payment_viewed`
- `delegated_payment_action_attempted`
- `delegated_evidence_uploaded`
- `delegated_export_generated`
- `delegated_access_denied`

## Required Event Fields

| Field | Requirement |
| --- | --- |
| `eventId` | Required immutable event identifier. |
| `eventType` | Required stable event name. |
| `actorUserId` | Required. |
| `actingForLandlordId` | Required. |
| `delegateGrantId` | Required for delegate actions. |
| `delegatedRole` | Required for delegate actions. |
| `permissionScope` | Required evaluated scope. |
| `actionType` | Required action verb. |
| `targetResourceType` | Required where applicable. |
| `targetResourceId` | Required where applicable, internal only. |
| `timestamp` | Required server timestamp. |
| `outcome` | Required `allowed`, `denied`, `revoked`, `expired`, `failed`, or `blocked`. |
| `sessionId` | Recommended where available. |
| `ipAddress` | If available. |
| `deviceMetadata` | If available and normalized. |
| `before` | Required for material mutations where safe. |
| `after` | Required for material mutations where safe. |
| `metadataOnly` | Required `true`. |
| `appendOnly` | Required `true`. |
| `immutable` | Required `true`. |

## Immutable Record Requirements

Delegated audit events must be:

- Written server-side.
- Append-only.
- Server timestamped.
- Non-overwritable.
- Preserved after revocation.
- Preserved after invite cancellation.
- Preserved after delegate account removal where legally and operationally appropriate.
- Exportable later with redaction.

High-risk actions should not silently proceed if required audit capture fails.

## Evidence Requirements

Evidence and exports require heightened audit treatment.

Events should capture:

- Actor and landlord attribution.
- Grant and role.
- Export or evidence package scope.
- Target resources included.
- Timestamp.
- Outcome.
- Redaction/export profile where applicable.

Events should not copy:

- Raw provider payloads.
- Private message bodies unless explicitly redacted and approved.
- Full documents.
- Storage paths.
- Tokens.
- Credentials.
- Payment method secrets.
- Full screening reports.

## Payment Audit Requirements

Payment surfaces are high-risk.

V1 recommended audit:

- Log delegate payment views when the role is permitted to view payment data.
- Log all payment export attempts.
- Log all payment mutation attempts, including denied attempts.
- Keep payment method and processor details out of audit metadata unless already safe and necessary.

Payment mutation should remain owner-only in V1 unless a future approved model changes that.

## Privacy Requirements

Audit events must not become a shadow copy of sensitive records.

Audit payloads should use:

- Safe resource references.
- Redacted display labels where needed.
- Minimal before/after fields.
- Reason codes instead of raw sensitive context.

Tenant-facing and delegate-facing activity projections must not expose internal IDs or private metadata.

## Reporting And Export Considerations

Future owner-facing audit views should support:

- Filter by delegate.
- Filter by property.
- Filter by workspace.
- Filter by action type.
- Filter by outcome.
- Filter by date range.
- Highlight high-risk actions.
- Export scoped audit summaries.

Read-only auditors may receive export access only when explicitly scoped.

## Denied Action Audit

Denied actions should be captured for:

- Revoked grants.
- Expired grants.
- Out-of-scope property access.
- Out-of-scope workspace access.
- Contractor attempts outside assigned jobs.
- Payment mutation/export attempts.
- Evidence/export attempts.
- Billing/settings attempts.

Denied audit events help detect stale sessions, shared devices, malicious access, and misconfigured roles.

## Retention Considerations

Retention policy should be decided before implementation.

Recommended posture:

- Delegate lifecycle events should be retained for the life of the landlord account plus approved retention window.
- High-risk access and export events should be retained consistently with evidence/export governance.
- Low-risk view events may have a shorter retention policy if volume becomes a concern.

No retention changes are implemented by this document.

## Non-Goals

- No legal certification.
- No chain-of-custody implementation.
- No SIEM integration.
- No audit export route.
- No audit UI.
- No immutable storage migration.
