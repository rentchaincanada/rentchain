# PAD Technical Design v1

Status: future-state design only; PAD is not implemented

## Executive Summary

Canadian pre-authorized debit (PAD) is RentChain's highest-priority missing enterprise capability. At the enterprise reference of `$30/unit/year`, a 3,000-unit operator represents `$90,000/year`; this context justifies careful design, not a shortcut around payment, legal, or operational controls.

The first implementation should be processor-led. RentChain should not hold tenant or landlord funds. RentChain should own lease-linked workflow context, authorization evidence, obligation scheduling, provider orchestration, projections, reconciliation, notifications and audit history. A selected processor should collect and tokenize bank details, manage the payment-method and mandate objects where possible, execute the debit and supply signed status evidence.

PAD must be:

- linked to an authoritative lease and versioned rent obligation;
- affirmatively authorized by the tenant under counsel-approved terms;
- initiated only against an active, verified mandate;
- asynchronous, idempotent and reconciliation-led;
- visible through separate landlord/property-manager and tenant-safe projections;
- append-safe and reviewable when evidence is missing or contradictory.

No production debit may occur until provider, legal/compliance, privacy, security, reconciliation, support and pilot gates pass.

## Current-State Findings

### Active foundations to reuse

| Area | Current implementation | Reuse decision |
| --- | --- | --- |
| Card rent collection | `rentPaymentService.ts` creates tenant-initiated Stripe Checkout sessions and `rentPayments` records after server-side lease/tenant eligibility checks. | Reuse the service/provider boundary and tenant authority pattern; do not force PAD into card checkout statuses. |
| Provider boundary | `paymentExecutionService.ts`, provider adapter types and Stripe adapter isolate session creation and event normalization. | Extend through a PAD-specific adapter capability in a future mission, not provider conditionals in routes. |
| Internal obligations | `paymentIntents` stores provider-neutral rent obligation context, cents, currency, lease links and review state. | Reconcile terminology before build: future `rentObligations` should be schedule truth; provider PaymentIntents should remain execution references, not monthly schedule authority. |
| Webhook evidence | The shared Stripe webhook verifies the Stripe signature. Rent-provider event receipts and reconciliation records support deterministic receipt IDs, deduplication and manual-review outcomes. | Reuse signature verification and receipt-before-projection patterns. Split a PAD event handler from screening/subscription branches before live use. |
| Reconciliation | Pure reconciliation detects missing subjects, duplicates, amount/currency mismatch and unknown statuses. | Reuse and extend with delayed settlement, return and mandate comparisons. |
| Ledger/read models | Lease ledger, tenant ledger, payment-obligation readiness and tenant financial projections combine leases, `paymentIntents`, `rentPayments` and reconciliation evidence. | Add PAD through additive projections; do not rewrite current ledger or mark `pending` as paid. |
| Audit | Rent payments and PaymentIntent linking emit canonical events; evidence governance excludes bank details and raw provider payloads. | Add a PAD event taxonomy through the canonical event service with safe references and append-safe semantics. |
| Tenant visibility | Authenticated tenant checkout/history, payment summary and receipt-summary surfaces already use lease ownership and whitelist projections. | Reuse workspace authority and projection builders; add PAD fields only through explicit allowlists. |
| Landlord visibility | Lease payment-rail enablement and lease payment projections are landlord-scoped. | Replace the generic enablement concept with explicit PAD readiness/mandate policy in a future design-to-build mission. |
| Notifications | Tenant notification preferences/inbox, structured notifications and email delivery patterns exist. | Reuse delivery infrastructure, but persist PAD notice content/version and delivery evidence separately from payment truth. |
| Tests | Focused tests cover rent checkout, webhook normalization, PaymentIntent linking, provider receipts, reconciliation, tenant payments and lease ledger. | Extend with mandate, schedule, delayed failure/return, authorization and projection suites. |

### Prototype that must not be extended as production PAD

`papMandateRoutes.ts`, `papMandateService.ts` and `papSchedulerRoutes.ts` are legacy prototypes. Repository search found no application mounting for these routers. The route files have no authentication middleware, accept bank-routing fields from request bodies, default mandates to active, and the scheduler merely emits a `RentPaymentAttempted` event. It does not initiate a processor debit, persist provider evidence, reconcile settlement or handle returns.

