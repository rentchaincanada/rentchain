# Lease State Machine V1

RentChain lease lifecycle state is derived from lease facts first and stored legacy status second. The V1 rollout is additive: it introduces deterministic lifecycle interpretation without migrating stored `lease.status`, rewriting leases, or enforcing workflow transitions.

## Canonical States

- `draft`: lease exists but has not been sent, signed, or activated.
- `pending_signature`: lease has been sent or prepared, but tenant and landlord signatures are not complete.
- `signed_future`: lease is fully signed and starts in the future.
- `active`: lease is fully signed/current and today is inside the lease term.
- `notice_period`: lease is current, but notice, move-out, or termination intent exists.
- `expired`: lease end date has passed and no signed renewal or successor supersedes it.
- `renewed`: lease has been superseded by a signed renewal or successor lease.
- `terminated`: lease ended early through termination, notice, or agreement.
- `cancelled`: lease was abandoned or cancelled before activation.
- `unknown`: lease data is missing or contradictory enough to require review.

## Derivation Precedence

1. Cancellation facts (`cancelledAt`, cancelled/void status) win first.
2. Effective termination facts (`terminatedAt`, `terminationDate`, terminated status) win before active checks.
3. Signed successor or renewal facts produce `renewed`.
4. Draft-like leases without term dates remain `draft`.
5. Sent but not fully signed leases are `pending_signature`.
6. Fully signed future leases are `signed_future`.
7. Current leases with notice or move-out signals are `notice_period`.
8. Current signed leases are `active`.
9. Past end dates without successor facts are `expired`.
10. Invalid ranges or unsafe contradictions produce `unknown` with `requiresReview`.

Stored `lease.status` remains supported as a legacy hint, but it does not override cancellation, termination, renewal, or end-date facts.

## Occupancy Mapping

- `active` -> `occupied`
- `notice_period` -> `notice_period`
- `signed_future` -> `upcoming`
- `expired`, `terminated`, `cancelled`, `renewed`, draft/no lease -> `vacant`
- `unknown` or review-required lifecycle -> `review_required`

V1 does not mutate `unit.status`; occupancy output is derived for display and analytics only.

## Expiring Soon

`isLeaseExpiringSoon` only returns true for `active` and `notice_period` leases whose effective end date is inside the threshold window. Expired, renewed, terminated, cancelled, draft, pending-signature, and signed-future leases are excluded.

## Rollout

Phase 1 adds the backend canonical helper and unit tests.
Phase 2 exposes additive derived lifecycle fields in lease view models.
Phase 3 aligns frontend helper semantics and prefers backend-derived lifecycle fields when present.
Phase 4 uses the derived lifecycle in safe display contexts such as lease badges, unit occupancy, and portfolio health/expiring-soon summaries.

## Lease Lifecycle Review Queue V1

The review queue surfaces lifecycle records that need operator attention without mutating leases, unit records, or stored statuses. It is an admin/operator visibility layer, not an automation or correction workflow.

Review criteria include:

- `derivedLifecycleState === "unknown"`
- `derivedLifecycleRequiresReview === true`
- contradictory or incomplete lifecycle derivation reasons
- missing critical start or end dates on current/signed leases
- stored active/current status with a past end date
- expired lease plus current manual occupied unit data
- ambiguous renewal or successor links
- termination or notice fields that conflict with lifecycle interpretation

Queue items use read-only severity and category metadata:

- Severities: `critical`, `warning`, `info`
- Categories: `unknown_lifecycle`, `missing_dates`, `contradictory_status`, `expired_occupancy_conflict`, `renewal_ambiguity`, `termination_conflict`, `notice_conflict`

Recommended actions are non-mutating prompts such as reviewing lease dates, reviewing renewal links, reviewing termination notice, confirming occupancy manually, opening a property/unit record, or opening a lease record.

## Lease Lifecycle Operator Acknowledgements V1

Acknowledgements add operator workflow state to review queue items without changing the underlying lease, unit, property, or stored lease status. They are stored separately in `leaseLifecycleReviewAcknowledgements` and keyed from the deterministic review item ID.

Supported acknowledgement states:

- `open`: no operator disposition has been applied.
- `reviewed`: an admin/operator has reviewed the item.
- `snoozed`: an admin/operator has deferred the item until a future timestamp.
- `assigned`: an admin/operator has assigned the item to an owner or team.

Acknowledgement records include the review item ID, lease/property/unit references, status, optional assignee, optional snooze timestamp, optional note, actor ID, first acknowledgement timestamp, and updated timestamp. They are admin/operator metadata only.

Important boundaries:

- Acknowledgement writes never mutate lease records.
- Acknowledgement writes never rewrite `lease.status`.
- Acknowledgements do not auto-correct lifecycle derivation.
- Acknowledgements do not create payment obligations or trigger renewal enforcement.

## Lease Lifecycle Review History V1

Review history adds an audit timeline for acknowledgement changes without changing lease records. History events are stored separately in `leaseLifecycleReviewHistory` and are keyed to the deterministic review item ID plus a generated history ID.

Tracked actions include:

- `reviewed`: an operator marked a review item reviewed.
- `snoozed`: an operator deferred a review item until a future timestamp.
- `assigned`: an operator assigned a review item to an owner or team.
- `reopened`: an operator returned a review item to open status.
- `note_updated`: an operator updated acknowledgement context without changing the acknowledgement status.

History events include the review item ID, lease/property/unit references, previous and next acknowledgement status, optional assignee, optional snooze timestamp, optional note, actor ID/email, and event timestamp. The admin review queue returns a small recent-history timeline per item for audit visibility.

Important boundaries:

- History writes never mutate lease records.
- History writes never rewrite `lease.status`.
- History is not a lifecycle correction workflow.
- History is admin/operator audit metadata only.

## Deferred Future Steps

1. Stored lifecycle transition events.
2. Scheduled lease lifecycle reconciliation job.
3. Assignment notifications.
4. Auto-created admin triage queue items.
5. Landlord-safe warning surfacing.
6. Lifecycle correction workflow.
7. Assignment notifications from review history events.
8. Review history retention/export policy.
9. Lease renewal workflow enforcement.
10. Payment obligation generation from active lease lifecycle.
11. Institution-ready lease export schema.
