# Lease Ledger Obligation Balance Consistency Audit v1

## Context

During PR #1279 manual QA, the lease ledger route `/leases/y7XM6BFXIzWW0fV3mu1L/ledger` showed an apparent aggregate credit while the decision context still displayed an overdue/pending rent obligation.

Observed ledger totals:

- Charges: `$2,173.00`
- Payments: `$10,942.00`
- Balance: `-$8,769.00`

Observed decision context:

- Decision: `Overdue Rent`
- Financial signal: `Overdue`
- Workflow status: `Reviewed`
- Issue: `Rent obligation is overdue.`
- Tenant: `Bailey Blinkers`
- Property/unit: `center suites · Unit 1`
- Outstanding: `$2,000.00`
- Due date: `6/1/2026`
- Obligation status: `Pending`

This audit is documentation-only. It does not change ledger calculations, payment allocation, decision state, backend routes, schema, or UI.

## Source Files Reviewed

- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/lib/payments/paymentObligationLedger.ts`
- `rentchain-api/src/lib/payments/delinquencySignals.ts`
- `rentchain-api/src/routes/__tests__/leaseRoutes.integrity.test.ts`
- `rentchain-api/src/routes/__tests__/landlordDecisionInboxRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/landlordDecisionQueueRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/decisionRoutes.test.ts`
- `rentchain-api/src/__tests__/decisionWorkflowRegression.test.ts`
- `rentchain-frontend/src/api/leaseLedgerApi.ts`
- `rentchain-frontend/src/pages/LeaseLedgerPage.tsx`
- `rentchain-frontend/src/lib/decisions/decisionDisplay.ts`
- `rentchain-frontend/src/lib/decisions/decisionContext.ts`

## Current Data Flow

`GET /api/leases/:leaseId/ledger` assembles several related but separate views of payment state:

- `entries` and `totals` come from ledger entries. Charges add to the running balance; payments subtract from it. A negative balance means aggregate payment entries exceed aggregate charge entries for the queried lease ledger.
- `obligationRows` come from `buildPaymentObligationLedgerRows`, using lease lifecycle context, payment intents, rent payments, canonical payments, ledger-entry-derived canonical payment evidence, and reconciliation records.
- `delinquencySignals` come from `deriveDelinquencySignals(obligationRows)`, not from aggregate ledger totals.
- `decisions` are derived from delinquency signals and lease lifecycle state, then overlaid with decision actions such as reviewed, snoozed, dismissed, or resolved.

The frontend mirrors that split:

- `LeaseLedgerPage.tsx` stores and renders aggregate totals separately from obligation rows and decision context.
- `DecisionContextPanel` uses decision metadata, related obligation rows, and delinquency signals to explain a specific decision.
- `addLeasePayment` posts amount, date, method, reference, notes, and optional property/unit context. It does not send an explicit obligation row ID or allocation target.

## Findings

### 1. Aggregate balance and obligation status are intentionally separate concepts

Ledger totals answer: "Across this lease ledger, how much has been charged and paid?"

Obligation rows answer: "For this expected rent obligation, what evidence exists that it was paid, underpaid, overpaid, pending, missing, failed, or needs manual review?"

Because delinquency signals are derived from obligation rows, an aggregate credit does not automatically prove that a specific obligation has been reconciled.

### 2. Payments can clear obligations when they are recognized as matching evidence

Existing integrity tests show that canonical imported payments and same-lease pre-start ledger payment entries can become obligation evidence. In those cases, the obligation row becomes paid or overpaid, outstanding amount drops to zero, and delinquency signals clear.

This means the system is not universally ignoring ledger payments when calculating obligations.

### 3. Unmatched or differently scoped payments can still create a credit balance

`buildPaymentObligationLedgerRows` groups canonical payment evidence by lease, filters by eligible payment status, and then applies lease-term/window and source rules. Payment intents and rent payments are reconciled through their own identifiers and statuses.

If a payment contributes to ledger totals but is not matched into the relevant obligation row, the ledger can show an aggregate credit while a specific obligation remains pending or missing. That may be valid unallocated-payment behavior, stale/mismatched data, or a fixture issue depending on the source records behind the observed lease.

### 4. `Record payment` creates payment and ledger records, but does not explicitly allocate to an obligation

The backend `POST /api/leases/:leaseId/ledger/payment` writes a payment document and a ledger entry linked by `paymentDocumentId`. The frontend request does not include an obligation row ID, due date, payment intent ID, or rent payment allocation target.

That payment can later be used as canonical evidence if it satisfies the reconciliation rules. It is not an explicit instruction to apply funds to the oldest pending obligation or to a selected obligation.

### 5. Reviewed decision state does not resolve financial truth

Decision action tests explicitly preserve financial truth when workflow state changes. Reviewed, dismissed, snoozed, and resolved are workflow states. They do not mutate payment evidence, obligation status, or ledger totals.

The observed `Workflow status: Reviewed` with `Overdue Rent` can therefore be internally consistent: a user reviewed the decision, but the underlying obligation still appeared overdue from the current obligation evidence.

### 6. The observed lease ID appears in decision-route fixtures

The lease ID `y7XM6BFXIzWW0fV3mu1L` appears in decision inbox and decision queue tests as a genuine unpaid obligation route to `/leases/y7XM6BFXIzWW0fV3mu1L/ledger`. Those tests validate that an expected `$2,000.00` missing-payment decision routes to the ledger.

The exact QA totals may come from runtime/demo data, but the fixture coverage confirms that this lease ID is associated with expected overdue-decision behavior in tests.

### 7. The current UI does not explain allocation state when aggregate credit and obligation debt diverge

The page now shows user-facing decision context and hides internal IDs by default, but it still presents aggregate balance and obligation context as adjacent facts without explaining why they can disagree.

For a landlord user, "Balance -$8,769.00" next to "Outstanding $2,000.00" reads like a contradiction unless the UI explains allocation, matching, reviewed workflow state, or stale evidence.

## Root Cause Classification

Based on code review, this does not look like a simple aggregate-balance calculation bug. The aggregate ledger balance is doing one job, while obligation reconciliation and decision context are doing another.

Most likely causes for the observed state are:

1. **Allocation or matching gap:** payments are present on the ledger but not allocated or matched to the specific pending obligation.
2. **Stale reviewed decision context:** a reviewed decision remains visible historically while the underlying financial evidence has changed or remains unresolved.
3. **Fixture/demo data inconsistency:** seeded/demo records may contain both a large aggregate credit and an unpaid obligation decision for the same lease.
4. **UI explanation gap:** expected accounting behavior is not explained to a landlord user.

The audit did not find enough evidence to justify automatic payment allocation changes without a product/accounting decision.

## Recommended Follow-Up Mission

Recommended implementation mission:

`fix/lease-ledger-obligation-balance-explanation-v1`

### Objective

Make the ledger explain allocation state clearly when aggregate lease balance and obligation-level status appear to conflict.

### Proposed Scope

- Frontend lease ledger and decision context copy only, unless a minimal API field is required to safely explain allocation state.
- Detect when aggregate `balanceCents` is negative while one or more obligation rows still have outstanding amounts or overdue/pending signals.
- Add clear user-facing copy such as:
  - `This lease has an aggregate credit, but this obligation is still pending because payments have not been matched to it.`
  - `Reviewed means the workflow was reviewed; it does not mark the rent obligation paid.`
- Preserve existing ledger calculations, payment writes, decision actions, and obligation reconciliation behavior.
- Do not expose raw internal IDs in the default view.

### Acceptance Criteria For Follow-Up

- A landlord can understand why a credit balance and pending obligation can appear together.
- Reviewed decisions are clearly described as workflow status, not payment resolution.
- Existing ledger totals, obligation rows, and decision context remain visible.
- No payment allocation behavior changes are introduced.
- No backend payment workflow, schema, or ledger calculation changes are introduced unless strictly required for safe presentation.

## Separate Product/Accounting Decision Needed

If the product expects any overpayment or credit to automatically offset the oldest unpaid obligation, that should be handled by a separate mission after defining allocation rules.

Potential later mission:

`fix/lease-ledger-obligation-payment-allocation-v1`

Questions to resolve before that mission:

- Should all same-lease credits automatically apply to oldest unpaid obligations?
- Should application depend on payment date, due date, lease term, reference, tenant, property/unit, or manual confirmation?
- Should allocation be reversible and auditable?
- Should imported CSV payments be auto-applied differently from manually recorded payments?
- Should reviewed or resolved decisions be recalculated immediately after allocation changes?

## Non-Goals Preserved

- No implementation.
- No payment allocation changes.
- No ledger calculation changes.
- No decision state changes.
- No backend changes.
- No UI changes.
- No schema changes.
- No CSV/PDF export changes.
