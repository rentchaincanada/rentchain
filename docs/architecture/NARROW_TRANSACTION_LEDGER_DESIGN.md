# Narrow Transaction Ledger Design v1

## Purpose

Define a narrow transaction ledger for RentChain that records operational financial events without becoming a full accounting ledger.

This ledger is intended to support:

- screening monetization
- deposit and payment rail events
- maintenance expense linkage visibility
- reconciliation and control-layer readiness

---

## What This Ledger Is

A transaction-event ledger that records financial state transitions linked to product objects and provider references.

It is designed for:

- operational financial truth
- reconciliation
- admin troubleshooting
- platform margin visibility
- future control-layer and automation readiness

---

## What This Ledger Is Not

It is not:

- a general ledger
- a tax engine
- a bank ledger
- a trust-account ledger
- a full invoicing system
- a complete accounting chart of accounts

It should not be used to replace formal accounting software.

---

## Design Principles

1. Event-based, append-oriented, and immutable by default.
2. Product objects remain the user-facing operational truth.
3. Ledger events explain financial transitions caused by those objects.
4. Provider references and reconciliation state are first-class fields.
5. Derived summaries can be built later; event truth comes first.

---

## Core Entity Model

### 1. Transaction event

The core row/object written for a meaningful commercial or payment state transition.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `id` | unique event id |
| `eventType` | normalized transaction event name |
| `occurredAt` | event timestamp |
| `recordedAt` | ingestion/write timestamp |
| `status` | recorded / pending / failed / reversed |
| `amountCents` | event amount |
| `currency` | currency code |
| `direction` | inflow / outflow / neutral |
| `productDomain` | screening / payments / maintenance |
| `sourceObjectType` | screening_order / lease_payment / maintenance_cost_link / etc. |
| `sourceObjectId` | id of the product object |
| `landlordId` | landlord scope |
| `tenantId` | tenant/applicant scope if relevant |
| `propertyId` | property scope if relevant |
| `unitId` | unit scope if relevant |
| `leaseId` | lease scope if relevant |
| `provider` | stripe / transunion / manual / internal |
| `providerRefType` | checkout_session / payment_intent / payout / provider_order / expense |
| `providerRefId` | provider or linked-object id |
| `correlationId` | logical flow id across multiple events |
| `reconciliationState` | unreconciled / matched / exception / ignored |
| `meta` | constrained structured metadata |

### 2. Reconciliation checkpoint

Not necessarily a separate collection in v1, but a logical concept that identifies whether an event:

- has a matching provider reference
- has a matching product object transition
- requires admin repair

### 3. Derived summary

Optional later read model for:

- screening margin by month
- deposit success/failure rates
- unlinked maintenance financial events

Not required in v1 ledger implementation.

---

## Event Taxonomy

### Screening events

| Event type | Direction | Meaning |
| --- | --- | --- |
| `screening_fee_charged` | inflow | applicant or payer successfully charged for screening |
| `screening_fee_failed` | neutral | screening charge attempt failed |
| `screening_provider_cost_incurred` | outflow | provider-side cost became owed/incurred |
| `screening_provider_cost_reversed` | inflow | provider-side cost was voided or reversed |
| `screening_margin_recognized` | neutral | derived margin event from charge minus provider cost |
| `screening_refund_issued` | outflow | screening payment refunded |

### Payment rail events

| Event type | Direction | Meaning |
| --- | --- | --- |
| `rent_payment_initiated` | neutral | rail payment initiated but not settled |
| `rent_payment_succeeded` | inflow | rent payment settled successfully |
| `rent_payment_failed` | neutral | initiated payment failed |
| `rent_payment_reversed` | outflow | previously successful payment reversed/refunded |
| `deposit_requested` | neutral | deposit obligation created |
| `deposit_paid` | inflow | deposit settled |
| `deposit_failed` | neutral | deposit attempt failed |
| `convenience_fee_assessed` | inflow | fee assessed to payer |
| `convenience_fee_refunded` | outflow | assessed fee refunded |

### Payout and settlement events

| Event type | Direction | Meaning |
| --- | --- | --- |
| `payout_expected` | neutral | payout should happen if platform model requires it |
| `payout_completed` | outflow | payout completed to destination |
| `payout_failed` | neutral | payout attempt failed |
| `processor_fee_recorded` | outflow | payment processor fee recorded |

### Maintenance-financial events

| Event type | Direction | Meaning |
| --- | --- | --- |
| `maintenance_cost_recorded` | neutral | maintenance cost finalized operationally |
| `maintenance_expense_linked` | neutral | maintenance cost linked to expense record |

These maintenance events are intentionally operational-financial, not cash-movement events.

---

## Recommended Direction Semantics

- `inflow`
  money or commercial value moving into platform-recognized revenue or collected value

- `outflow`
  provider costs, refunds, payouts, or processor costs

- `neutral`
  operationally important event with financial implications but no immediate net cash direction at that moment

