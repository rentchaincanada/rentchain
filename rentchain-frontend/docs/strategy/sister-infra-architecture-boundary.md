# Sister Infrastructure Architecture Boundary

Related docs:
- [Sister Infrastructure MVP v1](./sister-infra-mvp-v1.md)
- [Naming Risk and Domain Strategy](./sister-infra-naming-risk.md)

## Separation of Concerns

```text
RentChain SaaS (Workflow App)
  - applications, leases, payments, operations
  - user-facing account and workflow UI
  - consent capture and workflow controls
            |
            | controlled export / adapter boundary
            v
Sister Infrastructure Module/Service
  - normalized records and attestations
  - partner integration interfaces
  - verification package assembly
            |
            v
Partner Systems
  - read/verify allowed record sets
  - consume package outputs under policy
```

## Data Boundary Rules (PII Minimization)

- Transfer only fields needed for the intended verification purpose.
- Keep direct identifiers to the minimum required for matching.
- Prefer reference identifiers over full raw source payloads.
- Do not share internal secrets, credentials, or internal-only metadata.
- Retention and deletion rules must be documented per exported record type.

## Operational Boundary Rules

- SaaS workflows remain the source of truth for user actions.
- Infrastructure service consumes normalized events and approved record exports.
- No hidden bidirectional write path from partner systems into SaaS core data.
- All cross-boundary actions require explicit policy checks and auditability.

## Phase Plan

### Phase 1: Internal Module

- Implement as internal module inside existing backend boundary.
- Validate normalized model and package format with pilot partners.
- Prove consent and retention enforcement in real workflows.

### Phase 2: Separate Service

- Extract adapter and package generation into isolated service boundary.
- Introduce separate deployment lifecycle and service ownership.
- Maintain contract compatibility with internal clients.

### Phase 3: Commercialization

- Publish partner onboarding documentation and SDK examples.
- Introduce usage metering and partner SLA policies.
- Add enterprise compliance reporting and audit export controls.
