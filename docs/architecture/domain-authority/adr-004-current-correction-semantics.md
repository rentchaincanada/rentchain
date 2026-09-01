# ADR-004: Current correction and supersession semantics

Status: Current state recorded; future semantics are OPEN_DECISION

## Current mechanisms

| Domain | Demonstrated correction mechanism |
| --- | --- |
| Lease/occupancy | Expected-state-guarded resolution, idempotency, atomic projection updates, canonical resolution event |
| Explicit start/renewal | Transactional transition across lease, tenancy, tenant, standalone unit, and embedded unit |
| Signing | Transactional request/event/lease projection update; stale chronology rejected |
| Tenant relationship | Evidence-bounded status reconciliation with canonical event |
| Screening | Orchestrator/reconciliation updates plus screening event history |
| Payments | Provider receipt normalization and reconciliation records; obligation view is derived |
| Notices/communications | Mutable delivery attempt state plus legacy/canonical audit emission where implemented |
| Maintenance | Direct workflow-state updates with work-order update/audit records |
| Evidence | Append-oriented manifest, provenance, hash, and attestation records; supersession metadata where supported |

## Open boundary

The repository does not yet define one platform-wide immutable correction,
supersession, or replay contract. P0-01 intentionally does not invent one.
Future event-ledger work requires explicit product, architecture, and legal
decisions before standardizing these semantics.
