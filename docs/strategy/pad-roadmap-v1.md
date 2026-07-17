# Canadian PAD Rent Collection Roadmap v1

Status: planning only; PAD is not implemented

Architecture posture: processor-led, no direct funds custody

## Strategic Importance

PAD is the most important missing revenue-critical enterprise feature identified for RentChain. It turns payment readiness into a recurring rent-collection workflow while strengthening the usefulness of leases, tenant records, ledgers, notifications, reconciliation and evidence. It must not be treated as a payment-method toggle.

An old PAP mandate/scheduler prototype currently emits `RentPaymentAttempted` events. It does not initiate debits, receive provider settlement evidence, handle returns, reconcile payouts, or establish production compliance. Existing Stripe card rent payments and provider-neutral reconciliation seams are reusable foundations, not PAD completion.

## Recommended Funds Flow

Use a Canadian PAD/ACSS-capable processor first, with Stripe ACSS debit as a provider candidate rather than a final selection. Stripe documents hosted bank-account collection, mandate handling, instant verification with micro-deposit fallback, and Canadian ACSS debit support. Payments Canada Rule H1 governs PAD authorization and related requirements.

```text
tenant bank account
  -> regulated processor / financial institution
    -> landlord-designated settlement destination

RentChain
  -> captures workflow context and provider references
  -> schedules authorized debit requests
  -> consumes verified provider events
  -> records reconciliation, notices and audit evidence
  -> does not hold tenant or landlord funds
```

Provider selection must validate Canadian availability, account model, landlord onboarding/KYC, settlement routing, mandate responsibility, verification, return codes/timing, dispute handling, webhooks, reporting, data residency/privacy, pricing, support and RPAA status. Do not select on API ergonomics alone.

## Tenant Authorization Flow

1. Landlord proposes PAD for an eligible active/signed-future lease; no debit is created.
2. Tenant sees payee identity, lease/property context, fixed or variable terms, amount/schedule basis, notice rules, cancellation method, contact details, privacy terms and processor disclosure.
3. Tenant enters bank details only through the processor-hosted/tokenized surface.
4. Processor verifies the bank account and returns opaque references/status; RentChain stores no raw account number.
5. Tenant affirmatively accepts the PAD agreement. Record agreement version, presented terms, timestamps, actor, IP/device evidence only if approved, provider mandate reference, lease context, and consent evidence.
6. Mandate remains `pending_verification` until provider confirmation; never schedule from client-only state.
7. Tenant and landlord receive a durable confirmation record.
8. Tenant can view status and submit cancellation. Cancellation stops future initiation after applicable cutoffs but does not erase rent obligations or history.

Suggested mandate states:

`draft -> pending_authorization -> pending_verification -> active -> suspended | cancellation_pending -> cancelled | expired | failed_review`

Fixed and variable PADs must be distinct. Counsel and the processor must approve agreement language, pre-notification/waiver behavior, change notices and cancellation timing before implementation.

## Rent Schedule And Obligation Model

Lease lifecycle remains the authority for whether an obligation should exist. A versioned schedule generator should produce immutable obligation versions, not silently rewrite history.

Each obligation should contain canonical lease/tenant/property references, rental period, due date/time zone, expected amount/currency, proration basis, source lease version, adjustment lineage, collection eligibility, mandate reference and status.

Rules must be explicit for:

- monthly due dates, weekends/holidays and time zone;
- partial first/last periods and approved proration method;
- move-in, move-out, termination and possession-date changes;
- rent increases and renewals, with future-effective versions;
- credits, concessions, manual adjustments and starting balances;
- arrears kept separate from the current-period obligation;
- multiple tenants and whether payment responsibility is joint or allocated;
- a freeze window after which changes require operator review.

Never infer a debit amount from an editable client display. Generate a preview, require operator confirmation where policy demands it, and record the exact obligation version used.

## Payment Lifecycle

Suggested attempt states:

`scheduled -> notice_pending -> notice_sent -> initiation_queued -> initiated -> pending -> succeeded | failed | returned | cancelled | manual_review_required`

