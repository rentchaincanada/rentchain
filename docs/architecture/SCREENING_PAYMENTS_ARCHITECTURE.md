# Screening / Payments Integration Architecture v1

## Purpose

Define a founder-grade, implementation-ready architecture blueprint for:

- screening monetization
- payment rails placement
- narrow transaction recording
- staged rollout sequencing

This document is planning-first. It is not a provider launch plan, not a compliance buildout, and not a full accounting design.

---

## Non-goals

This architecture does not assume:

- RentChain becomes a funds-holding entity
- a full Stripe Connect rollout in v1
- a full general ledger or accounting platform
- a single permanent provider choice for every screening or payment capability
- immediate automation of reconciliation, autopilot, or control-layer decisions

---

## Design Principles

1. Operations truth comes first.
   Product workflows must have a durable operational state before financial events are derived from them.

2. Financial truth is narrow and explicit.
   Record only the transaction events needed for product, reconciliation, and margin visibility.

3. Providers stay behind service boundaries.
   Screening bureaus and payment rails must sit behind dedicated orchestration/service layers rather than leaking into product logic.

4. Reconciliation is a first-class boundary.
   Every charge, provider cost, settlement expectation, payout expectation, or expense link should have a clear place where it can be checked later.

5. Rollout stays staged.
   Screening monetization can mature ahead of full rent/deposit payment rails.

---

## Current-State Audit

### Screening touchpoints already present

Frontend:

- `rentchain-frontend/src/api/rentalApplicationsApi.ts`
  - screening quote
  - screening run
  - screening order creation / checkout
  - screening receipt / events / result fetch
- `rentchain-frontend/src/api/screeningApi.ts`
  - screening request / run / checkout / history
- `rentchain-frontend/src/api/tenantScreeningApi.ts`
  - tenant consent / status / start / retry
- multiple tenant/admin screening pages and detail surfaces already exist

Backend:

- `rentchain-api/src/types/screeningOrders.ts`
  - screening order status
  - payment status
  - Stripe session / payment intent references
- `rentchain-api/src/routes/stripeScreeningOrdersWebhookRoutes.ts`
  - Stripe webhook processing
  - application screening paid transition
  - screening start trigger after payment
- `rentchain-api/src/services/screening/*`
  - screening orchestrator
  - provider abstraction / adapters
  - event writing
  - history / report access
- `rentchain-api/src/services/integrations/transunion/*`
  - current bureau path exists

Current-state conclusion:

- screening monetization is already the most mature fintech-adjacent surface in the repo
- screening already has order, payment, webhook, and provider orchestration primitives
- this should be the first revenue-grade integration track

### Payment and deposit touchpoints already present

Frontend:

- `rentchain-frontend/src/api/paymentsApi.ts`
  - payment list / update / monthly property and tenant summaries
- `rentchain-frontend/src/api/leaseLedgerApi.ts`
  - lease charge / payment entries
- `rentchain-frontend/src/api/tenantPortal.ts`
  - deposit and payment status fields on tenant-visible lease/workspace data
- tenant application / status / payments pages already surface:
  - deposit requested
  - payment status
  - payment method expectations

Backend:

- `rentchain-api/src/routes/paymentsRoutes.ts`
  - manual payment recording
  - monthly summaries
  - property monthly endpoint still stubbed
- existing lease ledger and payment event patterns exist
- current implementation appears operational/manual rather than payment-rail-native

Current-state conclusion:

- payments exist as product/state primitives today
- rails-native collection, settlement, and payout logic are not yet mature
- rent/deposit money movement should be architected, but not rushed into full implementation

### Billing touchpoints already present

Frontend:

- `rentchain-frontend/src/api/billingApi.ts`
  - billing history
  - subscription status
  - plan checkout
  - pricing / health

Backend:

- `rentchain-api/src/routes/billingRoutes.ts`
  - pricing
  - subscription checkout / portal
  - billing history
- billing service/store is present but lightweight

Current-state conclusion:

- subscription billing exists as a separate concern from transactional money movement
- screening monetization must not be confused with plan subscription billing

### Maintenance-financial touchpoints already present

Frontend:

- maintenance request cost capture
- work order cost review
- expense linkage
- property maintenance financial intelligence

Backend:

- `rentchain-api/src/lib/maintenanceCost.ts`
  - normalized cost review state
  - explicit linked expense status

Current-state conclusion:

- maintenance already demonstrates a good operational-financial pattern:
  - operational object first
  - reviewed cost second
  - expense linkage third
- this is the best current reference for how narrow reconciliation boundaries should work elsewhere

---

## Target Architecture Overview

```text
Product workflows
  -> domain orchestration
    -> provider boundary
      -> transaction event ledger
        -> reconciliation + reporting surfaces
```

The architecture should split into four layers:

1. Product workflow layer
   - rental application screening
   - deposit requested / paid
   - rent payment initiated / settled
   - maintenance cost linked to expense

2. Domain orchestration layer
   - screening order orchestration
   - payments orchestration
   - payout / reconciliation orchestration
   - ledger event writer

3. Provider boundary layer
   - screening providers
   - payment rail providers
   - payout provider or partner

4. Financial truth layer
   - narrow transaction ledger
   - provider reference mapping
   - reconciliation checkpoints

---

## Future-State Screening Monetization Architecture

### Recommended workflow

```text
Landlord selects screening package
  -> quote screening price
  -> create screening order
  -> collect payment intent / checkout session
  -> mark screening order paid
  -> start provider workflow
  -> record provider outcome
  -> record revenue / provider-cost / margin events
  -> expose receipt + history + admin reconciliation state
```

### Boundary rules

