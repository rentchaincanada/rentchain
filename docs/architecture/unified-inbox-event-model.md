# Unified Inbox Event Model

## Purpose

The unified inbox should be a projection layer over existing RentChain operational sources. It should not become a new source of truth for leases, maintenance, screening, messages, tenant events, contractor work orders, admin notifications, or audit events.

The inbox model exists to normalize event rendering, sorting, read state, priority, and action routing across tenant, landlord, and contractor workspaces while preserving role separation and existing authorization boundaries.

## Canonical Inbox Event

Every future inbox item should be derived into this metadata-first shape before reaching a frontend surface.

| Field | Required | Rule |
| --- | --- | --- |
| `inboxEventId` | Yes | Deterministic safe identifier. Do not expose raw Firestore document IDs directly. |
| `schemaVersion` | Yes | Use `unified_inbox_event.v1`. |
| `audienceRole` | Yes | One of `tenant`, `landlord`, `contractor`, `admin`. |
| `audienceScopeKey` | Yes | Safe scope key for the authorized audience. Must not be a raw ID label. |
| `sourceKind` | Yes | Source family such as `message`, `maintenance`, `lease`, `screening`, `application`, `notice`, `decision`, `work_order`, `system`. |
| `sourceRef` | Yes | Safe descriptor containing source type and deterministic reference. |
| `occurredAt` | Yes | ISO timestamp used for ordering. |
| `recordedAt` | No | ISO timestamp for derived or audit insertion time. |
| `title` | Yes | Role-safe label for list rendering. |
| `summary` | Yes | Role-safe short description. No private notes or provider payloads. |
| `priority` | Yes | One of `critical`, `high`, `normal`, `low`. |
| `status` | Yes | One of `unread`, `read`, `archived`, `muted`, `resolved`. |
| `actionable` | Yes | Boolean. True only when a supported role-safe next action exists. |
| `action` | No | Safe action descriptor with label, route, method `navigate_only` unless later explicitly authorized. |
| `category` | Yes | Rendering category for icon/color grouping. |
| `threadKey` | No | Safe grouping key for conversation or workflow grouping. |
| `readStateRef` | No | Safe reference to the role-specific read-state record. |
| `visibility` | Yes | Explicit role visibility descriptor. |
| `metadataSafety` | Yes | Flags proving raw IDs, provider payloads, storage paths, tokens, and private notes are excluded. |

## Event Taxonomy

| Category | Source examples | Tenant visibility | Landlord visibility | Contractor visibility |
| --- | --- | --- | --- | --- |
| `application` | rental application status, application reuse, review summary | Own application status and tenant-safe next steps only | Applications scoped to owned properties and landlord-safe tenant summaries | Not visible |
| `screening` | screening request status, consent milestones, report readiness | Own consent and status milestones only, no report internals | Landlord-scoped screening status and review actions, no raw provider payloads | Not visible |
| `lease` | lease created, active, signing, notice, renewal | Own lease status, documents, signature state | Owned lease status, landlord action items, readiness | Not visible unless tied to a work order label and only as property/unit context |
| `maintenance` | request created, status changed, work order assigned, completion | Own request progress and tenant-safe updates | Requests on owned properties and work-order follow-up | Assigned work-order status and work-order messages only |
| `message` | landlord-tenant messages, contractor messages | Messages where tenant is a participant | Messages where landlord is a participant | Messages for assigned work orders only |
| `notice` | tenant notices, viewing notifications | Notices addressed to tenant | Notices issued for owned tenant/lease scope | Not visible |
| `decision` | landlord decision inbox, workflow routing | Not visible | Landlord-safe operational action items only | Not visible |
| `audit` | canonicalEvents, events, auditEvents | Only tenant-safe audit descriptors if explicitly projected | Landlord-scoped audit descriptors only | Only assigned work-order descriptor history |
| `system` | notification preferences, read state, account readiness | Own workspace state only | Landlord workspace state only | Contractor workspace state only |

## Priority Rules

Priority must be deterministic and source-specific.

| Priority | Examples |
| --- | --- |
| `critical` | Security or access-blocking items requiring immediate human review. Not currently common in tenant/landlord/contractor inbox sources. |
| `high` | Screening consent required, urgent or blocked maintenance, overdue/escalated admin notification, landlord action required. |
| `normal` | New message, ordinary maintenance status update, application status update, lease summary available. |
| `low` | Informational status, completed or settled items, optional document checklist reminders. |

If a source has no reliable priority, default to `normal`.

## Action Semantics

