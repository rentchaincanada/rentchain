# ADR-002: Canonical state and projections

Status: Accepted as current-state documentation

## Decision

Lease/occupancy authority is computed by
`canonicalLeaseOccupancyState.ts`. Explicit lease start is governed by the
lease-start transaction. Bounded corrections are governed by the occupancy
resolution service. Signing/execution authority is the transactional signing
request/event/lease projection contract in `leaseSigningService.ts`.

Standalone unit state, embedded property-unit state, tenant relationship fields,
API responses, dashboards, and UI state are projections. Their consistency is
required, but their presence does not make them independent authority.

## Current invariants

- Passive expiry does not make a unit vacant.
- A legacy `active` status cannot override a past term.
- Draft leases cannot drive active occupancy.
- Multiple-current and context mismatch states fail closed.
- A stale signed event cannot force current execution state.
- A draft or unsigned source cannot be presented as the signed document.

## Frontend gap

Several frontend helpers still infer authority from `documentUrl`,
`signatureStatus`, execution status, or legacy signing status. These are bounded
for P0-02 in the machine-readable inventory. This ADR does not change them.
