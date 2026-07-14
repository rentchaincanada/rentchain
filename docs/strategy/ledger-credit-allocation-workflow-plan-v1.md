# Ledger Credit Allocation Workflow Plan v1

## 1. Current State

RentChain can currently detect and present the case where a lease has an aggregate credit balance while one or more specific rent obligations remain unmatched. The known production example is:

- Aggregate ledger balance: -$8,769.00 credit.
- Outstanding obligation: $2,000.00.
- Financial signal: Allocation review.
- Safe explanation: payments exceed charges in aggregate, but the obligation remains unmatched.

The current work protects operators from treating the case as ordinary overdue rent. It does not yet provide a workflow to apply available credit to the unmatched obligation.

The current ledger route is `GET /api/leases/:leaseId/ledger`. It derives:

- `entries` from `ledgerEntries`.
- aggregate totals and running balance from signed ledger entries.
- `obligationRows` from lease lifecycle, payment intents, rent payments, canonical payment evidence, and payment reconciliation records.
- `obligationSummary` from the derived obligation rows.
- delinquency signals and decisions from the derived obligation rows.

The frontend `/leases/:leaseId/ledger` page uses this payload to show the aggregate credit warning, payment obligation summary, decision card, and print/PDF export. The recent copy changes are presentation-only; they do not apply credit to obligations.

## 2. Problem Statement

Users reasonably expect available lease credit to cover outstanding obligations. Today, the system shows why the aggregate balance and obligation state disagree, but it leaves the operator without a governed next step.

The gap is not payment math. It is missing allocation intent and audit state:

- historical payments remain intact as ledger/payment records;
- obligations remain outstanding because they are not explicitly matched or allocated;
- aggregate credit exists because payments exceed charges in the ledger;
- there is no operator-reviewed record that says a specific amount of available credit was applied to a specific obligation.

The workflow must convert available credit into explicit obligation allocation records without editing historical payment amounts, deleting ledger entries, hiding obligations, or creating collection/legal/compliance/lifecycle claims.

## 3. Data Model Audit

### Aggregate ledger balance source of truth

The aggregate lease balance is derived from `ledgerEntries` for a landlord-scoped lease. The current signed balance convention is:

- payment entries reduce the balance;
- charge entries increase the balance;
- adjustment entries can increase or reduce the balance depending on sign.

The `GET /api/leases/:leaseId/ledger` route computes `totals.balanceCents` and row `balanceCents` from these signed ledger entries. The dashboard/decision-queue allocation review logic also derives aggregate balance by reading landlord-scoped `ledgerEntries`.

Conclusion: v1 should continue treating signed `ledgerEntries` as the source of truth for aggregate lease balance.

### Obligation paid/outstanding source of truth

Obligation status is not stored as a simple mutable balance. It is derived by `buildPaymentObligationLedgerRows` from:

- lease lifecycle and rent amount;
- payment intents;
- rent payment records;
- canonical payments from `payments`;
- payment-like `ledgerEntries` converted into canonical payment evidence;
- `paymentReconciliationRecords`.

Each obligation row includes `expectedAmountCents`, `paidAmountCents`, `obligationStatus`, source, evidence status, and reasons. `summarizePaymentObligationLedger` computes outstanding amount as:

```text
max(0, expectedAmountCents - paidAmountCents)
```

Conclusion: v1 allocation must become an input to obligation-row derivation rather than a frontend-only adjustment. The system needs durable allocation records that add to the derived paid/allocated amount for a specific obligation.

### Current payment-to-obligation allocation

Payments are partially connected to obligations through:

- payment intent and rent payment IDs;
- canonical payment records linked to lease and optionally ledger entry IDs;
- reconciliation records keyed to provider/payment intent/rent payment context;
- same-lease/pre-start and in-window canonical payment evidence logic.

There is no explicit general-purpose record saying: "apply X cents of lease credit to obligation Y." Credit remains aggregate until derivation can associate it with the obligation.