Inbox events may include navigation actions, but must not execute mutations directly from the inbox model.

Allowed v1 action types:

- `review_application`
- `review_screening`
- `prepare_lease`
- `view_lease`
- `view_maintenance`
- `view_work_order`
- `reply_message`
- `view_notice`
- `complete_profile`
- `view_documents`
- `no_action`

Every action should include:

- `label`
- `href`
- `method: "navigate_only"`
- `manualOnly: true`
- `policyGuarded: true` for lease, notice, screening, payment, and compliance-adjacent actions

## Read, Archive, and Mute Semantics

Read, archive, and mute state should be stored outside source records.

Recommended storage:

- Tenant: extend the existing `tenantNotificationReads`, `tenantMessageReads`, `tenantMaintenanceReads`, and `tenantScreeningReads` pattern or normalize into a future tenant-scoped inbox state collection.
- Landlord: use landlord-scoped inbox state keyed by landlord scope and safe event ID.
- Contractor: use contractor-scoped inbox state keyed by contractor scope and safe event ID.

Do not mutate `canonicalEvents`, `events`, `tenantEvents`, `messages`, `contractorMessages`, `maintenanceRequests`, `screening_requests`, `leases`, or application records to mark unified inbox state.

## Role Projection Whitelists

### Tenant

Tenant inbox projections may include:

- safe event ID
- category, title, summary, status, priority
- own lease, application, maintenance, notice, screening, or message status
- safe route to tenant workspace pages
- landlord display label only when already visible through tenant workspace

Tenant inbox projections must exclude:

- landlord notes
- admin/support metadata
- raw landlord IDs, unit IDs, lease IDs, property IDs, screening IDs, storage paths
- screening reports or provider payloads
- contractor operational details unless already tenant-safe maintenance progress
- internal decision or policy scoring details

### Landlord

Landlord inbox projections may include:

- owned property, lease, tenant, application, maintenance, and message descriptors
- landlord-safe tenant identity/readiness summaries already exposed by existing services
- review actions and safe internal navigation
- decision inbox workflow metadata already allowed for landlord

Landlord inbox projections must exclude:

- tenant private documents or payloads not already visible in landlord-safe projections
- admin/support-only review state
- provider payloads and raw screening report bodies
- contractor private profile data beyond assigned work-order context

### Contractor

Contractor inbox projections may include:

- assigned work-order title, status, priority, scheduled time, property label, unit label
- contractor-visible message text for assigned work orders
- contractor status history for assigned work orders
- landlord contact label/email only where existing contractor projection already allows it

Contractor inbox projections must exclude:

- lease details unrelated to service execution
- tenant application, screening, payment, notice, and document details
- landlord portfolio internals
- messages outside assigned work orders

### Admin

Admin inbox projections may include operational notification and timeline metadata needed for internal review, but should remain metadata-first and avoid unrestricted raw payload display unless an admin-only route already supports that view.

## Authorization Rules

Unified inbox routes should be role-specific:

- `GET /api/tenant/inbox`: requires tenant workspace identity and resolves tenant scope server-side.
- `GET /api/landlord/inbox`: requires landlord role and resolves landlord scope server-side.
- `GET /api/contractor/inbox`: requires contractor role and validates contractor self scope server-side.

Do not accept audience ownership from the client as authority. Query parameters may filter within the already resolved server-side scope only.

Nested permission checks are required when an item references:

- unit -> property -> landlord
- lease -> tenant and landlord
- maintenance request -> tenant, property, landlord, assigned contractor
- work order -> assigned contractor and landlord
- screening request -> applicant tenant and landlord
- message -> conversation participants

## Ordering and Grouping

Default ordering:

1. unread before read unless filtered otherwise
2. priority rank
3. occurredAt descending
4. inboxEventId ascending for deterministic ties

Grouping options:

- threadKey for conversations
- sourceKind for filters
- property/unit/lease safe labels where role-safe
- actionRequired vs informational

## Relationship to Existing Canonical Events

`canonicalEvents` remains an append-only audit and timeline source. Unified inbox should consume canonical events only through role-safe projections. It should not expose canonical event metadata broadly or allow inbox read/archive state to mutate canonical event records.

## Deferred Decisions

- Whether unified inbox state should be one shared collection or separate role-specific collections.
- Whether realtime delivery uses polling, server-sent events, WebSocket, or Firestore listeners.
- Whether admin notifications become part of the same endpoint family or remain separate.
- Whether archive and mute state should be reversible and audited.
- Whether inbox item generation is request-time only or cached by a future background derivation job.
