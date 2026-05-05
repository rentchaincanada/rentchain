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

## Deferred Future Steps

1. Stored lifecycle transition events.
2. Scheduled lease lifecycle reconciliation job.
3. Operator acknowledgement state.
4. Review assignment/owner.
5. Auto-created admin triage queue items.
6. Landlord-safe warning surfacing.
7. Lifecycle correction workflow.
8. Lease renewal workflow enforcement.
9. Payment obligation generation from active lease lifecycle.
10. Institution-ready lease export schema.