- A worker queues eligible attempts using deterministic idempotency keys based on mandate, obligation version and attempt number.
- Only the provider can confirm initiation, success, failure or return evidence.
- Webhook receipt is authenticated, durably deduplicated and stored before state projection.
- Unknown, contradictory, duplicate, missing-subject, amount-mismatch and currency-mismatch events fail to manual review.
- `pending` is not paid. A successful initiation is not final settlement.
- Return/NSF codes use a normalized internal taxonomy while preserving a restricted provider reference.
- Retry is opt-in policy, capped, notice-aware, and never autonomous when mandate, amount, lease or account state is ambiguous.
- Manual override means “record a reviewed decision,” not “force success.” Actor, reason and evidence are mandatory.

Landlords see obligation/attempt status, next action, reconciliation and restricted failure reason. Tenants see their amount, due date, mandate, notices, receipt/failure state and support/cancellation path without internal IDs or provider payloads.

## Ledger, Reconciliation And Payout View

Preserve the existing source hierarchy:

```text
lease lifecycle = obligation authority
scheduled obligation = amount due
payment attempt = execution
provider event = external evidence
reconciliation = comparison result
ledger = append-safe financial history
```

Write append-safe entries for obligation creation/change, notice, initiation, pending, success, failure/return, retry decision, receipt, cancellation and reconciliation. Corrections reverse or supersede; they do not rewrite prior evidence.

The landlord reconciliation view should compare obligation, collected amount, fees, provider settlement/payout evidence, expected/actual dates, exceptions and export batch. It must not label a landlord “paid out” without provider evidence. Export CSV/PDF records need stable public references, period, amount, status, timestamps and adjustment lineage, without raw bank details or internal Firestore IDs as labels.

## Notifications

| Notification | Recipient | Trigger / evidence |
| --- | --- | --- |
| Upcoming debit | Tenant | Approved pre-notification rule; exact amount/date/mandate context and immutable delivery record. |
| Debit initiated/pending | Tenant, optional landlord | Verified provider initiation; clearly not a receipt. |
| Successful payment | Tenant and landlord | Provider success plus reconciliation; receipt reference. |
| Failed/returned payment | Tenant and landlord | Normalized provider event; privacy-safe reason and next step. |
| Retry notice | Tenant; landlord visibility | Reviewed/capped retry decision and new date/amount. |
| Mandate cancellation | Tenant and landlord | Effective date, future-attempt impact and remaining lease obligation disclaimer. |
| Exception alert | Authorized operator/admin | Mismatch, duplicate, unknown event, missed webhook or reconciliation failure. |

Delivery failure must be visible and retryable; it must not change payment truth.

## Compliance And Legal Gate

This roadmap is not legal advice. Canadian payments/privacy counsel must approve the final funds flow and tenant documents before beta.

- Payments Canada Rule H1: PAD agreement class and content, electronic authorization, confirmation, fixed/variable treatment, pre-notification and waiver, change notices, cancellation/revocation, reimbursement/recourse, records and sponsorship/processor allocation.
- Consumer/tenancy law by launch province: rent-payment method constraints, consent, fees, NSF terms, receipts, notices, arrears and lease-language interaction.
- Privacy: processor disclosures, consent, minimization, token/reference storage, access, retention/deletion, incident response, cross-border processing, privacy policy and vendor terms.
- Contracting: terms of use, PAD agreement, landlord agreement, processor terms, prohibited use, support/dispute allocation and service levels.
- RPAA: counsel must determine whether RentChain performs an in-scope payment function even without custody. Since September 8, 2025, in-scope PSPs face registration and operational-risk, incident, safeguarding (if applicable) and reporting obligations.
- FINTRAC/MSB: obtain a written activities/funds-flow analysis; do not assume processor use or no custody automatically resolves it.
- Insurance: confirm cyber, technology E&O, crime, payment/funds-transfer and regulatory coverage and exclusions.
- Evidence: approve authorization, notice, webhook, decision and cancellation retention periods, legal holds, access controls and export procedure.

Primary references for design review:

