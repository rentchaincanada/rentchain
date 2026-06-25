# RC1 Mission Queue v1

Branch: `docs/rc1-enterprise-demo-readiness-plan-v1`
Scope: mission sequencing only; no implementation authorization.

## Queue Rule

RC1 missions should prepare RentChain for enterprise demo readiness and one-building pilot validation.

Every implementation mission must pass the Enterprise Validation Phase filter:

- Does it advance revenue?
- Does it improve operational efficiency?
- Does it increase enterprise readiness?
- Does it support customer validation?

If not, challenge it before implementation.

## A. Audit / Planning

### `audit/lease-renewal-route-visibility-v1`

Issue: #1243

Scope:

- audit current renewal route/navigation visibility
- confirm whether `/lease-renewal` should exist, redirect, or remain retired
- define renewal source of truth
- connect renewal to vacancy and lease-up pipeline

### `audit/rc1-workflow-continuity-v1`

Issue: #1251

Scope:

- audit handoffs across PM company, lease, renewal, vacancy, application, screening, signing, tenant portal, maintenance, payment, evidence, and audit
- assign risk and next missions

### `audit/pm-company-mobile-ux-v1`

Scope:

- audit PM Company mobile layout and action reachability
- review relationship, assignment, history, and confirmation surfaces

### `audit/lease-document-lifecycle-v1`

Scope:

- audit signed/cancelled/missing document lifecycle
- verify landlord and tenant document visibility
- identify provider/storage state gaps

## B. Polish / Hardening

### `feat/property-manager-company-email-notifications-v1`

Issue: #1232

Scope:

- lifecycle notifications for landlord and PM company relationship/assignment changes
- failed email dispatch must not block state changes

### `fix/lease-signed-document-retrieval-and-cancelled-state-v1`

Issue: #1233

Scope:

- harden View Lease and signed/cancelled document states
- avoid broken fallback
- show unavailable/admin-review states

### `feat/delegated-access-mobile-information-architecture`

Issue: #1221

Scope:

- improve delegated access mobile scanability
- preserve history and audit visibility

### `feat/property-manager-company-assignment-grouping-v1`

Issue: #1252

Scope:

- group assignments by user, relationship, and status
- improve landlord and company-admin scanning

### `feat/property-manager-company-timeline-history-v1`

Issue: #1253

Scope:

- relationship and assignment lifecycle timeline
- status transition history
- metadata-only audit references

### `fix/lease-renewal-navigation-visibility-v1`

Scope:

- implement the outcome of `audit/lease-renewal-route-visibility-v1`
- improve renewal discovery from the selected source-of-truth surfaces

## C. Demo Readiness

### `docs/enterprise-demo-script-v1`

Issue: #1254

Scope:

- one-building pilot demo script
- current capability vs roadmap language
- safe demo data checklist

### `feat/demo-safe-enterprise-seed-data-v1`

Scope:

- demo-safe fixture data if needed
- no production customer data
- deterministic setup and cleanup

This mission should only proceed if existing demo data is insufficient.

### `docs/jl-one-building-pilot-readiness-v1`

Issue: #1255

Scope:

- pilot readiness checklist
- what to ask the enterprise operator
- what would block one-building adoption

## Dependency Order

1. `audit/lease-renewal-route-visibility-v1`
2. `audit/rc1-workflow-continuity-v1`
3. `audit/pm-company-mobile-ux-v1`
4. `audit/lease-document-lifecycle-v1`
5. `feat/property-manager-company-email-notifications-v1`
6. `fix/lease-signed-document-retrieval-and-cancelled-state-v1`
7. `feat/property-manager-company-assignment-grouping-v1`
8. `feat/property-manager-company-timeline-history-v1`
9. `fix/lease-renewal-navigation-visibility-v1`
10. `docs/enterprise-demo-script-v1`
11. `docs/jl-one-building-pilot-readiness-v1`

## Non-Goals

- no PAD implementation in RC1 planning
- no screening automation implementation in RC1 planning
- no vacancy API implementation in RC1 planning
- no contractor organization work
- no billing delegation
- no broad enterprise layer implementation

## Readiness Gate

RC1 is ready for demo rehearsal when:

- PM Company relationship and assignment flows are polished enough to demo
- lease document failure states are hardened
- renewal visibility is clear
- core handoffs have risk ratings and mission owners
- demo script clearly marks roadmap vs current functionality
