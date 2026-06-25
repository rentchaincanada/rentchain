# Lease-Up And Renewal Pipeline Strategy v1

Branch: `docs/strategic-execution-plan-enterprise-readiness-v1`
Scope: strategic audit and planning only; no route or UI implementation.

## Strategic Frame

The renewal pipeline is strategic. It is not just a page.

For enterprise landlords, renewal decisions create downstream revenue and operational consequences:

```text
Renewal -> Vacancy -> Listing -> Inquiry -> Application -> Screening -> Approval -> Lease -> Occupancy -> Operations
```

RentChain should treat this as a revenue lifecycle.

## Current Route Visibility Finding

The mission prompt notes that `/lease-renewal` visibility appears to have been reduced or removed after Dashboard V2.0 changes.

Current code audit finding:

- no standalone `/lease-renewal` route was found in `rentchain-frontend/src/App.tsx`
- renewal work appears through `/portfolio-health?entry=lease-renewals`
- lease-specific renewal workflows appear through `/leases/:leaseId/workflows/renewal`
- dashboard and decision surfaces link to portfolio health or lease workflows for renewal review

This may be a valid product architecture, but it means the renewal workflow is not currently visible as a first-class route named `/lease-renewal`.

## Required Audit Mission

Next mission:

```text
audit/lease-renewal-route-visibility-v1
```

Audit questions:

1. Should renewal have a first-class route?
2. Should `/lease-renewal` redirect to `/portfolio-health?entry=lease-renewals`?
3. Should Account, Dashboard, Operations, or Leases navigation expose renewal review more clearly?
4. Did Dashboard V2.0 reduce visibility of a revenue-critical workflow?
5. What is the canonical renewal source of truth?

## Pipeline Model

### Renewal Decision

Renewal review should capture:

- lease end date
- notice timing
- tenant response
- renewal offer terms
- landlord decision
- move-out or continuation path
- required notices
- audit history

### Vacancy Scheduling

If renewal is declined, non-renewed, or move-out is expected, the system should support:

- pending vacancy date
- unit readiness status
- turnover readiness checklist
- make-ready tasks
- publish eligibility
- landlord approval

### Public Availability

Public availability should be controlled by:

- landlord publish approval
- public-safe unit/property labels
- no tenant PII
- no internal IDs as public labels
- availability date
- rent and unit attributes approved for publication

### Viewing Requests And Applications

Published vacancy should connect to:

- inquiry intake
- viewing requests
- application invitation or intake
- application review status

### Screening

Application review should connect to:

- manual screening
- automated screening add-on when implemented
- applicant consent
- provider handoff where approved
- review result/status

### Lease

Approved applications should connect to:

- lease draft
- lease execution
- signed document storage
- tenant workspace activation
- move-in readiness

### Occupancy And Operations

Executed leases should connect to:

- occupancy state
- rent/payment setup
- maintenance readiness
- tenant portal
- operational timeline

## Strategic Risk

If renewal stays hidden inside portfolio health or analytics surfaces, RentChain risks losing a revenue-critical workflow.

If renewal is implemented as a standalone page without source-of-truth discipline, RentChain risks duplicate state and inconsistent vacancy/lease outcomes.

The safest next step is audit before implementation.

## Recommended Next Missions

1. `audit/lease-renewal-route-visibility-v1`
2. `audit/vacancy-publishing-source-of-truth-v1`
3. `feat/renewal-decision-to-vacancy-pipeline-v1`
4. `feat/viewing-request-intake-v1`
5. `feat/application-to-screening-to-lease-workflow-v1`

## Non-Goals

- no route changes in this document
- no new vacancy API implementation
- no public listing implementation
- no screening automation
- no lease workflow mutation