- [Stripe ACSS debit documentation](https://docs.stripe.com/payments/acss-debit)
- [Payments Canada Rule H1](https://www.payments.ca/sites/default/files/h1eng.pdf)
- [Bank of Canada retail payments supervision](https://www.bankofcanada.ca/regulatory-oversight/retail-payments/)
- [Bank of Canada PSP registration criteria](https://www.bankofcanada.ca/regulatory-oversight/retail-payments/supervisory-framework/)

## Technical Architecture Outline

Names below are conceptual and require a later design mission.

### Frontend surfaces

- Tenant: PAD offer/terms, hosted bank verification, authorization confirmation, mandate details/cancellation, schedule, payment timeline, receipt/failure and support.
- Landlord/PM: enablement/readiness, lease-linked mandate status, schedule preview/approval, attempt exceptions, retry/manual decision, reconciliation, exports and alerts.
- Support/admin: restricted exception inspection, webhook/reconciliation evidence, mandate history and audited remediation—never raw bank credentials.

### API/service boundaries

- Mandate offer, authorization-session, status and cancellation routes.
- Obligation schedule preview/apply and adjustment routes.
- Debit initiation orchestration and provider adapter.
- Authenticated webhook ingestion, receipt store and replay-safe projector.
- Reconciliation, notification, receipt/export and support-review services.
- Server-side landlord/PM/tenant authority on every read and action.

### Likely Firestore entities

- `padMandates`: opaque provider references, agreement/version evidence, lease context and status.
- `rentObligations`: immutable/versioned amounts and due dates.
- `paymentAttempts`: provider-neutral execution state and idempotency key.
- `paymentProviderEventReceipts`: deduplicated restricted evidence.
- `paymentReconciliations`: derived comparison and manual-review status.
- `paymentNotices` / `paymentReceipts`: content version and delivery evidence.
- canonical audit events for all material state transitions.

Do not store raw bank-account data. Tenant projections must be explicit whitelists. Provider payloads and internal identifiers remain restricted.

## Test And Sandbox Strategy

- Pure tests: schedule generation, proration, state machines, authorization eligibility, retry policy, idempotency and reconciliation.
- Contract tests: provider request/response mapping and signature verification against versioned fixtures.
- Route/auth tests: tenant/landlord/PM/support separation and fail-closed ownership.
- Webhook tests: duplicate, reordered, delayed, missing, forged, unknown, amount/currency mismatch and replay.
- Scenario tests: fixed/variable mandate, verification delay, cancellation near cutoff, rent change, renewal, partial month, NSF/return, capped retry, manual adjustment and payout mismatch.
- Projection/privacy tests: no bank credentials, provider payloads, storage paths or raw IDs leak.
- Load/recovery tests: 3,000-unit schedule generation, queue backpressure, outage recovery and reconciliation rerun.
- Sandbox isolation: separate provider credentials/accounts, webhook endpoints and Firestore environment; synthetic identities only; no production replay into sandbox.
- Operational exercises: processor outage, notification outage, duplicate debit allegation, tenant cancellation, incident escalation and reconciliation close.

## Phased Delivery

1. **Enterprise audit and pilot packaging:** this documentation, demo script and readiness matrix.
2. **PAD technical design:** provider RFP/spike, funds-flow decision, data/state design, threat model, counsel-approved terms and go/no-go gates.
3. **PAD beta:** one provider and one province; tenant authorization -> rent obligation -> debit attempt -> ledger/reconciliation -> receipt/failure audit. No custody, autonomous retry or bulk rollout.
4. **Screening integration:** consent -> provider invite/status -> restricted report access -> usage credits. Certn requires a separate authorized integration mission.
5. **Migration/import:** properties, units, tenants, leases and starting balances with preview/apply/reconciliation.
6. **Enterprise pilot:** one landlord/property group for 60–90 days, capped scope, weekly review, support owner and exit/export plan.

## Beta Exit Gates

- Provider, legal, privacy, security and insurance approvals recorded.
- Mandate, notice, cancellation and return scenarios pass.
- No unresolved high-severity auth, privacy, duplicate-debit or reconciliation defects.
- End-to-end sandbox evidence and recovery drill complete.
- Pilot support/on-call, incident and reconciliation runbooks staffed.
- Pilot landlord accepts source-of-truth, responsibilities, limits and rollback/export plan.
