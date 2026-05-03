# Payment Execution Boundary v1

Status: implemented as passive backend boundary helpers

Branch: `feat/payment-execution-boundary-v1`

## Purpose

Create the first provider-neutral payment execution boundary for RentChain so Stripe, future Trustly work, manual payments, rent collection, screening checkout, subscriptions, and payouts do not become tangled.

This mission does not implement Trustly, change live Stripe behavior, change UI, migrate schema, or emit new canonical events globally.

## Source Of Truth Hierarchy

1. RentChain payment intent is the expected internal obligation.
2. Provider event or provider signal is external evidence.
3. Reconciliation engine is the business interpretation.
4. Canonical event stream is the permanent audit history.

Provider-specific IDs and statuses are evidence. They are not RentChain product truth by themselves.

## Current Flow Audit

| Flow | Current behavior | Boundary finding |
| --- | --- | --- |
| SaaS subscriptions | `billingRoutes.ts` creates Stripe subscription checkout and portal sessions; subscription state derives from Stripe customer/session/subscription data. | Keep separate from rent and screening payment execution. Plan, pricing, and entitlement semantics are subscription-specific. |
| Rent payments | `rentPaymentService.ts` creates Stripe Checkout sessions, stores `processor: "stripe"`, and maps webhooks into rent payment status. | Future providers need a provider-neutral intent/session boundary before any Trustly work. |
| Screening checkout | `screeningCheckoutExecutionService.ts` and Stripe webhook routes use Stripe sessions/payment intents to mark screening orders paid or failed. | Payment collection should be separable from screening fulfillment. |
| Manual payments | `paymentsRoutes.ts` records persisted/manual payments and ledger events. | Manual remains source attribution only; it has no provider webhook or settlement lifecycle. |
| Financial transactions | `financialTransactionService.ts` stores narrow transaction records; screening callers currently write Stripe-shaped metadata. | Good base for later provider metadata, payout, reversal, and reconciliation events. |
| Canonical events | `buildEvent.ts` writes append-only canonical events, currently without dedicated `payment` or `payout` domains. | This mission defines taxonomy constants but does not globally emit them. |
| Reconciliation | Screening has dedicated reconciliation helpers; rent/provider payment reconciliation is not centralized. | A pure payment reconciliation helper now defines the fail-closed rules. |

## Boundary Modules Added

- `rentchain-api/src/lib/payments/paymentTypes.ts`
  - provider-neutral types for providers, purposes, execution statuses, actor types, provider references, and payment intent references.
- `rentchain-api/src/lib/payments/paymentProviderAdapter.ts`
  - adapter contract plus provider-status normalization helpers.
- `rentchain-api/src/lib/payments/paymentIdempotency.ts`
  - deterministic idempotency key helpers for provider webhooks, session creation, and manual payments.
- `rentchain-api/src/lib/payments/paymentReconciliation.ts`
  - pure reconciliation derivation from expected intent plus normalized provider signal.
- `rentchain-api/src/lib/payments/paymentCanonicalEvents.ts`
  - canonical payment, payout, and affordability event taxonomy constants.

## Provider Evidence Contract

Provider adapters must normalize provider-specific state into `PaymentExecutionStatus` before product services interpret it.

Unknown provider statuses map to `manual_review_required`. This is intentional fail-closed behavior.

Provider adapters must not directly mutate:

- leases
- ledger entries
- tenant activity
- persisted payments
- screening fulfillment
- landlord/tenant read models

Adapters return evidence. Product services and reconciliation decide what the evidence means.

## Reconciliation Authority

`derivePaymentReconciliation` is pure. It accepts:

- expected internal payment intent
- normalized provider signal
- existing reconciliation state

It returns:

- `reconciliationStatus`
- `reasons[]`
- `automationEligible`
- `requiresManualReview`

Rules:

- Missing internal subject reference requires manual review.
- Missing provider signal requires manual review.
- Duplicate provider event becomes `duplicate_risk`.
- Amount mismatch becomes `mismatch` and requires manual review.
- Currency mismatch becomes `mismatch` and requires manual review.
- Confirmed matching provider evidence becomes `reconciled`.
- Pending evidence remains pending and is not automation-eligible.
- Failed, cancelled, or expired evidence becomes failed.
- Unknown status requires manual review.

## Idempotency Strategy

Provider webhook key:

```text
provider_event:{provider}:{providerEventId}
```

Session creation key:

```text
payment_session:{provider}:{purpose}:{subjectId}:{amount}:{currency}
```

Manual payment key:

```text
manual_payment:manual:{landlordId}:{subjectId}:{amount}:{receivedAt}
```

These helpers are deterministic and side-effect free. This mission does not wire them into live flows.

## Canonical Event Taxonomy

Defined constants:

- `payment.intent_created`
- `payment.provider_selected`
- `payment.provider_session_created`
- `payment.provider_signal_received`
- `payment.initiated`
- `payment.pending`
- `payment.confirmed`
- `payment.failed`
- `payment.cancelled`
- `payment.expired`
- `payment.mismatch_detected`
- `payment.duplicate_detected`
- `payment.manual_review_required`
- `payment.reconciled`
- `payment.reconciliation_failed`
- `payout.initiated`
- `payout.completed`
- `payout.failed`
- `affordability.verification_started`
- `affordability.verification_completed`
- `affordability.verification_failed`

This mission defines taxonomy only. Future missions must deliberately expand canonical event domains and event writing before global emission.

## Failure-First Cases

| Case | Boundary behavior |
| --- | --- |
| Duplicate webhook | Deterministic provider event key plus reconciliation `duplicate_risk`. |
| Delayed webhook | Provider signal remains external evidence until reconciled against current intent. |
| Webhook never arrives | Missing provider signal requires manual review or timeout workflow. |
| Provider status unknown | `manual_review_required`. |
| Amount mismatch | `mismatch`, manual review, not automation eligible. |
| Currency mismatch | `mismatch`, manual review, not automation eligible. |
| Payment confirmed but subject missing | Manual review because internal obligation cannot be identified. |
| Payout initiated but not settled | Pending payout state; do not mark landlord paid out. |
| Bank connection revoked | Provider signal should normalize to failed/manual review depending on provider evidence. |
| Manual payment duplicate risk | Deterministic manual payment key gives future workflows a repeatable comparison key. |

## Future Trustly Path

Trustly can be evaluated later by implementing a Trustly adapter that satisfies the provider contract and maps Trustly statuses into provider-neutral execution statuses. That adapter should remain sandbox-only until:

- webhook verification and idempotency are implemented
- consent language is approved
- Canadian rail/product availability is confirmed
- payment and payout reconciliation states are supported
- Stripe behavior remains covered by regression tests

## Stripe Rent-Payment Adapter Seam v1

Status: Stripe rent-payment session creation is now routed through the provider boundary.

What changed:

- `rentPaymentService.ts` still owns RentChain rent-payment record creation, validation, canonical event writes, observability writes, and response shaping.
- Stripe Checkout session creation for rent payments now flows through `paymentExecutionService.createRentPaymentSession`.
- `paymentExecutionService` supports only Stripe for live rent-payment sessions in this phase and fails closed for unknown providers.
- `stripePaymentProvider` is a thin wrapper around the existing Stripe SDK helper pattern and creates the same Checkout Session shape used before.

Why this contains Stripe:

```text
tenant route
  -> rentPaymentService
    -> paymentExecutionService
      -> stripePaymentProvider
        -> existing Stripe SDK helper
```

Behavior intentionally unchanged:

- Stripe Checkout mode remains `payment`.
- Payment method remains card checkout.
- Product label remains `Monthly rent payment`.
- Stripe metadata still includes `leaseId`, `tenantId`, `landlordId`, and `rentPaymentId`.
- PaymentIntent metadata remains the same.
- Success and cancel URLs still append `rentPaymentStatus=success` or `rentPaymentStatus=canceled`.
- `rentPayments` records still use `processor: "stripe"`, `processorCheckoutSessionId`, and `processorPaymentIntentId`.
- Existing rent payment canonical events remain under the existing event behavior.
- Tenant route response shape remains `{ rentPaymentId, status, redirectUrl }`.

Webhook seam decision:

The Stripe webhook route currently handles rent payments, screening payments, and subscription events in one file. This mission leaves webhook persistence behavior unchanged to avoid touching screening or subscriptions. Future work should add a rent-only provider-event normalization seam before any persisted webhook behavior changes.

Out of scope:

- Screening checkout adapter changes.
- SaaS subscription billing changes.
- Payout behavior.
- Provider switching UI.
- Trustly implementation.
- New canonical payment event emission.

Future migration path:

1. Rent payment session creation seam.
2. Rent webhook normalization seam.
3. Provider-neutral persisted rent payment fields.
4. Canonical payment event domain expansion and emission.
5. Trustly sandbox adapter.

## Rent Webhook Normalization Seam v1

Status: Stripe rent-payment webhook interpretation now passes through the provider boundary in read-only mode.

What changed:

- The shared Stripe webhook route still verifies Stripe signatures and handles subscription, screening, and rent-payment events in the same order as before.
- Only the existing rent-payment branch calls `paymentExecutionService.normalizeRentPaymentProviderEvent`.
- `stripePaymentProvider.normalizeProviderEvent` now understands the Stripe webhook shapes used by rent payments:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
- The seam derives the deterministic provider-event idempotency key:

```text
provider_event:stripe:{stripeEventId}
```

- The seam derives reconciliation with `deriveRentPaymentReconciliation` using the current rent payment record and normalized provider signal.

Behavior intentionally unchanged:

- Existing `rentPayments` status transitions remain owned by `updateRentPaymentFromWebhook`.
- Existing Stripe webhook HTTP responses remain unchanged.
- Existing rent-payment canonical events remain unchanged.
- Reconciliation output is not persisted.
- Provider-event receipt/idempotency state is not persisted.
- No new canonical payment events are emitted.
- Screening checkout webhook behavior is untouched.
- SaaS subscription webhook behavior is untouched.

Why reconciliation is read-only:

The current rent-payment records do not yet have provider-neutral payment intent or provider-event receipt persistence. Running reconciliation read-only lets RentChain prove the normalized signal and expected intent can be compared without risking double writes, new status transitions, or webhook retry behavior changes.

Deferred items:

1. Persisted provider-event receipt collection.
2. Active idempotency enforcement for provider webhooks.
3. `payment.provider_signal_received` canonical event emission.
4. Reconciliation state persistence.
5. Provider-neutral rent-payment intent persistence.
6. Trustly webhook adapter.

## Provider Event Receipts v1

Status: provider-event receipts are persisted for rent-payment webhook events only.

What is persisted:

- Collection: `paymentProviderEventReceipts`
- Document id: deterministic receipt id derived from the provider webhook idempotency key.
- Core fields:
  - `receiptId`
  - `idempotencyKey`
  - `provider`
  - `providerEventId`
  - `purpose`
  - `subjectType`
  - `subjectId`
  - `status`
  - `firstReceivedAt`
  - `lastSeenAt`
  - `processedAt`
  - `failedAt`
  - `failureReason`
  - `duplicateCount`
  - `normalizedStatus`
  - `rawStatus`
  - `metadataSummary`

Receipt statuses:

- `received`
- `processing`
- `processed`
- `ignored_duplicate`
- `failed`
- `manual_review_required`

Why this comes before active idempotency enforcement:

The existing Stripe webhook behavior is intentionally preserved. Stripe may retry events, and RentChain's current rent-payment updater is already idempotent for the persisted rent payment status. Persisting receipts first gives support and future reconciliation jobs an audit trail of what arrived, when it arrived again, and how it was interpreted before RentChain starts suppressing duplicate execution paths.

Behavior intentionally unchanged:

- Rent-payment webhook HTTP responses are unchanged.
- Existing `rentPayments` updates are unchanged.
- Existing rent-payment canonical events are unchanged.
- Duplicate provider events are recorded as `ignored_duplicate`, but they do not suppress the existing webhook code path yet.
- Screening checkout webhook behavior is untouched.
- SaaS subscription webhook behavior is untouched.
- Reconciliation remains read-only.

Deferred items:

1. Active duplicate suppression after receipt confidence is proven.
2. Persisted reconciliation state.
3. Provider-neutral `PaymentIntent` persistence.
4. Trustly sandbox adapter.

## Provider Signal Canonical Events v1

Status: rent-payment webhook provider signals emit a canonical audit event after receipt persistence succeeds.

What is emitted:

- Type: `payment.provider_signal_received`
- Domain: `payment`
- Action: `provider_signal_received`
- Resource: provider-event receipt
- Parent resource: rent payment
- Visibility: `internal`

Safe metadata only:

- `provider`
- `providerEventId`
- `idempotencyKey`
- `receiptId`
- `purpose`
- `normalizedStatus`
- `rawStatus`
- `subjectType`
- `subjectId`

Why emission happens after receipt persistence:

The provider receipt is the stable audit anchor for provider webhook evidence. Emitting after the receipt write means the canonical event can reference the receipt id and idempotency key without storing raw provider payloads or depending on later rent-payment status updates.

Behavior intentionally unchanged:

- Existing webhook HTTP responses are unchanged.
- Existing `rentPayments` status updates are unchanged.
- Duplicate provider events are still not actively suppressed.
- Reconciliation remains read-only.
- Screening checkout webhook behavior is untouched.
- SaaS subscription webhook behavior is untouched.
- No Trustly adapter or Trustly events are implemented.

Deferred items:

1. Active duplicate suppression.
2. Persisted reconciliation state.
3. Provider-neutral `PaymentIntent` persistence.
4. Trustly sandbox adapter.

## Intentional Non-Implementation

This mission intentionally does not:

- implement Trustly
- create Trustly credentials
- change Stripe checkout
- change screening checkout behavior
- change SaaS billing behavior
- change manual payment behavior
- add UI
- migrate schema
- emit new payment canonical events globally
- alter pricing, plans, subscriptions, or screening business rules