Conclusion: existing payment/reconciliation machinery can inform allocation, but it is not sufficient as the allocation source of truth.

### Existing reconciliation model

`paymentReconciliationRecords` exists for provider/payment signal reconciliation. It tracks provider event IDs, payment intent IDs, subject IDs, status, reasons, manual review flags, and idempotency. It is useful evidence, but it is provider-payment oriented and not a lease-credit allocation model.

Conclusion: v1 should not overload provider reconciliation records as the sole allocation record. It may create or reference a reconciliation event, but allocation needs its own explicit lease/obligation allocation state.

### Decision workflow state

Decision actions are stored in `decisionActions`. A decision can be reviewed, snoozed, assigned, dismissed, or resolved. Recent ledger UI work ensures resolved allocation-review cards do not show misleading active CTAs.

Conclusion: allocation completion should not silently resolve decisions. It should make the decision meaningfully resolvable and may optionally record a decision action only after operator confirmation.

## 4. Proposed Allocation Model

### Recommended source of truth

Create a new append-safe collection:

```text
leaseCreditAllocationRecords
```

Each record represents an operator-reviewed application of aggregate lease credit to one obligation.

Suggested fields:

```ts
type LeaseCreditAllocationRecord = {
  allocationId: string;
  landlordId: string;
  leaseId: string;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;

  obligationKey: string;
  obligationRowId?: string | null;
  paymentIntentId?: string | null;
  rentPaymentId?: string | null;
  paymentDocumentId?: string | null;
  dueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;

  amountCents: number;
  currency: "cad";

  sourceBalanceBeforeCents: number;
  obligationOutstandingBeforeCents: number;
  remainingCreditAfterCents: number;
  obligationOutstandingAfterCents: number;

  status: "active" | "reversed" | "superseded";
  reason: "operator_credit_allocation";
  note?: string | null;

  createdAt: string;
  createdBy: string;
  createdByEmail?: string | null;
  reversedAt?: string | null;
  reversedBy?: string | null;
  reversedByEmail?: string | null;
  reversalReason?: string | null;
  correctionOfAllocationId?: string | null;
  supersededByAllocationId?: string | null;

  decisionId?: string | null;
  auditEventId?: string | null;
  ledgerEntryId?: string | null;
};
```

The allocation record should be the business source of truth for credit applied to an obligation. It should be loaded into `buildPaymentObligationLedgerRows` or a companion derivation step so `allocatedAmountCents` contributes to `paidAmountCents` or to a new `allocatedAmountCents` field.

### Obligation identity

Because current obligation rows are derived, v1 needs a stable obligation key. The key should be deterministic from canonical obligation fields:

```text
leaseId + dueDate + periodStart + periodEnd + expectedAmountCents + paymentIntentId/rentPaymentId/paymentDocumentId when present
```

If an obligation has a payment intent or rent payment ID, use that ID as the strongest anchor. If it is lease-lifecycle-derived only, use lease ID, normalized due date, period, and expected amount.

### Ledger entry relationship

Do not edit original payment ledger entries. Do not create a new payment.

The safest v1 approach is:

- create an allocation record as the source of truth;
- optionally create a ledger entry with `entryType: "adjustment"` and category `allocation` only if the product wants the ledger row list to show the allocation event;
- if an adjustment ledger entry is created, it must not change aggregate balance because allocation moves credit within the lease rather than adding/removing money.

Recommendation for v1 implementation:

1. Start with allocation records plus audit/canonical events.
2. Project allocation records into the ledger UI as an "Allocation" event row without changing `totals.balanceCents`.
3. Avoid a balance-affecting ledger entry until there is a clear accounting convention for internal transfers.

### Reconciliation event relationship

Create a lightweight allocation reconciliation/audit event separate from provider payment reconciliation:

```text
lease_credit_allocated
```

This can be a canonical audit/review timeline event and evidence item. It should reference:

- allocation ID;
- lease ID;
- obligation key;
- amount;
- operator;
- before/after credit and obligation outstanding values;
- decision ID, if the allocation was started from a decision card.

Do not call it legal compliance, legal service, collection, or payment received.

## 5. Operator Workflow

### Discovery state

When a lease has aggregate credit and unmatched obligations:

- show available credit;
- show eligible outstanding obligations;
- explain that the mismatch requires allocation review;
- avoid "tenant owes rent" or collection framing.

Example:

```text
Available credit: $8,769.00
Eligible unmatched obligations: $2,000.00 due 2026-06-01
Suggested allocation: Apply $2,000.00 from available credit to this obligation.
```

### Confirmation state

Operator opens allocation review and sees:

- source lease;
- available aggregate credit;
- eligible obligation(s);
- proposed allocation amount;
- remaining credit after allocation;
- obligation outstanding after allocation;
- required note if the operator changes the suggested amount;
- guardrail copy: this does not edit historical payments, create a new payment, create collection action, or make legal/compliance claims.

The operator must explicitly confirm:

- "I reviewed the available credit and obligation context."
- "Apply this credit allocation to the selected obligation."
- "This does not create a new payment or legal/compliance state."

### Completion state

After confirmation:

- allocation record is created;
- audit/canonical event is recorded;
- obligation row derivation includes the allocation;
- obligation outstanding is reduced;
- remaining credit is recalculated;
- related allocation-review decision can be resolved meaningfully.

Core example:

Before:

- Available credit: $8,769.00.
- Outstanding obligation: $2,000.00.

Operator allocation:

- Apply $2,000.00 from available credit to obligation due 2026-06-01.

After:

- Obligation outstanding: $0.00.
- Remaining credit: $6,769.00.
- Allocation record created.
- Audit event recorded.
- Decision may become resolvable as allocation completed.

## 6. API Design

### Preview endpoint

```http
GET /api/leases/:leaseId/credit-allocations/preview
```

Returns:

- available credit;
- eligible obligations;
- suggested allocations;
- current decision context if available;
- guardrail copy/status flags.

This endpoint should not mutate data.

### Create allocation endpoint

```http
POST /api/leases/:leaseId/credit-allocations
```

Required request body:

```ts
{
  obligationKey: string;
  amountCents: number;
  confirmationAccepted: true;
  reviewedCurrentBalance: true;
  reviewedObligation: true;
  noPaymentAmountEdit: true;
  noLegalOrCollectionClaim: true;
  idempotencyKey: string;
  note?: string;
  decisionId?: string;
}
```

Validation:

- landlord owns lease;
- obligation key exists in current derivation;
- obligation has positive outstanding amount;
- aggregate balance is a credit;
- amount is positive;
- amount is no greater than available credit;
- amount is no greater than obligation outstanding unless explicitly supporting partial/over-allocation correction rules;
- idempotency key is present and landlord/lease scoped;
- confirmations are true;
- decision ID, if supplied, belongs to the same lease.

Response:

```ts
{
  ok: true;
  allocationId: string;
  amountCents: number;
  remainingCreditAfterCents: number;
  obligationOutstandingAfterCents: number;
  auditEventId: string;
}
```

### Reverse allocation endpoint

```http
POST /api/leases/:leaseId/credit-allocations/:allocationId/reverse
```

Required request body:

```ts
{
  reason: string;
  confirmationAccepted: true;
  idempotencyKey: string;
}
```

Reversal should not delete the allocation record. It should mark the allocation as reversed and create a reversal audit event. The obligation derivation should exclude reversed allocations.

## 7. UI Design

### Ledger page

Add an operator-reviewed allocation panel only when:

- aggregate balance is a credit;
- one or more obligations have outstanding amount;
- no blocking data integrity issue prevents safe allocation.

Panel content:

- available credit;
- eligible obligations with due date, expected, currently allocated/paid, outstanding;
- suggested allocation amount;
- remaining credit preview;
- confirmation controls;
- "Apply credit allocation" action;
- reversal/correction links for existing active allocations.

