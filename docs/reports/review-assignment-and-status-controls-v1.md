# Review Assignment and Status Controls v1

## Executive Summary

This mission introduces the first manual assignment and review-status control surface for governed review workspaces and the operational review queue.

The implementation is intentionally UI-foundational and manual-only. It does not create review workspaces, persist assignment changes, auto-route work, mutate source records, or alter financial state. It provides deterministic operator-facing metadata controls that prepare the interface for future audited review-session writes.

## Scope

Covered surfaces:

- Operational review queue cards on `/operations`
- Review workspace readiness panels on `/operations`

Out of scope:

- Autonomous assignment
- Autonomous routing
- Auto-resolution
- Financial mutation
- Tenant-visible review internals
- Institutional sharing
- Firestore schema changes
- Auth or route behavior changes

## Manual Assignment Metadata

The UI exposes deterministic assignment choices:

- Unassigned
- Operations owned
- Property manager
- Finance reviewer
- Document reviewer
- Screening reviewer

These values are display metadata only in this phase. They are not written to `operatorReviewSessions`, decision records, financial records, or source workflow records.

## Review Status Semantics

The UI exposes deterministic review lifecycle states:

- Open
- Needs review
- In review
- Awaiting information
- Blocked
- Resolved
- Closed

These statuses describe manual review handling only. They do not change financial status, workflow truth, tenant-facing state, or source records.

## Governance Guarantees

The control surface preserves:

- Landlord/admin operational context only
- Manual-only handling
- Operational vs financial status separation
- Scoped evidence/resource link display
- No tenant-visible review internals
- No autonomous action controls
- No broad visibility changes

## Future Work

Future missions can safely add:

- Persisted assignment metadata on governed review sessions
- Append-only assignment/status audit events
- Server-side status transition validation
- Review workspace ownership views
- Controlled escalation handoff metadata

Those missions should continue to preserve manual-only behavior until an explicit governed automation design is approved.
