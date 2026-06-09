# Unified Inbox Audit Findings

## Scope

This audit inspected existing event, timeline, message, notification, activity, decision, tenant, landlord, contractor, and Firestore rule surfaces relevant to a future unified inbox. No source code was changed.

## Existing Event Sources

| Source | Current collection or route | Current audience | Notes |
| --- | --- | --- | --- |
| Canonical events | `canonicalEvents`, `GET /api/timeline` | Admin timeline today | Canonical event contract exists with domain/action/visibility. Timeline route currently permits admin only and filters out tenant visibility. |
| Analytics events | `events`, `POST /api/events/track`, `GET /api/events/registry-funnel-report` | Public tracking write, admin report | Event names are allowlisted. General `GET /api/events` returns placeholder items in the current route. |
| Audit events | `events`, `canonicalEvents`, `auditEvents`, `adminAuditEvents` | Role dependent by rules and routes | Firestore rules make event collections append-only and readable by admin or matching landlord/tenant fields. |
| Tenant events | `tenantEvents`, `/api/tenant-events`, `/api/tenant/events`, `/api/tenants/:tenantId/events` | Landlord and tenant | Two route files expose overlapping tenant event behavior. Landlord write and read paths exist. Tenant read path returns tenant-scoped events. |
| Tenant notifications | `/api/tenant/notifications`, `/api/tenant/activity` | Tenant | Derived from profile/application/identity/document/lease/maintenance/invite/message state. Read state stored separately in `tenantNotificationReads`. |
| Tenant messages feed | `/api/tenant/messages` | Tenant | Combines landlord messages, maintenance updates, and screening updates. Read state is stored in separate read collections. |
| Landlord decision inbox | `/api/landlord/decision-inbox` | Landlord | Derived from analytics decisions and lease lifecycle decisions. Manual workflow routing metadata is present. |
| Landlord analytics inbox | `/api/landlord/analytics/inbox` | Landlord | Derives application, lease, screening action items from landlord-scoped collections and safe tenant summaries. |
| Landlord review timeline | `/api/landlord/review-timeline` | Landlord | Derives timeline from landlord-scoped collections, decisions, operator review sessions, events, and canonical events. |
| Admin notifications | `/api/admin/notifications` | Admin | Derived from admin alerts, triage, portfolio score trend, watchlist, and state records. |
| Landlord-tenant messages | `/api/landlord/messages/...`, `/api/tenant/messages/...` | Landlord and tenant | Conversation and message projections exist with role guards. |
| Contractor portal | `/api/contractors/:contractorId/work-orders`, `/messages` | Contractor | Enforces contractor self-scope. Work orders and messages are projected before response. |
| Application timeline | `/api/applications/:id/timeline` | Landlord implied | Builds lightweight application timeline from application timestamps after landlord check. |
| Screening events | `/api/rental-applications/:id/screening/events` | Landlord/admin | Enforces landlord/admin and application scope before loading screening events. |
| Activity events | `activityEvents` via `emitPropertyActivityEvent` | Internal/current consumers not centralized | Property-scoped idempotent events are written for activity-style signals. |

## Current Authorization Findings

1. `GET /api/timeline` is admin-only. It does not yet serve tenant, landlord, or contractor unified inbox use cases.
2. Landlord inbox and decision routes resolve landlord scope server-side using `req.user.landlordId || req.user.id`.
3. Contractor portal routes require contractor role and reject access when the requested contractor ID does not match the authenticated contractor unless admin.
4. Tenant portal notification and activity routes require tenant workspace identity and resolve tenancy context server-side.
5. Firestore rules make `events`, `canonicalEvents`, and `auditEvents` append-only, but read access depends on presence of `landlordId` or `tenantId` fields. Canonical events without those fields may be admin-only by effective behavior.
6. Some legacy or compatibility routes return raw event records rather than normalized role-safe inbox items. They should not be reused directly for unified inbox responses.

## Current Projection Findings

Tenant-safe projection already exists in several places:

- `tenantNotificationsService` uses safe notification IDs, safe source references, tenant profile projection, related tenant paths, and separate read state.
- `/api/tenant/messages` combines messages, maintenance updates, and screening updates into `TenantCommunicationItem` with title, body, priority, read state, and related entity fields.
- Tenant profile and communications routes use workspace context resolution before deriving data.

Landlord-safe projection already exists in several places:

- `deriveLandlordInbox` returns application, screening, and lease action items with safe title, description, priority, status, next action, and trust/credibility summaries.
- Decision inbox exposes manual workflow metadata and excludes admin-only review data.
- Review timeline derives landlord-scoped operational history and marks timeline behavior as read-only.

Contractor-safe projection already exists in contractor portal service:

- Work orders are filtered by assigned contractor.
- Contractor messages are filtered by contractor ID and optional work order ID.
- Message projection returns only message ID, work order ID, sender role, text, and timestamp.
- Work-order projection uses labels and assigned work-order state rather than exposing broader tenant/application/lease data.

