# ADR-001: Authority classification

Status: Accepted for P0-01 documentation

## Decision

Every material state representation in the P0 inventory uses exactly one of:

- **AUTHORITATIVE** — RentChain-controlled current domain truth.
- **DERIVED** — deterministically computed from authority.
- **PROJECTION** — persisted or rendered consumer representation.
- **CACHE** — replaceable performance copy without independent authority.
- **LEGACY** — compatibility representation forbidden from overriding canonical
  authority.
- **EXTERNAL** — third-party state or evidence requiring normalization and a
  governed RentChain transition.

Mixed records are classified by field group. Classification does not by itself
grant write authority; writers and transitions are listed separately.

## Consequences

The inventory can be consumed by later certification tooling. Unknown ownership
must remain visible and cannot be converted into an engineering assumption.
