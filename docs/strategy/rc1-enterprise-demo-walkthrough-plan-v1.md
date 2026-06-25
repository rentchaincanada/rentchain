# RC1 Enterprise Demo Walkthrough Plan v1

Branch: `docs/rc1-enterprise-demo-readiness-plan-v1`
Scope: demo planning only; no product implementation.

## Purpose

This walkthrough defines the RC1 enterprise demo structure for a large operator evaluating whether to pilot one building on RentChain.

The demo must be honest: show what is working today, identify what needs polish before the demo, and label roadmap capabilities clearly.

## Demo 1: Landlord -> PM Company -> Staff Assignment

### Demo-Ready Today

- landlord searches for an active PM company
- landlord creates pending relationship
- PM Company Admin accepts relationship
- relationship becomes active
- PM Company Admin creates staff assignment
- assignment lifecycle preserves history
- PM company user remains non-landlord

### Needs Polish Before Demo

- email notifications
- assignment grouping by staff user
- relationship and assignment timeline
- mobile scanability
- empty-state clarity

### Roadmap, Not Current Functionality

- contractor organization integration
- custom permission builder
- billing delegation
- broad enterprise organization hierarchy

## Demo 2: Lease Renewal -> Renewal Decision -> Vacancy Visibility

### Demo-Ready Today

- lease and renewal-related surfaces exist
- portfolio health and lease workflows contain renewal signals

### Needs Polish Before Demo

- route/navigation visibility audit
- clearer renewal work queue
- explicit renewal states
- connection from declined/non-renewed lease to pending vacancy

### Roadmap, Not Current Functionality

- complete renewal-to-public-listing automation
- vacancy publishing feed
- public inquiry intake

## Demo 3: Application -> Screening Readiness -> Lease

### Demo-Ready Today

- application foundations exist
- screening strategy and consent boundaries are documented
- lease workflow foundations exist

### Needs Polish Before Demo

- manual screening readiness audit
- application-to-lease handoff audit
- clear demo copy for manual review state

### Roadmap, Not Current Functionality

- automated screening dispatch as a complete production add-on
- autonomous screening decisions
- raw provider report exposure

## Demo 4: Lease Signing -> Tenant Portal -> View Signed Lease

### Demo-Ready Today

- lease signing and tenant portal paths exist
- signed lease viewing can work when provider/storage lifecycle is healthy

### Needs Polish Before Demo

- signed-document and cancelled-state hardening
- missing-document UI state
- no broken generic fallback
- consistent landlord and tenant signed-document visibility

### Roadmap, Not Current Functionality

- enterprise document package export
- bulk lease execution orchestration

## Demo 5: Maintenance / Work Order -> Evidence / Audit

### Demo-Ready Today

- operations and maintenance-related surfaces exist
- evidence/audit foundations exist

### Needs Polish Before Demo

- workflow continuity audit from work order to evidence
- contractor and invoice/expense boundary clarity
- demo-safe data that shows operational history without private leakage

### Roadmap, Not Current Functionality

- contractor organization model
- invoice/payment export automation
- enterprise audit console

## Demo Safety Rules

- Do not demo unsupported PAD automation as current.
- Do not demo automated screening as current.
- Do not demo vacancy API/public listings as current.
- Do not expose raw internal IDs.
- Do not use production customer data.
- Use one-building pilot framing.
- Label roadmap capabilities explicitly.

## Recommended Demo Sequence

1. Governance: landlord, PM company, staff assignment.
2. Revenue risk: renewal and vacancy visibility.
3. Leasing: application, screening readiness, lease.
4. Evidence: signed lease and tenant portal.
5. Operations: maintenance/work order and audit trail.

## Acceptance Criteria

- demo can be run without overclaiming enterprise completeness
- every roadmap item is marked as roadmap
- every current capability has a safe path and safe data
- gaps are tied to RC1 missions
