# Payment Obligation Ledger Readiness V1

Status: read-only financial visibility layer

## Purpose

Payment Obligation Ledger Readiness V1 prepares a read-only view that combines lease truth, PaymentIntent obligations, rent payment execution records, and reconciliation evidence.

It does not enforce collections, generate obligations automatically, replace `rentPayments`, mutate leases, change provider behavior, or make PaymentIntent authoritative.

## Source Hierarchy

```text
Lease lifecycle = truth
PaymentIntent = obligation
rentPayments = execution
provider receipts / reconciliation = evidence
ledger = financial history
```

The read model is intentionally defensive. If signals conflict, the row becomes `manual_review_required` or `unknown`; it does not present false success.

## Row Model

Rows include:

- lease, property, unit, and tenant IDs
- optional PaymentIntent and rentPayment IDs
- period and due-date context when available
- expected and paid amounts in cents
- PaymentIntent, rentPayment, reconciliation, and evidence statuses
- derived obligation status
- source and reasons

V1 amount handling remains cents-only in backend read models. UI formatting remains a presentation concern.

## Status Derivation

Supported obligation statuses:

- `expected`
- `pending`
- `paid`
- `underpaid`
- `overpaid`
- `failed`
- `missing`
- `manual_review_required`
- `unknown`

Precedence:

1. Manual-review reconciliation, mismatch, or duplicate-risk evidence wins.
2. Missing expected amount becomes `unknown`.
3. Failed, cancelled, or expired rentPayment/PaymentIntent evidence becomes `failed`.
4. Paid amount equal to expected becomes `paid`.
5. Paid amount below expected becomes `underpaid`.
6. Paid amount above expected becomes `overpaid`.
7. Open checkout/provider states become `pending`.
8. Expected lease or PaymentIntent with no payment evidence becomes `missing`.
9. Insufficient context becomes `unknown`.

## Lease Lifecycle Relationship

Lease lifecycle remains the source of truth for whether an obligation should exist. V1 may create a read-only row from an active, notice-period, or signed-future lease when no PaymentIntent or rentPayment exists yet.

Expired, terminated, cancelled, and renewed leases are not used to create new lease-only obligation rows in this V1 read model.

## PaymentIntent Relationship

PaymentIntent remains additive and non-authoritative. The ledger readiness helper treats PaymentIntent as an obligation signal and links it to rentPayments by `paymentIntentId` or `rentPaymentId` where available.

Confirmed PaymentIntent status without paid rentPayment evidence becomes review-required rather than paid, because execution evidence is not complete.

## rentPayments Relationship

`rentPayments` remain the execution and checkout-history compatibility layer. V1 does not replace them. Paid rentPayments contribute paid amount. Failed, cancelled, or expired rentPayments contribute failed state.

## Reconciliation Relationship

Reconciliation records are evidence. Manual-review, mismatch, and duplicate-risk reconciliation records take precedence over otherwise paid-looking execution records.

## API Integration

The existing lease ledger route can add read-only fields without changing existing response shape:

- `obligationRows`
- `obligationSummary`

Existing `entries`, `totals`, and `monthlyTotals` remain unchanged.

## Deferred Future Steps

1. PaymentIntent-authoritative ledger.
2. Automated monthly obligation generation.
3. Delinquency decision engine.
4. Landlord/tenant ledger UI upgrade.
5. Trustly integration.
6. Obligation review queue for missing or contradictory payment evidence.
7. Scheduled reconciliation between lease lifecycle and expected obligations.
