# Lease Ledger Payment Signal Consistency Audit v1

Branch: `audit/lease-ledger-payment-signal-consistency-v1`
Scope: audit and documentation only; no dashboard, ledger, payment, PAD, screening, schema, financial-record, Operations persistence, or navigation changes.

## Purpose

This audit reviews why Dashboard Decision Queue Preview can show a critical missing-payment item while the destination lease ledger shows the rent obligation as reconciled, overpaid, or otherwise up to date.

Observed QA example:

- Dashboard Decision Queue Preview:
  - `Review Missing Payment`
  - `Payments workspace · No due date`
  - `critical`
  - Open routes to `/leases/:leaseId/ledger`
- Lease ledger:
  - `Overpaid`
  - `Payment exceeds expected amount`
  - `Outstanding $0.00`
  - `All rent obligations are up to date`

This creates an RC1 credibility issue because the dashboard preview is an enterprise-demo attention surface. It must not present a critical payment defect when the owning ledger workspace shows the obligation as resolved.

## Enterprise Validation Filter

This mission advances:

- Revenue: payment confidence supports future PAD and payment workflow adoption.
- Operational efficiency: operators should not chase false critical payment items.
- Enterprise readiness: executive/demo dashboards must reconcile with their source workspaces.
- Customer validation: the one-building pilot needs reliable escalation wording before payment automation is introduced.

## Files Reviewed

Backend:

- `rentchain-api/src/routes/landlordDecisionQueueRoutes.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueService.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueTypes.ts`
- `rentchain-api/src/routes/landlordDecisionInboxRoutes.ts`
- `rentchain-api/src/lib/decisions/deriveDecisionInbox.ts`
- `rentchain-api/src/lib/decisions/decisionEngine.ts`
- `rentchain-api/src/lib/payments/paymentObligationLedger.ts`
- `rentchain-api/src/lib/payments/delinquencySignals.ts`
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/__tests__/landlordDecisionQueueRoutes.test.ts`
- `rentchain-api/src/services/landlordDecisionQueue/__tests__/landlordDecisionQueueService.test.ts`
- `rentchain-api/src/lib/payments/__tests__/paymentObligationLedger.test.ts`
- `rentchain-api/src/lib/payments/__tests__/delinquencySignals.test.ts`

Frontend:

- `rentchain-frontend/src/api/landlordDecisionQueueApi.ts`
- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/api/leaseLedgerApi.ts`
- `rentchain-frontend/src/pages/LeaseLedgerPage.tsx`
- `rentchain-frontend/src/lib/decisions/decisionDisplay.ts`

Related docs:

- `docs/audit/decision-routing-model-v1.md`
- `docs/audit/decision-queue-source-of-truth-v1.md`
- `docs/audit/portfolio-status-financial-source-of-truth-v1.md`

## Current Payment Signal Path

Dashboard Decision Queue Preview consumes:

```text
DashboardPage
  -> fetchLandlordDecisionQueue({ status: "open_state", limit: 6 })
  -> GET /api/landlord/decision-queue
  -> loadLandlordAnalyticsSnapshot(...)
  -> deriveLeaseDecisionsForInbox(...)
  -> deriveDecisionInbox(...)
  -> deriveLandlordDecisionQueue(...)
```

For lease-derived payment items, the relevant path is:

```text
deriveLeaseDecisionsForInbox
  -> load landlord leases
  -> load rentPayments
  -> load paymentIntents
  -> load paymentReconciliationRecords
  -> buildPaymentObligationLedgerRows(...)
  -> deriveDelinquencySignals(...)
  -> deriveDecisions(...)
  -> applyDecisionActions(...)
```

Payment-related decisions are then normalized into the landlord decision queue:

- `deriveDecisionInbox(...)` maps payment/rent decision types to `type: "billing"`.
- `deriveLandlordDecisionQueue(...)` maps `type: "billing"` to `workspace: "payments"`.
- Dashboard displays only the queue title, workspace label, due date, severity, and Open button.

## Current Ledger Calculation Path

The lease ledger destination consumes:

```text
LeaseLedgerPage
  -> fetchLeaseLedger(leaseId)
  -> GET /api/leases/:leaseId/ledger
```

The ledger route builds a richer obligation view:

```text
GET /api/leases/:leaseId/ledger
  -> load ledgerEntries
  -> load rentPayments
  -> load paymentIntents
  -> load canonical payments from payments
  -> build canonical payment evidence from ledgerEntries
  -> load paymentReconciliationRecords
  -> buildPaymentObligationLedgerRows(...)
  -> deriveDelinquencySignals(...)
  -> deriveDecisions(...)
  -> summarizePaymentObligationLedger(...)
```

This route includes two payment-evidence sources that the decision queue lease-decision derivation does not currently include:

- canonical/imported `payments` records
- payment evidence synthesized from `ledgerEntries`

That is the key mismatch path.

## Source Of Truth Findings

### Payment Signal Source Of Truth

For current implemented behavior, payment decision signals are generated from the payment obligation ledger and delinquency helpers:

- `buildPaymentObligationLedgerRows(...)`
- `deriveDelinquencySignals(...)`
- `deriveDecisions(...)`

The helpers are the correct source for whether an obligation is missing, overdue, underpaid, overpaid, failed, paid, or requires manual review.

However, the Dashboard queue and the lease ledger do not currently provide identical inputs to those helpers.

### Ledger Calculation Source Of Truth

The lease ledger route is the stronger source of truth for the destination state because it includes:

- explicit lease ledger entries
- canonical/imported payment records
- rent payment records
- payment intents
- reconciliation records
- derived obligation rows
- delinquency signals
- decision rows

The page also enriches decision rows with property/unit/tenant display context from the lease detail projection. This context is not carried into the Dashboard queue preview.

### Route Destination

`/leases/:leaseId/ledger` remains the correct destination for missing, failed, underpaid, overdue, and manual payment review items.

The routing model already assigns payment delinquency to Payments/Ledger ownership. The problem is not the destination. The problem is that the decision preview can be generated from a narrower input set than the destination ledger uses.

## Mismatch Path

The likely path for the observed QA mismatch is:

1. A lease has canonical payment evidence or ledger-entry payment evidence that clears or overpays the obligation.
2. `GET /api/leases/:leaseId/ledger` includes that evidence when deriving obligation rows.
3. The ledger renders `Overpaid`, `Outstanding $0.00`, and no active delinquency.
4. `GET /api/landlord/decision-queue` calls `deriveLeaseDecisionsForInbox(...)`.
5. That derivation does not load canonical `payments` or ledger-entry payment evidence.
6. `buildPaymentObligationLedgerRows(...)` sees the lease obligation without the same payment evidence.
7. `deriveDelinquencySignals(...)` emits `missing_payment` or `overdue`.
8. `deriveDecisions(...)` emits `review_missing_payment`.
9. `deriveLandlordDecisionQueue(...)` normalizes the item to Payments workspace with no due date and a critical/warning preview row.
10. Dashboard shows a critical payment item that the ledger destination does not agree with.

This is primarily a projection/input parity issue between the decision queue generator and the ledger route.

## Display Context Findings

Dashboard currently renders queue rows as:

```text
title
workspace label · due date
severity
Open
```

For the observed item this becomes:

```text
Review Missing Payment
Payments workspace · No due date
critical
```

The normalized queue type does include optional `propertyId`, `unitId`, `tenantId`, and `leaseId` fields, but it does not include safe display labels, amount, due date/period, current ledger state, or alert reason in a Dashboard-ready projection.

This creates two separate UX problems:

1. If the signal is stale or wrong, the dashboard over-escalates.
2. Even if the signal is valid, the dashboard row is too vague for an operator to verify quickly.

## Staleness And Review Action Findings

Decision actions are applied through `applyDecisionActions(...)`, but payment review actions are review-state overlays. They do not modify the financial obligation rows or reconcile payment evidence.

That is correct governance behavior: marking a decision reviewed, snoozed, assigned, dismissed, or resolved must not change ledger facts.