Future PAD work should quarantine/deprecate this prototype and create governed service boundaries. It must not expose or migrate prototype bank fields into a production model without a separately approved data-handling review.

### Current limitations

- Current live rent execution is Stripe-oriented card checkout, not PAD.
- Existing monthly obligation generation is not authoritative or automated.
- Current receipt UI is a payment summary, not a legally reviewed PAD receipt.
- No landlord settlement account model or payout ownership decision is approved.
- No 3,000-unit schedule, queue, webhook or reconciliation load evidence exists.
- No production PAD terms, tenant authorization, processor contract or counsel approval exists.

## Provider Strategy

### Decision criteria

Phase 0 must compare providers on Canadian PAD eligibility, merchant/payee model, landlord onboarding, settlement destination, mandate ownership, hosted bank collection, verification fallback, fixed/variable schedules, debit notification, failure/return codes and timing, dispute handling, webhook quality, idempotency, sandbox fidelity, reporting/export, data residency/privacy, pricing, support, RPAA status and contract allocation.

### High-level comparison

| Option | Strengths to validate | Material questions | Posture |
| --- | --- | --- | --- |
| Stripe ACSS debit | Existing Stripe footprint; SetupIntent/mandate and PaymentIntent primitives; hosted/tokenized collection; signed webhooks; documented sandbox cases. | Which party is payee/merchant; direct vs platform/connected-account flow; landlord onboarding and settlement; mandate portability; delayed failure/return behavior; account eligibility and economics. | Preferred first feasibility track, not a final selection. |
| VoPay or comparable Canadian EFT/PAD platform | Canadian EFT/PAD focus, tokenized accounts, scheduled payments and digital debit agreement capabilities. | Custody/settlement model, sponsorship, merchant onboarding, mandate responsibility, webhook/status semantics, data handling, pricing and operational support. | Run a structured alternative-provider review to avoid lock-in. |
| Rotessa or comparable PAD platform | PAD-focused platform and connected-platform model may reduce custom rail work. | API/webhook depth, per-landlord onboarding, authorization evidence, reconciliation/export, scale, commercial and regulatory allocation. | Consider if its operating model fits property-manager portfolios. |
| Manual/offline PAD recording | Can document payments executed outside RentChain. | Cannot be represented as automated collection or provider-confirmed settlement. | Fallback record only, always labeled external/manual and reviewable. |

Provider marketing or documentation does not establish legal suitability. Procurement, counsel, privacy, security and financial-operations review remain mandatory.

### Stripe-oriented feasibility shape

If Stripe is selected:

- use a Stripe-hosted or Stripe-controlled bank-detail/mandate collection surface where supported;
- use a SetupIntent to save a verified ACSS debit payment method for future off-session use;
- store only opaque Customer, PaymentMethod, Mandate and SetupIntent references;
- create a PaymentIntent for each approved off-session debit against the applicable mandate;
- configure payment method eligibility through Stripe settings/configuration and required ACSS mandate options rather than copying legacy hard-coded payment-method arrays;
- treat ACSS as delayed-notification: initiation and processing are not settlement;
- consume verified webhook events into immutable provider-event receipts before projecting state;
- use restricted API keys with minimal permissions, separate environment keys and secrets-manager storage;
- do not choose a Connect charge/funds-flow pattern until payee, statement descriptor, negative-balance liability, fees, onboarding and mandate scoping are approved.

For a new Connect design, evaluate the current Accounts v2/controller-property model and hosted onboarding. Do not inherit legacy account-type assumptions from unrelated billing code.

## Future Architecture

```text
lease lifecycle and approved rent terms
  -> versioned rent obligation generator
    -> eligible obligation + active mandate
      -> notice evidence and collection approval
        -> provider adapter creates debit request
          -> signed provider event receipt
            -> normalized payment attempt transition
              -> reconciliation
                -> ledger projection + receipt/failure record
                  -> tenant/landlord notification + audit evidence
```

### End-to-end flow

