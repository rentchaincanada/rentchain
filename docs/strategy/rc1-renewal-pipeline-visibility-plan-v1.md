# RC1 Renewal Pipeline Visibility Plan v1

Branch: `docs/rc1-enterprise-demo-readiness-plan-v1`
Scope: planning only; no route, navigation, lease, vacancy, application, or screening implementation.

## Purpose

Renewal visibility is a revenue workflow risk. RC1 should clarify where renewal belongs and how it connects to vacancy, listing, inquiry, application, screening, lease, occupancy, and operations.

## Current Visibility Finding

The existing enterprise strategy notes that `/lease-renewal` visibility appears hidden or reduced after Dashboard V2.0 changes.

Current strategy docs indicate:

- no standalone `/lease-renewal` route was found during prior audit
- renewal work appears through portfolio health and lease-specific renewal workflows
- this may be valid, but it weakens renewal as a first-class revenue workflow if users cannot find it

RC1 should audit route, navigation, and workflow visibility before implementation.

## Where Renewal Should Surface

Renewal should be discoverable from:

- Dashboard
- Operations
- Leases
- Properties / Units

Each surface should serve a distinct purpose:

- Dashboard: urgent renewal decisions and portfolio summary
- Operations: work queue and follow-up
- Leases: lease-specific lifecycle and document context
- Properties / Units: unit availability, occupancy, and pending vacancy context

## Key Renewal States

RC1 should define or audit support for:

- expiring soon
- renewal notice pending
- renewal sent
- tenant accepted
- tenant declined
- vacancy scheduled

States should be source-of-truth aligned and must not duplicate lease status in a separate uncontrolled store.

## Lease-Up Pipeline Connection

Renewal should connect to:

```text
Renewal -> Vacancy -> Listing -> Inquiry -> Application -> Screening -> Lease
```

For RC1, the priority is visibility and source-of-truth readiness, not implementing the full pipeline.

## Audit Questions

1. Should `/lease-renewal` exist as a route, redirect, or be retired?
2. Is renewal currently discoverable by a landlord operator without knowing the URL?
3. Did Dashboard V2.0 remove or hide a revenue-critical path?
4. Which object owns renewal state: lease, unit, property, portfolio health, or operations queue?
5. When a tenant declines or renewal is not offered, where is vacancy scheduled?
6. What should be shown when renewal data is absent?
7. What is the safe public boundary for later vacancy publishing?

## Suggested Mission

```text
audit/lease-renewal-route-visibility-v1
```

## Acceptance Criteria For RC1

- renewal canonical path is documented
- visibility gaps are identified
- no duplicate state model is introduced
- next implementation mission is scoped
- renewal is explicitly connected to vacancy and lease-up strategy
