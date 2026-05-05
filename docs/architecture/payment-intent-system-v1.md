# Payment Intent System V1

Status: passive rent-payment obligation layer

## Purpose

PaymentIntent represents RentChain's internal obligation or request to collect money before provider execution happens.

The V1 scope is rent payments only. It does not implement Trustly, change provider selection, alter Stripe checkout behavior, change webhook status transitions, migrate historical records, or replace `rentPayments`.

## Source Of Truth Hierarchy

```text
Lease System = Truth
PaymentIntent = Obligation
Payment Provider = Execution
Reconciliation = Evidence review
Ledger = Financial history
```

Lease lifecycle remains the product truth for whether rent should exist. PaymentIntent records are additive financial obligations derived at checkout time in V1, not a new lease automation engine.

## Model

Collection: `paymentIntents`

Core fields:

- `paymentIntentId`
- `landlordId`
- `tenantId`
- `propertyId`
- `unitId`
- `leaseId`
- `rentPaymentId`
- `purpose: rent`
- `amountCents`
- `currency`
- `periodStart`
- `periodEnd`
- `dueDate`
- `status`
- `provider`
- `providerSessionId`
- `providerPaymentId`
- `source`
- `lifecycleState`
- `requiresReview`
- `createdAt`
- `updatedAt`
- `metadataSummary`

Statuses:

- `draft`
- `ready`
- `provider_session_created`
- `pending_provider_confirmation`
- `pending_settlement`
- `confirmed`
- `failed`
- `cancelled`
- `expired`
- `manual_review_required`
- `reconciled`

Sources:

- `rent_payment_checkout`
- `manual_admin`
- `system_derived`
- `migration_placeholder`

V1 stores amount in cents and stores provider IDs as secondary references. It does not store raw provider payloads.

## Deterministic ID Strategy

Rent checkout PaymentIntent IDs are deterministic from the stable rent obligation fields when available:

```text
landlordId + propertyId + unitId + leaseId + tenantId + purpose + periodStart + periodEnd + amountCents + currency
```

The generated document ID uses a safe hash:

```text
pi_rent:{hash}
```

If critical obligation fields are missing, the helper falls back to available internal subject data such as `rentPaymentId`, then marks the PaymentIntent as:

```text
status = manual_review_required
lifecycleState = requires_review
requiresReview = true
```

This prevents duplicate PaymentIntent records for repeated checkout attempts against the same rent obligation, while still preserving separate `rentPayments` records for the existing checkout history.

## Checkout Integration

Existing Stripe rent checkout remains the execution path:

```text
tenant route
  -> rentPaymentService.createRentPaymentCheckout
    -> upsert PaymentIntent
    -> create existing Stripe Checkout session
    -> link provider session refs to PaymentIntent
    -> write existing rentPayments record
    -> return existing checkout response shape
```

Behavior intentionally preserved:

- Stripe Checkout mode remains `payment`.
- Stripe payment method behavior is unchanged.
- `rentPayments` remains the existing tenant checkout record.
- Tenant response remains `{ rentPaymentId, status, redirectUrl }`.
- Existing rent-payment blocked states remain unchanged.
- Existing Stripe metadata still includes `rentPaymentId`, `leaseId`, `tenantId`, and `landlordId`.

Additive metadata:

- `paymentIntentId` is included in Stripe Checkout Session metadata and PaymentIntent metadata where safe.

## Webhook Linking

The rent-payment webhook branch remains responsible for current `rentPayments` status transitions.

V1 passively links provider evidence back to PaymentIntent by:

1. resolving `paymentIntentId` from provider metadata when present
2. falling back to the `rentPaymentId` mapping when safe
3. updating provider session/payment references on the PaymentIntent
4. adding `paymentIntentId` to provider-event receipts and reconciliation records

Safe status updates are passive and do not drive webhook behavior:

- pending provider signals -> pending states
- confirmed provider signal -> `confirmed`
- failed provider signal -> `failed`
- cancelled/expired provider signal -> matching terminal state
- mismatch/unknown/manual-review signal -> `manual_review_required`

Existing `rentPayments` status update logic remains unchanged.

## Canonical Events

PaymentIntent V1 adds taxonomy for:

- `payment.intent_created`
- `payment.intent_updated`
- `payment.intent_provider_linked`

V1 emits intent-created and provider-linked events only from the rent-payment checkout flow, and only with safe IDs and summary metadata. These events are additive and do not replace provider signal events or rent payment events.

## Relationship To Stripe And Future Trustly

Stripe remains the only live rent-payment execution provider in V1. PaymentIntent is provider-neutral and keeps Stripe IDs as attributes.

Future Trustly work should consume PaymentIntent as the internal obligation, but this mission does not add a Trustly adapter, credentials, UI, or switching logic.

## Payment To Lease Linking

PaymentIntent V1 links the rent obligation chain without replacing existing records:

```text
lease lifecycle
  -> PaymentIntent obligation
    -> rentPayments checkout record
      -> provider receipt
        -> reconciliation record
          -> lease ledger read model
```

The lease lifecycle remains the source of truth for whether an obligation should exist. PaymentIntent stores the obligation context additively:

- `leaseId`
- `propertyId`
- `unitId`
- `tenantId`
- `landlordId`
- `periodStart` and `periodEnd` when available
- `rentPaymentId` when checkout creates an execution record

`rentPayments` continues to exist as the compatibility and checkout-history layer. New checkout records store `paymentIntentId`, and repeated checkout attempts for the same deterministic rent obligation update the same PaymentIntent while preserving separate `rentPayments` records.

Webhook processing resolves the internal PaymentIntent in this order:

1. `paymentIntentId` from provider metadata
2. PaymentIntent lookup by `rentPaymentId`
3. Safe lease-context lookup where enough obligation fields exist

Resolved IDs are attached to provider receipts and reconciliation records. Existing `rentPayments` status transitions still run exactly as before; PaymentIntent is not authoritative for webhook behavior in V1.

Lease ledger reads may include optional `paymentIntentId` and `paymentIntentStatus` for payment rows when the matching rentPayment/PaymentIntent can be resolved. Ledger calculations remain based on existing ledger entries and are not rewritten by PaymentIntent.

## Payment Obligation Ledger Readiness

Payment Obligation Ledger Readiness V1 adds a read-only derivation layer that combines:

```text
lease lifecycle + PaymentIntent + rentPayments + reconciliation records
```

The read model derives obligation rows and summary totals for expected, paid, outstanding, and review-required payment states. It supports `paid`, `underpaid`, `overpaid`, `failed`, `missing`, `pending`, `manual_review_required`, and `unknown`.

Reconciliation evidence wins over otherwise successful-looking payment records when it indicates mismatch, duplicate risk, or manual review. Missing or contradictory payment context fails safely into `manual_review_required` or `unknown`.

V1 keeps PaymentIntent additive and non-authoritative. It does not generate monthly obligations, enforce collections, replace `rentPayments`, mutate leases, or change Stripe checkout/webhook behavior.

## Deferred Future Steps

1. PaymentIntent-driven rent ledger.
2. Monthly PaymentIntent generation from active leases.
3. Reconciliation-driven PaymentIntent status enforcement.
4. Trustly sandbox adapter using PaymentIntent.
5. Landlord/tenant UI for PaymentIntent history.
6. PaymentIntent review queue for incomplete obligations.
7. PaymentIntent-driven retry and expiration workflow.