1. An authorized landlord or property manager enables PAD policy for an eligible property/lease; this creates no debit.
2. RentChain creates a tenant authorization invitation tied to the lease, tenant, payee context, agreement version and allowed schedule.
3. The authenticated tenant opens a provider-controlled bank collection and mandate flow and affirmatively authorizes it.
4. The provider verifies/tokenizes the bank account and returns opaque customer, payment-method, mandate and setup references.
5. RentChain records a mandate only after server-side provider confirmation and agreement-evidence checks.
6. A deterministic generator previews versioned monthly rent obligations from the authoritative lease; apply requires appropriate approval and a matching preview fingerprint.
7. A collection worker selects an eligible obligation, active mandate and satisfied notice gate, then creates one idempotent payment attempt.
8. The provider initiates the debit. Attempt status moves through queued/processing/pending settlement and only later to succeeded, failed or returned based on verified evidence.
9. Reconciliation compares the obligation, mandate, attempt, provider event, amount, currency and settlement/payee context.
10. Ledger projections, receipts/failure records and notifications update from reconciled evidence; append-safe audit history records every material action.

## Component Boundaries

### Future frontend surfaces

- Tenant: PAD invitation, agreement context, hosted authorization, verification status, mandate detail/cancellation, upcoming debit, payment timeline, receipt/failure and support guidance.
- Landlord/PM: PAD readiness, mandate status, obligation preview, upcoming debit/exception queue, failed/returned workflow, reconciliation and export.
- Admin/support: restricted event/attempt inspection, safe provider references, mismatch review and future controlled replay. No raw bank details, secrets or unrestricted provider payloads.

### Future backend boundaries

- `padMandateService`: invitation, provider setup reconciliation, status and cancellation.
- `rentObligationService`: pure preview plus idempotent versioned apply from lease truth.
- `padPaymentExecutionService`: provider-neutral initiation capability and adapter selection.
- `padProviderEventService`: signature-verified receipt, normalization and deduplication.
- `padReconciliationService`: pure comparison plus append-safe persisted outcome.
- `padNoticeService`: approved templates, notice policy, delivery evidence and retry.
- `padReceiptService`: tenant-safe receipt metadata after reconciled success.
- `padSupportReviewService`: role-gated, purpose-limited manual decisions.

Routes should be thin, authenticated and server-authoritative. Scheduled work must use an authenticated job boundary, never a public GET endpoint.

## Role Access

### Landlord / property manager

May view only records within server-resolved authority: mandate readiness/status (not bank details), upcoming obligations/debits, attempt and reconciliation status, privacy-safe failure/return categories, reviewed retry/NSF state, receipts/exports and audit timeline. Enabling policy, approving schedule exceptions, retrying or pausing collection requires a named permission and audit reason.

### Tenant

May authorize only their own lease-linked mandate, view agreement/version/status, upcoming debit amount/date, payment state, receipts and privacy-safe failures, and request cancellation/change under approved policy. Tenant projections must not expose landlord settlement data, processor payloads, internal IDs, other occupants' sensitive data or support notes.

### Admin / support

May inspect safe provider references, receipt/reconciliation state and audit history only under purpose-limited role access. Any replay or manual transition tool is future work and must be allowlisted, reasoned, idempotent and audited. Support cannot activate a mandate, fabricate success or bypass tenant authorization.

## Source Of Truth

```text
lease = whether and how rent is owed
rent obligation = versioned amount and due period
mandate = authorization eligibility
payment attempt = execution request
provider receipt = external evidence
reconciliation = trusted comparison outcome
ledger/receipt = projected financial history
```

Provider status never mutates a lease. Notifications never determine payment truth. A manual payment can satisfy an obligation through an explicit allocation/reconciliation record, but it cannot be rewritten as a PAD success.

## Non-Goals

- Production payment or Stripe/ACSS code.
- Funds custody, wallet balances or a RentChain settlement account.
- Billing/subscription, pricing, auth or screening changes.
- Autonomous retries, collections, arrears enforcement or tenant decisions.
- Full accounting/general-ledger replacement.
- Direct Yardi write-back or big-bang migration.

## Primary Design References

- [Stripe ACSS debit overview](https://docs.stripe.com/payments/acss-debit)
- [Stripe saving ACSS details for future payments](https://docs.stripe.com/payments/acss-debit/set-up-payment)
- [Stripe accepting ACSS debit](https://docs.stripe.com/payments/acss-debit/accept-a-payment)
- [Payments Canada Rule H1](https://www.payments.ca/sites/default/files/h1eng.pdf)
- [VoPay digital debit agreement](https://docs.vopay.com/docs/digital-debit-agreement)
- [Rotessa platform documentation](https://rotessa.com/platform-documentation/)

These references are implementation inputs, not legal approval or a provider decision.
