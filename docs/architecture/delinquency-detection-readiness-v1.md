# Delinquency Detection Readiness V1

Status: read-only decision-signal readiness layer

## Purpose

Delinquency Detection Readiness V1 derives deterministic rent-risk signals from the existing read-only obligation ledger.

It makes payment problems visible without enforcing notices, changing checkout behavior, mutating leases, or making PaymentIntent authoritative.

## Source Hierarchy

```text
Lease lifecycle = truth
PaymentIntent = obligation
rentPayments = execution evidence
payment obligation ledger = expected vs actual read model
delinquency detection = read-only problem signals
```

The detector intentionally consumes obligation ledger rows instead of raw provider events. Provider behavior remains outside this layer.

## Signal Model

Signals include:

- `rent_due`
- `overdue`
- `partially_paid`
- `failed_payment`
- `missing_payment`
- `manual_review_required`

Severity is one of:

- `info`
- `warning`
- `critical`

Each signal includes lease, property, unit, tenant, PaymentIntent, rentPayment, period, due date, expected amount, paid amount, outstanding amount, detected timestamp, and derivation reasons where available.

## Derivation Rules

V1 rules are deterministic:

1. `rent_due`: due today or in the future and obligation is `expected` or `pending`.
2. `overdue`: past due, obligation is `missing` or `pending`, and outstanding amount is greater than zero.
3. `partially_paid`: obligation is `underpaid`.
4. `failed_payment`: obligation is `failed`.
5. `missing_payment`: no `rentPaymentId` exists and due date has passed.
6. `manual_review_required`: obligation is `manual_review_required` or `unknown`.

Outstanding amount is derived as:

```text
max(0, expectedAmountCents - paidAmountCents)
```

Amounts stay in cents in backend read models. Formatting remains a UI concern.

## API Integration

The existing lease ledger endpoint can add delinquency fields without changing its existing response shape:

- `delinquencySignals`
- `delinquencySummary`

Existing `entries`, `totals`, `monthlyTotals`, `obligationRows`, and `obligationSummary` remain intact.

## Read-Only Guardrails

V1 does not:

- send notices
- block or retry payments
- mutate leases
- mutate PaymentIntent records
- mutate rentPayments
- change Stripe checkout or webhook behavior
- implement Trustly
- create historical obligations
- create collections workflows

## Deferred Future Steps

1. Automated notices.
2. Decision engine integration.
3. Landlord-safe alert surfacing.
4. Collections integration.
5. Scheduled delinquency snapshots.
6. Operator review workflow for delinquency signals.
7. PaymentIntent-authoritative obligation enforcement.
