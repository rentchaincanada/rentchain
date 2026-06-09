# Unified Inbox Implementation Guardrails

## Scope Boundary

The first unified inbox implementation should be a read-model layer. It should derive role-safe inbox items from existing sources and return them through role-specific endpoints. It should not mutate source records, introduce background jobs, change auth middleware, or create a new event source of truth.

## Required Endpoints

Future endpoints should be role-specific and fail closed.

| Endpoint | Required role | Scope resolution |
| --- | --- | --- |
| `GET /api/tenant/inbox` | tenant | Resolve tenant workspace context server-side from authenticated user. |
| `GET /api/landlord/inbox` | landlord | Resolve landlord ID server-side from authenticated user. |
| `GET /api/contractor/inbox` | contractor | Resolve contractor ID server-side and require self-scope. |

Optional future state endpoints:

- `POST /api/tenant/inbox/:id/read`
- `POST /api/landlord/inbox/:id/read`
- `POST /api/contractor/inbox/:id/read`
- archive/mute endpoints only after storage and audit semantics are approved

## Fail-Closed Authorization

Implementation must reject:

- missing authenticated user
- role mismatch
- tenant inbox requests without tenant workspace identity
- landlord inbox requests without landlord scope
- contractor inbox requests where requested contractor ID differs from authenticated contractor ID
- cross-landlord property, unit, lease, application, maintenance, or screening references
- tenant access to landlord-only notes, admin/support metadata, or provider payloads
- contractor access to tenant application, screening, lease, payment, notice, or document details outside assigned work-order context

## Source Adapter Pattern

Each source should have a pure adapter:

```text
source record + authorized context -> UnifiedInboxEvent | null
```

Adapters must:

- accept already authorized source records
- return null when the record cannot be safely projected
- emit only allowlisted fields
- generate deterministic safe IDs
- include metadata safety flags
- avoid side effects

Adapters must not:

- fetch unrelated data implicitly
- trust client-provided landlord, tenant, contractor, property, unit, lease, or work-order IDs as authority
- return raw provider payloads
- return private notes unless the audience is explicitly allowed to see them
- mutate read/archive/mute state

## Recommended Adapter Modules

Suggested future modules:

- `rentchain-api/src/services/unifiedInbox/types.ts`
- `rentchain-api/src/services/unifiedInbox/safeInboxReferences.ts`
- `rentchain-api/src/services/unifiedInbox/tenantInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/landlordInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/contractorInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/deriveUnifiedInbox.ts`

## Safe ID Rules

Inbox IDs must be deterministic and non-revealing.

Recommended format:

```text
inbox_v1_<role>_<hash(sourceKind, sourceStableKey, audienceScopeKey)>
```

Do not use raw Firestore document IDs as user-facing IDs. Raw IDs may be used internally only before hashing or safe reference generation.

## Metadata Safety Flags

Every item should include:

```json
{
  "rawIdsIncluded": false,
  "tokensIncluded": false,
  "secretsIncluded": false,
  "providerPayloadIncluded": false,
  "storagePathIncluded": false,
  "privateNotesIncluded": false
}
```

Any adapter unable to guarantee these flags must return null or mark the item blocked for internal diagnostics only.

## Role Whitelist Rules

### Tenant

Allowed:

- status labels for own application, lease, screening, maintenance, notices, and messages
- tenant-safe title and summary
- safe tenant workspace route
- source category and timestamp
- read state

Denied:

- landlord notes
- contractor notes not intended for tenant
- admin/support metadata
- screening report payloads
- storage paths
- raw IDs
- private policy and decision internals

### Landlord

Allowed:

- landlord-owned application, lease, screening, maintenance, message, and decision descriptors
- safe tenant readiness summaries already available to landlord
- safe routes to existing landlord review pages
- action labels and priorities

Denied:

- admin-only review state
- tenant private document bodies outside landlord-safe projections
- raw provider payloads
- unrelated contractor message threads
- cross-landlord records

### Contractor

Allowed:

- assigned work-order status, priority, due/scheduled labels
- property/unit labels already available in contractor projection
- contractor message text for assigned work orders
- status history for assigned work orders

Denied:

- tenant screening, applications, notices, payments, documents
- lease details beyond safe property/unit/work-order context
- landlord portfolio internals
- messages not tied to assigned work orders

## State Storage Guardrails

Read/archive/mute state must be separate from source records.

Allowed future state record shape:

```json
{
  "schemaVersion": "unified_inbox_state.v1",
  "audienceRole": "tenant",
  "audienceScopeKey": "safe_scope",
  "inboxEventId": "safe_event_id",
  "readAt": "ISO timestamp or null",
  "archivedAt": "ISO timestamp or null",
  "mutedUntil": "ISO timestamp or null",
  "updatedAt": "ISO timestamp"
}
```

State writes must:

- validate audience role and scope server-side
- use merge semantics only on state records
- never update source events
- never update canonical audit events
- avoid storing raw source IDs as document labels

## Ordering and Pagination Guardrails

Pagination cursor should be opaque and encode:

- `occurredAt`
- `inboxEventId`

Cursor must not encode raw source IDs or role ownership IDs in readable form.

Sorting should be deterministic:

1. unread before read
2. priority rank
3. occurredAt descending
4. inboxEventId ascending

## Testing Requirements For Implementation

Future implementation PRs should include:

- tenant projection tests proving landlord notes, raw IDs, provider payloads, and admin metadata are excluded
- landlord projection tests proving cross-landlord records are excluded
- contractor projection tests proving only assigned work-order records appear
- deterministic ID tests
- ordering and pagination tests
- read-state tests proving source records are not mutated
- route tests for 401 unauthenticated, 403 wrong role, 404/empty for inaccessible source where appropriate

## Firestore Rules Considerations

Do not rely on client-side Firestore reads for unified inbox v1. Server routes should enforce authorization and projection.

If state collections are added later, rules should:

- allow role owners to read only their own state documents
- allow creates/updates only for authenticated owners of the state scope
- deny delete except admin if deletion is ever required
- deny any source event mutation through inbox state paths

## Realtime Delivery

Realtime delivery is out of scope for the first implementation.

Acceptable v1 delivery:

- REST polling
- manual refresh
- request-time derivation

Deferred:

- WebSocket delivery
- server-sent events
- Firestore client listeners
- background fan-out
- scheduled digest delivery

## Manual Review Boundary

The unified inbox may route users to existing review pages. It must not trigger:

- lease signing
- notice sending
- payment collection
- screening submission
- contractor assignment
- provider calls
- external export
- legal certification

All high-impact actions remain manual and policy guarded in their existing workflows.

## Implementation Recommendation

Start with pure adapter functions and tests before adding routes. Once adapters pass projection and authorization tests, add one endpoint at a time in this order:

1. tenant inbox from existing tenant notifications and tenant messages feed
2. landlord inbox from existing landlord analytics inbox and decision inbox
3. contractor inbox from assigned work orders and contractor messages

Do not introduce shared persistence until the derived read model is stable.
