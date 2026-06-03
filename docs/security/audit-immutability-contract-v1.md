# Audit Immutability Contract v1

## Goals

This contract defines how RentChain audit and event records should behave when they are used as governance evidence. The goal is a clear append-only posture: audit records are created once, never overwritten, never patched, and never deleted by product flows.

This document is a contract and verification reference only. It does not change Firestore rules, indexes, route behavior, write helpers, deployment configuration, dependencies, or production data.

## Current State

RentChain currently has one strong canonical audit helper and several older append-like writers. The strongest path is `appendCanonicalAuditEvent`, which writes to `canonicalEvents`, marks records `metadataOnly`, `appendOnly`, `immutable`, and `rawIdsIncluded: false`, and uses `create()` when available. If `create()` is unavailable, it checks for an existing document before calling `set(..., { merge: false })`.

Older audit/event collections are append-like by convention but do not share one formal helper contract. Some use auto-generated document IDs through `add()` or `doc()` plus `set()`. One event dispatcher path writes deterministic event IDs with `set(..., { merge: true })`, which is useful for idempotent event persistence but is only partial immutability because it can patch an existing event document.

## Contract

Audit immutability means:

- Creation is the only product write operation allowed for an audit record.
- Product code must not call `update()` or `delete()` on audit collections.
- Product code must not overwrite an existing audit record.
- `create()` is preferred for deterministic IDs.
- `add()` is acceptable for auto-ID append-like records when the caller never reuses the document ID.
- `set(..., { merge: false })` is acceptable only when paired with deterministic uniqueness or an existence precheck.
- `set(..., { merge: true })` is partial compliance and must be documented as a mutation risk.
- Audit records must preserve creation time, actor context, resource context, and redaction posture.
- Audit reads must remain scoped by role and resource authority.

## Collection Contract Table

| Collection | Current writers | Current semantics | Compliance | Exceptions |
| --- | --- | --- | --- | --- |
| `canonicalEvents` via `appendCanonicalAuditEvent` | `reviewStateTransitionAudit`, recovery intent service, landlord operator review route | `create()` where available; fallback existence precheck plus `set(..., { merge: false })` | Full for this helper path | Safe wrapper may skip append on storage failure rather than failing caller |
| `canonicalEvents` via `writeCanonicalEvent` | screening, lease, maintenance, alerting, analytics, policy, support, work order, rental application, payment, sharing-room paths | `set(..., { merge: false })` with no existence precheck | Partial | Deterministic ID collisions would overwrite, though most calls use generated IDs |
| `canonicalAuditEvents` | None found in current source | No active writer found | None / absent | Mission-listed collection name is not implemented; canonical audit records currently share `canonicalEvents` |
| `events` | `auditEventsService`, `auditEventService`, event dispatcher, payment/ledger/tenant/workflow services, tenant and debug event routes | Mixed `doc().set()`, deterministic `doc(id).set(..., { merge: true })`, and `add()` | Partial | Event dispatcher uses merge semantics; route-level audit reads depend on mount order and global auth decode |
| `adminAuditEvents` | admin audit event service from admin saved filters, tenants, leases, properties, integrity, overview paths | `add()` with auto-generated document ID | Partial | Append-like by convention, not protected by canonical helper or Firestore rules |
| `registryAuditLog` | registry audit service and registry import service batch writes | `add()` and `batch.set(doc(), auditDoc)` | Partial | Append-like by convention, not protected by canonical helper or Firestore rules |
| `ledgerEvents` and `ledgerEventsV2` | ledger, dashboard, payment, and reporting paths | Event-like writes and reads with index support | Partial | Included as operational event evidence, but outside the primary Phase 3 audit helper contract |

## Access Control And Projection Safety

Admin audit reads use `GET /api/admin/audit` and require both `requireAuth` and `requirePermission("system.admin")`. The admin audit view returns sectioned summaries for admin actions, administrative data downloads, integrity events, and saved-filter activity. It does not return unrestricted Firestore documents.

General audit event routes are mounted after global JWT decoding in `app.build.ts`. The individual handlers in `auditEventsRoutes.ts` do not add route-level `requireAuth` or permission checks. This is a documented gap: future work should either add explicit route guards or document why the global mount order is sufficient for each route.

Landlord and tenant visibility must remain scoped by resource context. Landlord-facing audit reads should require landlord authority and filter by landlord-owned property/application context. Tenant-facing reads should be limited to records directly involving that tenant. Admin/support-only audit metadata must not be shown to tenant, landlord, public, or user-safe output surfaces.

Canonical audit records use metadata-only and unredacted-identifier-excluded markers. Older audit/event collections may contain broader payload fields and should be treated as internal unless a route applies explicit allowlist projection and resource-scope checks.

## Risks

- Older collections do not uniformly use the canonical append helper.
- Firestore rules in `rentchain-api/firestore.rules` are fail-closed, but no production immutability-specific rule is added by this mission.
- `events` has one merge-based dispatcher path, which means a repeated deterministic event ID can patch an existing record.
- General event read routes have weaker visible route-level guards than admin audit routes.
- Existing indexes support timestamp and scope queries, but indexes do not enforce immutability.

## Roadmap

Future implementation work should strengthen immutability in this order:

1. Add verification-only monitoring that reports suspicious update/delete patterns without changing writes.
2. Normalize new audit writes through canonical append helpers or require an explicit exception note.
3. Add Firestore rules or service-layer guards after a migration plan confirms existing write paths will not be blocked.
4. Add optional cryptographic integrity checks only after the append-only service contract is stable.
