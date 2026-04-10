# Risk Agent Review Surface

## Purpose

This mission surfaces the latest Risk Agent v1 snapshot inside the landlord/admin application review workflow that already exists in RentChain.

It does not change scoring logic. It productizes the existing deterministic output so reviewers can see:

- score
- grade
- confidence
- top factors
- flags
- recommendations

in the same review flow where they already inspect screening and application details.

## Where Risk Appears

Risk is now surfaced in:

- landlord/admin application review summary backend response
  - `GET /api/rental-applications/:id/review-summary`
- landlord applications detail view
- dedicated application review summary page

## What Landlords/Admins See

The review surface shows:

- latest Risk Agent score
- latest grade
- confidence
- evaluation status
- top factors
- flags
- next review steps
- last updated time when available

UI copy explicitly states that:

- higher score means lower risk / a stronger file
- the output is decision support only

## States

The review UI handles:

- no risk evaluation yet
- completed
- insufficient data
- manual review required
- retrieval failure through existing page error handling

When no risk snapshot exists yet, the UI shows a safe "not evaluated yet" state instead of implying a score.

## Evaluate / Refresh

This mission includes a bounded landlord/admin-safe action to:

- evaluate risk
- refresh the latest risk snapshot

The action:

- calls the existing Risk Agent v1 evaluate route
- does not mutate application, lease, or tenant status
- simply refreshes the latest structured snapshot used by the review UI

## Security

This mission preserves the existing constraints:

- no tenant-facing risk exposure
- no cross-landlord risk access
- no automatic decisioning
- no hidden application/lease/tenant mutation

## Future Direction

This review-surface integration creates a clean bridge toward a future landlord decision panel where Risk Agent, screening, identity, and document readiness can sit together without changing the underlying deterministic core.