Projection gaps:

- No shared inbox event contract exists across roles.
- Existing event shapes use inconsistent fields: `id`, `eventId`, `type`, `eventType`, `createdAt`, `occurredAt`, `ts`, `timestamp`, `title`, `message`, `summary`, `body`.
- Tenant notification and tenant message feeds overlap but are separate products.
- Landlord decision inbox and landlord analytics inbox overlap in purpose but use different shapes.
- Contractor portal has work-order/message projections but no notification/read-state abstraction.
- Archive and mute state do not exist as a unified concept.

## Current Frontend Findings

Existing frontend consumers include:

- `rentchain-frontend/src/api/eventsApi.ts`: generic recent/property/tenant/application event fetching from `/events`.
- `rentchain-frontend/src/api/timelineApi.ts`: admin timeline client for `/timeline`.
- `rentchain-frontend/src/api/messagesApi.ts`: landlord and tenant conversation clients.
- `rentchain-frontend/src/components/timeline/Timeline.tsx`: generic timeline renderer grouped by date buckets.
- `rentchain-frontend/src/features/automation/timeline/*`: automation timeline types, normalizers, analytics, and page.
- Tenant, landlord, contractor pages consume role-specific APIs rather than a unified inbox API.

Frontend gaps:

- No single role-aware inbox item type exists in frontend types.
- Timeline rendering is available, but inbox-specific read/archive/action controls are not generalized.
- Real-time listeners were not identified as the current inbox delivery pattern. Current behavior is REST/derived feed oriented.

## Storage Findings

Append-safe or separate-state patterns already exist:

- `canonicalEvents`, `events`, and `auditEvents` are append-only in Firestore rules.
- `tenantNotificationReads`, `tenantMessageReads`, `tenantMaintenanceReads`, and `tenantScreeningReads` store read state outside source records.
- Contractor status updates append `workOrderUpdates` records.
- Canonical audit helpers use create-style append behavior where available.

Gaps:

- There is no landlord unified inbox read/archive state.
- There is no contractor unified inbox read/archive state.
- There is no common safe event ID or source reference generator for inbox items.
- Existing Firestore rules do not explicitly define future `unifiedInboxState` collections.

## Event Types Observed

Observed domains and categories:

- application submitted/review status
- screening consent/status/manual review/completion
- lease created/activated/signing/notice/renewal/payment-adjacent states
- maintenance request created/status/assignment/completion
- landlord-tenant message
- contractor work-order message/status update
- tenant document checklist
- identity verification status
- tenant invite redeemed
- decision inbox item/workflow state
- admin alert/SLA/triage/portfolio score notification
- canonical audit/timeline event
- registry/activation/billing/pricing analytics event

## Recommended Source Mapping

| Future inbox sourceKind | Preferred current source |
| --- | --- |
| `tenant.message` | Tenant message feed and `messages` conversation projection |
| `tenant.maintenance` | Tenant maintenance feed and `maintenanceRequests` |
| `tenant.screening` | Tenant screening feed and `screening_requests` |
| `tenant.lease` | Tenant profile lease projection |
| `tenant.application` | Tenant profile/application projection |
| `tenant.notice` | `tenantNotices` and notice read state |
| `landlord.application` | `deriveLandlordInbox` and review summary |
| `landlord.screening` | `deriveLandlordInbox`, screening events route |
| `landlord.lease` | Decision inbox lease lifecycle decisions and review timeline |
| `landlord.maintenance` | Maintenance requests and review timeline |
| `landlord.message` | Landlord messages conversation projection |
| `contractor.work_order` | Contractor portal work-order projection |
| `contractor.message` | Contractor portal message projection |
| `admin.notification` | Admin notification derivation, if admin is included in a later phase |

## Blockers Before Data Layer Implementation

1. Decide whether the first implementation includes all three roles or starts with tenant and landlord only.
2. Define safe deterministic ID and safe source reference helpers for inbox items.
3. Decide storage model for read/archive/mute state.
4. Decide whether `/api/tenant/messages` and `/api/tenant/notifications` remain separate or become source adapters for `/api/tenant/inbox`.
5. Resolve route overlap between tenant event route files before relying on tenantEvents as a canonical source.
6. Decide whether landlord analytics inbox or decision inbox is the primary landlord action source.
7. Define contractor read state and action routing before exposing contractor unified inbox.

## Recommended Next Mission

`feat/unified-inbox-data-layer-v1`

Recommended first scope:

- Add pure adapter functions that transform existing tenant notification/message sources, landlord inbox items, and contractor work-order messages into the canonical inbox event shape.
- Add tests for role projection safety and deterministic ordering.
- Do not add real-time delivery, archive/mute persistence, or new UI until projection adapters are proven safe.