The missing piece is freshness reconciliation. The queue generator should suppress or downgrade payment decision items when the current ledger derivation for the same lease/obligation no longer produces the corresponding delinquency signal.

## Classification

| Candidate cause | Finding |
| --- | --- |
| Stale decision queue data | Possible for persisted review-state overlays, but the main queue is derived live. The stronger issue is narrower live inputs. |
| Incorrect payment signal derivation | The shared helpers appear reasonable and include tests for canonical overpaid payment evidence suppressing missing-payment signals. |
| Ledger calculation mismatch | The ledger route uses richer inputs than the queue path, so the mismatch is route/input parity rather than helper disagreement. |
| Missing reconciliation/refresh behavior | Yes. Queue derivation should reconcile against the same payment evidence set as the ledger before showing active payment decisions. |
| Insufficient decision queue context | Yes. Dashboard preview lacks safe labels, amount, due date/period, reason, and current ledger state. |
| Test/fixture/demo-data inconsistency | Possible, but the code path supports the observed mismatch even without bad data. Demo data may expose the gap. |
| Incorrect route/destination | No. `/leases/:leaseId/ledger` is the right destination for payment decisions. |

## Recommended Follow-Up Mission

```text
fix/payment-decision-ledger-signal-consistency-v1
```

Recommended implementation owner: backend first, with a small Dashboard projection/display update if needed.

### Recommended Scope

1. Reuse or extract a shared lease payment obligation derivation helper so both:
   - `GET /api/leases/:leaseId/ledger`
   - `deriveLeaseDecisionsForInbox(...)` / landlord decision queue

   use the same payment evidence sources.

2. Include canonical/imported payments and ledger-entry payment evidence in the decision queue lease-decision derivation before deriving delinquency decisions.

3. Add a guard that suppresses active `review_missing_payment`, `review_overdue_rent`, or `review_underpaid_rent` queue items when the current obligation summary for the matching lease/period has:
   - `outstandingAmountCents === 0`, and
   - no matching active delinquency signal.

4. Preserve review actions as workflow state overlays only. Do not let review-state actions alter financial records.

5. Improve payment decision queue projections with safe context:
   - property/building safe label when available
   - unit safe label when available
   - tenant safe label only through an existing landlord-safe projection
   - expected amount
   - paid amount
   - outstanding amount
   - due date or period
   - reason for alert
   - current ledger state
   - destination `/leases/:leaseId/ledger`

6. Keep `/leases/:leaseId/ledger` as the destination for these payment items.

7. Add focused backend tests for the parity case:
   - canonical payment overpays the obligation
   - ledger summary shows outstanding zero
   - landlord decision queue does not emit active missing-payment decision

8. Add Dashboard preview test coverage for improved payment context if the frontend row copy changes.

### Acceptance Criteria

- Dashboard does not show `Review Missing Payment` for a lease whose current ledger obligation summary is paid or overpaid with outstanding `$0.00`.
- Decision queue and lease ledger derive payment obligation rows from the same evidence set or a deliberately shared helper.
- Canonical/imported payment evidence clears missing-payment decisions when it clears the ledger obligation.
- Ledger-entry payment evidence clears missing-payment decisions when it clears the ledger obligation.
- Existing failed-payment and underpaid cases still emit queue items when the ledger also shows active failed/underpaid state.
- Dashboard payment rows show enough safe context to understand the issue without exposing raw IDs.
- `/leases/:leaseId/ledger` remains the destination for payment decisions.
- No financial records, payment models, or ledger entries are mutated by the fix.
- No PAD, payment processing, dashboard redesign, or lease ledger redesign is introduced.

## Out Of Scope For Follow-Up

Keep these separate:

- PAD or payment processing implementation.
- Payment data model redesign.
- Financial record mutation or migration.
- Dashboard redesign.
- Lease ledger redesign.
- `/leases` table/card layout clarity.
- Operations reviewer assignment persistence.
- Operations navigation visibility.

## Recommended Priority

Priority: high for RC1 demo readiness.

Rationale: the dashboard is an executive attention surface. A false critical missing-payment signal that routes to a reconciled or overpaid ledger directly weakens trust in the platform's governed workflow model.
