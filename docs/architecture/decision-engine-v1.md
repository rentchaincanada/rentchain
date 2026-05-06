# Decision Engine V1

## Purpose

Decision Engine V1 turns deterministic RentChain signals into structured, auditable decisions.

The layer is read-only in V1:

- no payment behavior changes
- no Stripe or webhook changes
- no Trustly implementation
- no PaymentIntent enforcement
- no lease or payment record mutation
- no automated notices, renewals, collections, or correction workflows

## Source Hierarchy

RentChain keeps the current foundation boundaries intact:

1. Lease lifecycle is the source of truth for whether a lease is current, expiring, expired, terminated, renewed, or in review.
2. PaymentIntent represents the internal obligation.
3. Obligation ledger compares expected rent against execution and reconciliation evidence.
4. Delinquency detection identifies read-only payment problems.
5. Decision Engine maps those signals into reviewable decisions.

## Decision Model

Each decision is deterministic and contains:

- `decisionId`
- lease, property, unit, tenant, PaymentIntent, and rentPayment identifiers where available
- `decisionType`
- `severity`
- `status`
- human-readable `reason`
- `metadata`
- `createdAt`
- `updatedAt`

Decision statuses are:

- `detected`
- `surfaced`
- `reviewed`
- `accepted`
- `dismissed`
- `resolved`

V1 only emits `detected`. Later workflow surfaces can advance the status without mutating source lease or payment records.

## Signal To Decision Mapping

Delinquency signals map as follows:

| Signal | Decision | Severity |
| --- | --- | --- |
| `overdue` | `review_overdue_rent` | `critical` |
| `partially_paid` | `review_underpaid_rent` | `warning` |
| `missing_payment` | `review_missing_payment` | `critical` |
| `failed_payment` | `review_failed_payment` | `critical` |
| `manual_review_required` | `review_manual_payment_issue` | `warning` |

Informational `rent_due` signals do not produce decisions in V1 because they are not problems by themselves.

Lease lifecycle signals map as follows:

| Lifecycle condition | Decision |
| --- | --- |
| `notice_period` and nearing `effectiveEndDate` | `review_expiring_lease` |
| lifecycle reasons include occupancy conflict data | `review_occupancy_conflict` |

## Auditability

Decision IDs are built deterministically from the decision type and source signal or lifecycle context. Running derivation against the same inputs produces the same decision IDs.

The source signal IDs, lifecycle reasons, obligation row IDs, amounts, and due dates remain in metadata so operators can trace why each decision exists.

## No Enforcement Yet

Decision Engine V1 does not:

- send notices
- collect or retry payments
- alter ledger rows
- update lease lifecycle status
- update PaymentIntent status
- create landlord or tenant tasks
- resolve decisions automatically

It prepares an auditable layer for later review and workflow surfaces.

## Decision Context Linking V1

Decision Context Linking V1 makes each visible decision an entry point into the records and evidence that explain it.

The context layer is frontend-readable and non-mutating:

- lease context links to `/leases/:leaseId/summary`
- ledger context links to `/leases/:leaseId/ledger`
- property and unit context links to `/properties` with query parameters where available
- tenant context links to `/tenants` with query parameters where available
- admin lifecycle context links to `/admin/lease-lifecycle-review`

Evidence summaries are derived from existing decision metadata, obligation rows, delinquency signals, and the latest decision action overlay. They can include:

- decision reason
- severity
- related delinquency signal and signal reason
- obligation status
- outstanding amount
- lease lifecycle state and lifecycle reason
- PaymentIntent and rentPayment references
- current status and last action

Missing context is shown as unavailable instead of rendering empty identifiers. Raw internal IDs remain secondary technical references, not the primary display label.

This layer does not add:

- automated actions
- notices
- payment retries
- lease or payment mutations
- decision execution workflows

## Decision Workflow Routing V1

Decision Workflow Routing V1 adds read-only organization metadata to Decision Inbox items. It does not create queues, workers, assignments, notifications, or execution behavior.

Routing is derived deterministically from the normalized decision inbox item and existing analytics workflow category when present. Each item receives:

- `queue`
- `workflowState`
- `ownershipType`
- `reviewPriority`
- `escalationLevel`
- `manualOnly: true`

Supported queues are:

- `lease_review`
- `delinquency_review`
- `screening_review`
- `maintenance_review`
- `compliance_review`
- `admin_review`
- `general_review`

Supported workflow states are:

- `new`
- `triaged`
- `under_review`
- `waiting_context`
- `escalated`
- `resolved`
- `archived`

The landlord Decision Inbox can filter by queue, workflow state, and escalation level. Landlord routes expose only landlord-safe routing metadata and continue to exclude admin-only review data.

This layer does not add:

- workflow-triggered mutations
- autonomous routing
- assignment persistence
- background queue infrastructure
- notification sending
- payment or lease enforcement

## Deferred

1. Decision timeline page.
2. Decision-to-action execution workflows.
3. Automated notices.
4. Institution export of decision packets.
5. Compliance rollup for decision context and evidence.
6. Operator assignment persistence after access and audit boundaries are finalized.
