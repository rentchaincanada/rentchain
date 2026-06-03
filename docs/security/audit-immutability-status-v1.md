# Audit Immutability Status v1

## Goals

This status audit records the current write paths, mutation risks, and safety level for RentChain audit and event collections. It is source-aligned documentation only and does not change runtime behavior.

## Current State

The audit landscape has five primary implemented collections for this mission: `canonicalEvents`, `events`, `adminAuditEvents`, `registryAuditLog`, and ledger-style operational event collections. The mission-listed name `canonicalAuditEvents` was not found in the current source tree; canonical audit records currently share `canonicalEvents`. The current strongest immutability semantics are in `appendCanonicalAuditEvent`; older paths are append-like but not uniformly enforced.

## Collection Status

### `canonicalEvents`

`appendCanonicalAuditEvent` writes canonical audit records into `canonicalEvents`. It builds safe references, marks records `metadataOnly`, `appendOnly`, `immutable`, and `rawIdsIncluded: false`, and writes with `create()` where available. Its fallback checks document existence before `set(..., { merge: false })`. `appendCanonicalAuditEventSafely` catches storage errors and logs a skipped append rather than failing the caller.

`writeCanonicalEvent` also writes to `canonicalEvents`. It builds a canonical event and writes `doc(event.id).set(event, { merge: false })`. It does not precheck for existing documents, so it is partial compliance. Generated IDs reduce collision risk, but callers that supply a repeated ID could overwrite an existing canonical event.

Current writers include review state transition audit, recovery intent service, landlord operator review routes, screening orchestration, lease routes, maintenance routes, landlord analytics, policy evaluation, support console, rental applications, work orders, payment flows, and alerting routes.

Safety level: full for `appendCanonicalAuditEvent`; partial for `writeCanonicalEvent`.

### `canonicalAuditEvents`

No active collection, writer, read route, index, or rule reference named `canonicalAuditEvents` was found during the current source audit. This is documented as an absent mission-listed name rather than an implemented collection. Future work should avoid creating a duplicate collection unless it is part of a deliberate audit storage migration.

Safety level: none / absent.

### `events`

`auditEventsService.logAuditEvent` creates a new document reference with `doc()`, then calls `set()` with generated `id`, `createdAt`, and `occurredAt`.

`auditEventService.recordAuditEvent` creates a UUID and writes `collection("events").doc(id).set(full)` with no merge option.

`eventDispatcher.recordDomainEvent` writes deterministic event IDs with `collection("events").doc(docId).set(event, { merge: true })`. This is the most visible mutation risk in the audited event write paths because a repeated event ID can patch the existing event document.

Other `events` collection uses include tenant balance, move-in readiness, plan limits, rent charges, PAP mandate/scheduler routes, monthly charge scheduler routes, debug blockchain routes, admin analytics, subscription conversion views, application conversion, screening, and application routes.

Safety level: partial. The collection is append-like in many writers, but merge-based persistence and route-level reads are not uniformly protected.

### `adminAuditEvents`

`recordAdminAuditEvent` trims required fields and returns without writing when user, label, or action are missing. Valid records are added with `collection("adminAuditEvents").add(...)`, using Firestore auto-generated IDs.

Read access is through `adminAuditRoutes`, which requires `requireAuth` plus `requirePermission("system.admin")`. `loadAdminAudit` reads records and returns sectioned summaries rather than unrestricted Firestore documents.

Current writers include admin saved filters, admin tenants, admin leases, admin properties, admin integrity, and admin overview routes.

Safety level: partial. The path is append-like, admin-gated on reads, and scoped to admin surfaces, but it is not backed by a canonical immutable helper or immutability-specific Firestore rule.

### `registryAuditLog`

`recordRegistryAuditEvent` adds records to `registryAuditLog` with source key, import batch reference, registry record reference, property reference, actor type, event type, compact event data, and creation time.

`registryImportService` also writes registry audit documents through batched `set()` calls on new document references. Registry indexes support queries by registry record, property, import batch, and creation time.

Safety level: partial. The path is append-like and indexed for review, but it is not protected by a canonical immutable helper.

### `ledgerEvents` And `ledgerEventsV2`

Ledger event collections are operational event evidence rather than the primary audit collections for this mission. They have indexes for tenant, property, landlord, event type, and timestamp queries. They should be treated as audit-adjacent and should not be patched by verification tooling.

Safety level: partial and audit-adjacent.

## Mutation Risk Assessment

Known risks found during audit:

- `eventDispatcher.recordDomainEvent` uses `set(..., { merge: true })` on `events`.
- `writeCanonicalEvent` uses `set(..., { merge: false })` but does not precheck for existing documents.
- Older collections use append-like calls but lack one shared helper contract.
- General event read routes do not declare route-level `requireAuth` or `requirePermission` guards.
- Firestore indexes support verification queries but cannot prove immutability by themselves.

No product `update()` or `delete()` calls were identified directly on the mission's primary audit collections during the targeted scan. Broad merge usage exists across many non-audit collections and is out of scope for this mission.

## Authorization And Scope

Admin audit reads are strongest: `GET /api/admin/audit` requires authentication and `system.admin`.

General audit event reads are weaker: recent, tenant, property, and debug relay routes rely on global auth decode because they are mounted after `authenticateJwt`; the route module itself does not require an authenticated user or check landlord/tenant authority.

Canonical audit and canonical event records are read indirectly by admin, analytics, support, reporting, and review surfaces. These should remain internal or route-projected unless a future route adds explicit role and resource-scope checks.

## Index Coverage

`events` has indexes for landlord plus `occurredAt`, property plus `timestamp`, and tenant plus `timestamp`.

`registryAuditLog` has indexes for registry record plus `createdAt`, property plus `createdAt`, and import batch plus `createdAt`.

`ledgerEvents` and `ledgerEventsV2` have indexes for tenant, property, landlord, event type, date, and occurrence time. These are useful for operator review but do not enforce append-only writes.

## Firestore Rules And Local Protection

`rentchain-api/firestore.rules` is fail-closed for all reads and writes. Local development and tests must use the Firestore emulator unless an explicit local override is set. The Firestore guard runs before backend Admin initialization and before direct Firestore clients in identified modules.

## Roadmap

Future work should first add verification-only monitoring for event update/delete patterns. Enforcement should wait until legacy event writers are normalized or explicitly excepted.