Resolved decisions should show that allocation was completed, not that overdue rent was collected.

### Dashboard and decision queue

Allocation review decisions should remain allocation-safe:

- title: "Review payment allocation";
- description: aggregate credit exists, but one or more obligations remain unmatched;
- CTA routes to the ledger allocation review panel.

After allocation, the decision can show:

- "Credit allocation recorded";
- "Decision ready to resolve";
- or passive resolved state if already resolved by the operator.

### Print/PDF

Ledger export should include:

- allocation record summary;
- audit/reversal status;
- before/after values;
- no raw internal IDs as primary labels;
- no collection or legal/compliance framing.

## 8. Audit Trail Requirements

Allocation must be append-safe and reviewable.

Required audit facts:

- actor ID/email;
- timestamp;
- lease ID;
- obligation key/row context;
- amount allocated;
- available credit before;
- obligation outstanding before;
- remaining credit after;
- obligation outstanding after;
- confirmations accepted;
- idempotency key;
- decision ID if started from decision workflow;
- source route/version.

Canonical/review timeline event:

```text
Lease credit allocated to obligation
```

Safe event copy:

```text
Operator applied available lease credit to an unmatched obligation. Historical payment records were not changed.
```

Forbidden event copy:

- notice served;
- legal compliance achieved;
- tenant collected from;
- tenant paid;
- overdue rent recovered.

## 9. Reversal and Correction Flow

Reversal is required because allocation can be made in error.

V1 reversal should:

- mark the allocation record `reversed`;
- record actor/timestamp/reason;
- create reversal audit event;
- remove that allocation from obligation paid/allocated derivation;
- restore the obligation outstanding amount and available credit in derived state;
- leave original payment and ledger records unchanged.

Correction should be modeled as:

1. reverse incorrect allocation;
2. create a new allocation with `correctionOfAllocationId`;
3. show both records in audit/timeline.

Do not edit allocation amount in place after creation.

## 10. Decision Workflow Impact

Allocation should not automatically resolve decisions without operator choice.

Recommended behavior:

- before allocation: decision is allocation review;
- after allocation: decision displays "Credit allocation recorded" and exposes a meaningful "Resolve allocation review" action;
- if the allocation fully clears all eligible outstanding obligations, decision resolution is safe;
- if partial obligations remain, decision remains reviewable with updated context.

The decision action record should remain separate from the allocation record, but both should reference each other where practical.

## 11. Guardrails

The workflow must preserve:

- no auto-allocation;
- no payment amount edits;
- no deletion of ledger entries;
- no hidden outstanding obligations;
- no collection/contact-tenant framing;
- no legal service/compliance/lifecycle claims;
- operator confirmation;
- audit trail;
- reversal/correction support.

The UI should use allocation wording:

- "Apply available credit";
- "Allocation review";
- "Unmatched obligation";
- "Historical payments remain unchanged."

Avoid:

- "collect";
- "recover overdue rent";
- "tenant paid";
- "legally resolved";
- "compliance complete".

## 12. Test Plan

### Backend

Add tests for:

- preview returns available credit and eligible obligations;
- preview returns no allocation action when aggregate balance is not a credit;
- create allocation rejects missing confirmations;
- create allocation rejects amount greater than available credit;
- create allocation rejects amount greater than obligation outstanding;
- create allocation is idempotent by idempotency key;
- allocation record reduces obligation outstanding in derived rows;
- allocation does not change historical ledger/payment records;
- allocation creates audit/canonical event;
- reversal marks record reversed and restores derived outstanding amount;
- reversed allocation remains visible in audit but not active derivation;
- decision context becomes allocation-complete/resolvable only after active allocation;
- true overdue rent cases still behave as overdue rent when no aggregate credit exists.

Likely backend test targets:

- `paymentObligationLedger` or new allocation derivation helper;
- lease credit allocation route tests;
- `leaseRoutes` ledger projection tests;
- decision inbox/queue tests;
- review timeline/evidence projection tests if allocation events are projected there.

### Frontend

Add tests for:

- allocation review panel appears for aggregate credit plus unmatched obligation;
- eligible obligation card shows due date, outstanding, suggested allocation, remaining credit;
- apply action remains disabled until confirmations are checked;
- successful allocation refreshes ledger and shows allocation recorded;
- resolved decision copy is allocation-safe;
- reversal/correction UI is present only for active allocations;
- print/PDF includes allocation record without collection/legal framing;
- no unsafe overdue-rent wording appears for aggregate-credit allocation cases.

### Manual QA

Use the known test lease:

```text
/leases/y7XM6BFXIzWW0fV3mu1L/ledger
```

Confirm:

- available credit and eligible obligation are visible;
- applying $2,000.00 clears the obligation in derived state;
- remaining credit becomes $6,769.00;
- audit/timeline/evidence show allocation safely;
- reversal restores the prior derived state;
- no payment math or historical records are edited.

## 13. Risks and Open Questions

### Stable obligation identity

Derived lease-lifecycle obligations may not have a persisted ID. The implementation must define a deterministic obligation key and preserve it across refreshes.

### Accounting representation

If allocation creates a ledger entry, a normal signed amount could incorrectly change aggregate balance. V1 should avoid balance-changing ledger entries unless there is an explicit internal-transfer convention.

### Partial and multiple allocations

Multiple obligations may compete for one credit balance. V1 should support deterministic suggested allocation order but require operator confirmation for each allocation or for an explicit batch.

### Existing overpayments

Some overpayment cases may already be tied to an obligation through canonical payments. Allocation should only use remaining unallocated aggregate credit, not double-count payments already associated with obligations.

### Reversal effects

Reversal must be derivation-safe. It cannot delete audit records or mutate original payments. It should also avoid implicitly reopening closed decisions unless the operator chooses that action.

### Tenant-facing projection

If tenant ledger surfaces later expose allocation records, they need a separate tenant-safe projection. This planning PR does not authorize tenant-facing allocation surfaces.

## 14. Phased Implementation PR Sequence

### PR 1: Backend allocation model and derivation

- Add `leaseCreditAllocationRecords` model/helper.
- Add deterministic obligation key helper.
- Load active allocation records into obligation derivation.
- Add backend tests for paid/outstanding derivation and reversal exclusion.
- No frontend mutation UI yet.

### PR 2: Allocation preview API

- Add `GET /api/leases/:leaseId/credit-allocations/preview`.
- Return available credit and eligible obligations.
- Add route/auth/ownership tests.
- No write behavior yet.

### PR 3: Create allocation API

- Add `POST /api/leases/:leaseId/credit-allocations`.
- Enforce confirmations, amount bounds, idempotency, and audit event creation.
- Add ledger route projection of allocation records.
- Add backend tests for no payment/ledger mutation.

### PR 4: Ledger allocation UI

- Add allocation panel to `/leases/:leaseId/ledger`.
- Add confirmation flow.
- Refresh ledger after allocation.
- Preserve allocation-safe copy.
- Add frontend tests and manual QA.

### PR 5: Reversal/correction API and UI

- Add reversal endpoint.
- Add correction flow as reverse plus new allocation.
- Add audit/timeline/evidence projection.
- Add tests for reversal state restoration.

### PR 6: Decision workflow integration

- Update allocation-review decisions to show allocation completion and meaningful resolution.
- Keep true overdue-rent decisions unchanged.
- Add dashboard/decision inbox regression tests.

## 15. Scope Boundary for This Planning PR

This document is planning only.

It does not:

- implement allocation logic;
- add routes;
- change ledger math;
- mutate records;
- add auto-allocation;
- change decision workflow behavior;
- add tenant-facing surfaces;
- add legal/compliance/lifecycle claims.