- The rental application remains the product truth for applicant state.
- The screening order becomes the commercial transaction container.
- Screening provider adapters handle bureau interactions.
- Payment provider integration handles collection, intent/session references, and webhook confirmation.
- The narrow ledger records the financial truth derived from the screening order lifecycle.

### Recommended responsibilities by object

`rentalApplication`

- applicant workflow truth
- landlord / property / unit context
- screening eligibility state
- screening status summary for product UI

`screeningOrder`

- price quoted
- selected package
- checkout/payment references
- provider request references
- payment and provider execution state

`screeningEvent`

- operational timeline
- webhook and state audit

`transaction ledger event`

- commercial / financial truth
- charge, provider cost, margin, refund, settlement expectation

### Revenue model recommendation

For v1 architecture:

- treat applicant-paid screening as the first monetization track
- record the charged amount as gross screening revenue event
- record provider cost separately when known or contractually incurred
- derive platform margin from the difference between the two

Do not fold this into subscription billing records.

### Reconciliation points

- checkout session created but not paid
- paid webhook received but screening not started
- provider started but report not returned
- report returned but provider cost not recorded
- refund or failed payment after initial commercial event

---

## Future-State Payment Rails Architecture

### Scope boundary

Payment rails in this architecture cover:

- deposit collection
- first payment collection
- rent payment collection
- convenience fees if introduced later
- payout expectations to landlord-side recipients if applicable

This architecture does not assume RentChain directly holds tenant funds long term.

### Recommended placement

```text
Lease / payment obligations
  -> payments orchestration service
    -> payment rail provider
      -> webhook / provider callback ingestion
        -> transaction ledger event writer
          -> lease/payment summary updates
```

### Domain split

`lease / tenancy domain`

- what is owed
- when it is due
- who owes it
- what status is visible to tenant / landlord

`payments orchestration domain`

- initiation
- provider references
- status mapping
- payout expectation and settlement checkpoints

`transaction ledger domain`

- immutable operational-financial events
- success / failure / reversal / payout expectation events

### Payment status mapping recommendation

Product-facing payment state should stay simple:

- requested
- pending
- succeeded
- failed
- refunded
- needs_attention

Ledger-facing events should be more explicit:

- initiated
- authorized
- captured
- failed
- reversed
- settled
- payout_expected
- payout_completed

### Rent and deposit architecture recommendation

Phase sequencing should be:

1. preserve existing manual/operational payment recording
2. introduce transaction event recording around rail events
3. add deposit collection rail before full rent-autopay orchestration
4. add payout/reconciliation later

Why:

- deposit and screening are narrower and easier to reconcile than recurring rent
- rent rails introduce higher support, retry, dispute, and reconciliation burden

---

## Provider Boundary Recommendations

### Screening providers

Provider abstraction should continue to support:

- quote
- checkout creation or referral handoff
- report retrieval
- webhook handling
- error/status normalization

Do not let provider-specific fields become product truth outside the orchestration and reference layers.

### Payment providers

Recommended provider-neutral capabilities:

- payment intent or checkout session create
- payment status fetch
- webhook event normalize
- refund request
- payout status fetch

Store provider references, not provider behavior, in product objects.

---

## Role Boundaries

### Applicant / tenant

- can consent to screening
- can complete screening payment if applicant-paid
- can see only their own payment/screening state
- cannot see internal provider-cost or platform-margin details

### Landlord

- can trigger screening workflow
- can view commercial completion state
- can view payment/deposit state relevant to lease operations
- should not directly manage provider settlement internals in v1

### Admin / operations

- can reconcile failed or stuck payment/screening states
- can inspect provider references and ledger events
- can resolve exceptions without mutating product history silently

---

## Reconciliation Model

Every monetized workflow should define:

1. product source object
2. provider transaction reference
3. ledger event sequence
4. exception states
5. admin repair path

### Recommended reconciliation pairs

Screening:

- screening order vs Stripe payment intent/session
- screening order vs provider request/report
- screening gross charge vs provider cost event

Payments:

- payment request vs provider payment intent
- payment success vs lease-visible payment status
- payout expected vs payout completed

Maintenance:

- work order cost vs linked expense

---

## Recommended Rollout Sequence

### Phase 1 — Screening monetization hardening

Build first:

- screening order commercial lifecycle cleanup
- explicit transaction ledger events for screening charge / provider cost / margin
- stronger admin reconciliation views for screening orders

Why first:

- narrowest path to monetized financial truth
- current repo already has the most supporting primitives here

### Phase 2 — Deposit collection architecture execution

Build second:

- deposit payment intent model
- payment webhook normalization
- tenant / landlord deposit state driven from provider-backed events

Why second:

- narrower than recurring rent
- strong user value
- easier reconciliation than monthly rent

### Phase 3 — Narrow rent payment rails integration

Build third:

- payment orchestration service
- rail-native transaction events
- lease / ledger synchronization

Hold back:

- autopay
- advanced retries
- split payouts
- collections/dispute automation

### Phase 4 — Control layer and autopilot readiness

After operational and ledger truth are stable:

- exception routing
- reconciliation ops queues
- agentic assist / autopilot suggestions

---

## Risks and Watchouts

- Mixing subscription billing and transactional money movement will create confusing records.
- Treating provider webhooks as product truth without normalization will create brittle state.
- Building a broad accounting schema too early will slow delivery and raise correctness risk.
- Launching full rent rails before deposit/screening reconciliation is stable will widen operational risk.
- Letting provider-specific concepts leak into UI copy will create lock-in and migration pain.

---

## Future Missions This Doc Enables

- screening transaction ledger event implementation
- screening reconciliation admin surface
- deposit payment orchestration v1
- rail-backed tenant payment status normalization
- payout expectation tracking
- operations control layer for payment/screening exceptions