This keeps the ledger useful without pretending it is full accounting.

---

## Source Object Mapping

| Product object | Ledger role |
| --- | --- |
| `screeningOrder` | primary commercial object for screening monetization |
| `rentalApplication` | product workflow context only |
| `payment` / future payment rail object | payment flow container |
| `lease` | obligation context |
| `maintenance request` / `work order` | operational cost source |
| `expense` | accounting-adjacent linked object, not ledger replacement |

Recommended rule:

- write ledger events from the commercial/transaction container object, not from arbitrary UI actions

---

## Example Event Records

### Screening fee charged

```json
{
  "eventType": "screening_fee_charged",
  "status": "recorded",
  "amountCents": 3500,
  "currency": "CAD",
  "direction": "inflow",
  "productDomain": "screening",
  "sourceObjectType": "screening_order",
  "sourceObjectId": "so_123",
  "landlordId": "landlord_1",
  "tenantId": "applicant_1",
  "propertyId": "prop_1",
  "provider": "stripe",
  "providerRefType": "payment_intent",
  "providerRefId": "pi_123",
  "correlationId": "screening_flow_123",
  "reconciliationState": "matched"
}
```

### Screening provider cost incurred

```json
{
  "eventType": "screening_provider_cost_incurred",
  "status": "recorded",
  "amountCents": 1800,
  "currency": "CAD",
  "direction": "outflow",
  "productDomain": "screening",
  "sourceObjectType": "screening_order",
  "sourceObjectId": "so_123",
  "landlordId": "landlord_1",
  "provider": "transunion",
  "providerRefType": "provider_order",
  "providerRefId": "tu_order_987",
  "correlationId": "screening_flow_123",
  "reconciliationState": "matched"
}
```

### Deposit paid

```json
{
  "eventType": "deposit_paid",
  "status": "recorded",
  "amountCents": 150000,
  "currency": "CAD",
  "direction": "inflow",
  "productDomain": "payments",
  "sourceObjectType": "lease_payment",
  "sourceObjectId": "pay_456",
  "landlordId": "landlord_1",
  "tenantId": "tenant_1",
  "propertyId": "prop_1",
  "leaseId": "lease_1",
  "provider": "stripe",
  "providerRefType": "payment_intent",
  "providerRefId": "pi_456",
  "correlationId": "deposit_flow_456",
  "reconciliationState": "matched"
}
```

### Maintenance expense linked

```json
{
  "eventType": "maintenance_expense_linked",
  "status": "recorded",
  "amountCents": 24500,
  "currency": "CAD",
  "direction": "neutral",
  "productDomain": "maintenance",
  "sourceObjectType": "work_order",
  "sourceObjectId": "wo_789",
  "landlordId": "landlord_1",
  "propertyId": "prop_1",
  "provider": "internal",
  "providerRefType": "expense",
  "providerRefId": "expense_22",
  "correlationId": "maintenance_cost_789",
  "reconciliationState": "matched"
}
```

---

## Reconciliation Touchpoints

### Screening

- checkout session / payment intent vs screening fee charged
- screening order vs provider cost incurred
- screening order vs report-ready state
- charge / refund / provider cost consistency

### Payments

- payment initiation vs success/failure webhook
- provider success vs lease/payment visible status
- deposit paid vs lease/deposit visible state
- payout expected vs payout completed

### Maintenance

- maintenance cost approved vs expense link created

---

## Ledger Write Rules

1. Write from backend-authoritative transitions only.
2. Do not write ledger events from optimistic frontend actions.
3. Prefer idempotent event creation keyed by correlation and provider reference.
4. Use reversal/refund events instead of mutating prior events.
5. Keep metadata constrained and operationally useful.

---

## Rollout Recommendation

### First implementation target

Implement ledger events for screening monetization first:

- `screening_fee_charged`
- `screening_fee_failed`
- `screening_provider_cost_incurred`
- `screening_margin_recognized`

Why:

- current repo already has screening order and webhook primitives
- highest readiness for monetized event truth

### Second implementation target

Implement deposit-related events:

- `deposit_requested`
- `deposit_paid`
- `deposit_failed`

### Third implementation target

Implement rent rail events:

- `rent_payment_initiated`
- `rent_payment_succeeded`
- `rent_payment_failed`
- `payout_expected`
- `payout_completed`

### Fourth implementation target

Add maintenance-financial ledger mirroring only where it improves reconciliation:

- `maintenance_cost_recorded`
- `maintenance_expense_linked`

---

## Risks and Boundaries

- If the ledger becomes a catch-all event dump, reconciliation quality will drop.
- If event types are too abstract, later automation will be unreliable.
- If event types are too provider-specific, future migrations become expensive.
- If product states and ledger states drift, operations and finance teams will lose trust quickly.

---

## Future Mission Dependencies

- screening commercial event writer
- screening provider-cost recording design
- deposit payment orchestration
- payment webhook normalization
- payout expectation tracking
- admin reconciliation surfaces

