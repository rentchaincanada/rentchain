# RentChain Property Accounting and Rotessa PAD Architecture v1

Status: strategic audit and future-state architecture only; no payment processing, debit scheduling, bank-data collection, or money movement is implemented or authorized by this document

## Executive Summary

RentChain should build an authoritative lease receivables subledger before integrating Rotessa or any other pre-authorized debit (PAD) provider. The subledger should answer, deterministically and append-safely, what each lease owes, what has been paid or credited, how cash was allocated, what remains outstanding, and why. Rotessa should then operate behind a provider adapter as an execution and external-evidence source. It must not become the authority for rent, tenant balances, lease state, or accounting history.

The current platform has useful foundations: landlord and tenant ledger surfaces, manual payment records, signed lease-ledger entries, provider-neutral payment intents, card-oriented rent-payment records, provider-event receipts, reconciliation records, obligation derivation, credit-allocation records, exports, canonical audit events, and evidence-package patterns. These foundations are fragmented and differ in authority and maturity. Some older payment and tenant-ledger paths are in-memory, stubbed, editable, or delete-capable. Monthly rent obligations are derived signals rather than an authoritative scheduled charge book. Property rent roll, aged receivables, period close, owner statements, and accountant-ready journal exports are not yet cohesive accounting products.

The recommended architecture is:

```text
approved lease terms and accounting policy
  -> versioned charge schedule
    -> append-safe receivable transactions
      -> payment and credit allocations
        -> lease, tenant, unit, property and portfolio projections
          -> period reconciliation and accountant exports

active PAD authorization + collectible obligation
  -> reviewed Rotessa transaction instruction
    -> Rotessa financial transaction evidence
      -> reconciliation
        -> append-safe receipt, allocation, return or exception
```

RentChain should initially remain SaaS workflow and accounting infrastructure in a processor-led, no-custody model. Rotessa should process PAD transactions and settle according to a provider- and counsel-approved payee model. RentChain must not claim to hold funds, be the payment processor, or provide production PAD until provider, legal, privacy, security, finance, support, and pilot gates pass.

RC1 remains demo-ready without PAD. Property-accounting hardening is an RC2 foundation; Rotessa sandbox and live PAD belong to later RC2 or bounded pilot-payment readiness.

## Why Rotessa and PAD Matter for RentChain

Recurring rent collection is operationally connected to the lease, monthly charges, tenant balances, exceptions, notices, reconciliation, and owner reporting. PAD can reduce manual collection work and create stronger payment evidence, but only if the accounting system remains correct through partial payments, manual payments, returns, cancellations, rent changes, and provider outages.

Rotessa is a relevant Canadian diligence candidate because its public API describes:

- customer records with caller-supplied identifiers;
- one-time and recurring transaction schedules;
- financial transactions generated from schedules;
- transaction reporting with `Future`, `Pending`, `Approved`, `Declined`, and `Chargeback` states;
- decline/chargeback reasons including NSF, stopped payment, invalid account, closed account, frozen account, revoked agreement, and no-debit-allowed;
- a platform API that scopes customers and transactions beneath client accounts.

Those capabilities are not yet a selection decision. Written diligence must confirm API and platform eligibility for RentChain's actual landlord/property-manager model, tenant authorization ownership, hosted bank-detail collection options, event delivery or polling expectations, schedule cutoffs and mutability, idempotency behavior, reconciliation exports, settlement destination, return timing, client onboarding, scale, support, data handling, fees, and regulatory allocation.

The accounting architecture must remain provider-neutral so that a Rotessa decision can change without rewriting rent history.

## Current RentChain Payment and Accounting Surface Inventory

### User-facing surfaces

| Surface | Current role | Audit assessment |
| --- | --- | --- |
| `/leases/:leaseId/ledger` | Landlord-scoped lease ledger, obligation signals, charges, recorded payments, credit allocation, CSV/PDF export | Strongest current lease accounting surface, but combines multiple sources and derived obligation state. It is not yet a complete receivables subledger or period-close view. |
| `/payments` | Landlord payment list, recording/editing workflows, exports | Useful operational history, but persisted `payments` records coexist with other payment sources. Current edit/delete semantics are unsuitable as the future accounting authority. |
| `/tenants` | Tenant context and links into payment/ledger records | Useful identity/context surface; tenant balance authority must come from lease responsibility plus subledger allocations, not a standalone mutable tenant total. |
| `/leases` and lease summary | Lease terms, lifecycle and navigation into ledger | Lease terms should remain the commercial source used to preview future schedules. An approved version, not live editable display data, must source charges. |
| `/dashboard` | Portfolio signals and Decision Queue Preview | Should consume summarized accounting projections only. It must not originate accounting transactions or imply automatic collection. |
| `/operations` | Cross-workflow review and exception bridge | Appropriate future home for accounting/PAD exception queues, with safe CTAs into authoritative detail surfaces. It must not become a second financial source of truth. |
| `/tenant/payments` | Tenant-safe charges, payment history, payment summary and current card-readiness messaging | Good projection boundary. Future PAD status must be additive, explicit, and clearly distinguish scheduled, pending, collected, failed, and returned. |
| `/tenant/ledger` | Tenant-safe tenancy activity timeline | Broader evidence timeline, not a substitute for a statement of account. It currently depends on event projections and should remain whitelist-based. |
| Admin/support and evidence surfaces | Reconciliation, event, audit and evidence patterns exist across restricted routes | Suitable foundation for purpose-limited exception review. No raw bank details, unrestricted payloads, storage paths, or provider IDs should become user-facing labels. |

### Current backend records and authority

| Record/path | What exists | Authority decision |
| --- | --- | --- |
| `ledgerEntries` | Signed charge, payment and adjustment entries used for lease running balance | Keep as current aggregate lease-balance authority while Phase 0 introduces an explicit versioned receivables transaction contract. Migrate by projection/reconciliation, not destructive rewrite. |
| `paymentIntents` | Provider-neutral obligation/execution context and review state | Keep additive. Do not use the name or record as the monthly schedule authority; provider PaymentIntent concepts and accounting obligations must remain distinct. |
| `rentPayments` | Card checkout attempts/history linked to leases and payment intents | Keep as payment-channel attempt/compatibility evidence, not canonical paid balance. |
| `payments` | Persisted landlord-recorded payments; current routes permit edits and deletion | Treat as legacy/manual input. Future corrections must append adjustment/reversal records; accounting history must not be physically deleted. |
| `paymentProviderEventReceipts` | Deduplicated provider event evidence | Reuse the receipt-before-projection pattern for Rotessa. Confirm whether Rotessa offers push events; otherwise persist authenticated pull/import batch evidence with cursor and report identity. |
| `paymentReconciliationRecords` | Provider/payment comparison outcome, reasons, manual-review and automation eligibility | Extend through versioned reconciliation facts. A reconciliation record does not itself create rent or prove settlement without its referenced evidence. |
| `leaseCreditAllocationRecords` | Append-safe allocation of aggregate credit to obligations, including reversal planning | Reuse allocation as an independent fact. Generalize carefully to payment/credit allocations rather than mutating obligations or historical ledger entries. |
| `paymentObligationLedger` | Pure derived rows from leases, payment intents, payments, reconciliation and allocations | Valuable read model and transition bridge. It currently derives expected obligations and must not be mistaken for a persisted charge schedule. |
| tenant ledger service/event paths | Event and payment fallbacks, including in-memory sample behavior | Do not extend as accounting authority. Converge tenant views onto whitelist projections from the canonical receivables subledger. |
| canonical events/evidence packages | Append-safe operational audit and safe evidence patterns | Reuse for material accounting and PAD state transitions, while keeping journal truth in dedicated financial records. Audit events are evidence, not the accounting book. |

### Capability assessment

| Capability | Current readiness | Gap before PAD |
| --- | --- | --- |
| Charge records | Partial | Lease-ledger charges exist, but there is no unified versioned charge taxonomy and schedule-to-charge lifecycle. |
| Payment records | Partial/multiple | Manual, card, canonical and reconciliation records coexist; canonical payment identity and correction rules need consolidation. |
| Ledger entries and balance | Partial/usable | Signed entries calculate lease balance, but allocation, reversal, close and property rollup contracts need hardening. |
| Lease billing schedule | Derived only | No authoritative preview/apply schedule with lease-version fingerprint and idempotent monthly charge generation. |
| Tenant payment methods | Not PAD-ready | No approved production PAD authorization or provider-token mapping; raw bank data must not be collected by RentChain. |
| External processor references | Partial | Provider references and event receipts exist for Stripe-oriented paths; Rotessa needs an adapter-owned mapping model. |
| Immutable audit history | Strong foundation | Material transitions can use canonical events, but current editable/deletable payment paths must be retired from canonical writes. |
| Accounting exports | Partial | Lease/payment exports exist; no complete property rent roll, aged receivables, monthly close package, owner statement, or balanced accountant journal export. |

## Target Accounting Model

### Product boundary

The first target is an operational accounts-receivable subledger for residential leases. It is not yet a full double-entry general ledger, bank account, trust-account system, accounts-payable system, tax engine, payroll system, or replacement for an accountant's general ledger.

The subledger should support:

- scheduled monthly rent;
- deposits with jurisdiction- and account-type classification, without implying custody;
- one-time charges;
- concessions and credits;
- authorized adjustments;
- jurisdictionally enabled late fees only after policy and counsel approval;
- partial payments and multi-obligation allocations;
- unapplied cash/overpayments as liabilities within the subledger view, without implying RentChain holds the cash;
- reversals and returned-payment reopening;
- write-offs through an explicit approval event that changes collectible balance without deleting the debt history;
- starting balances imported with provenance and reconciliation.

### Proposed accounting entities

Names are conceptual and require a build mission to reconcile existing collections and indexes.

| Entity | Purpose | Core rules |
| --- | --- | --- |
| `leaseBillingPolicies` | Versioned due-day, frequency, proration, grace, charge and jurisdiction policy | Effective-dated; linked to approved lease version; no client-authored money rules. |
| `leaseChargeSchedules` | Previewed/applied schedule definition | Deterministic fingerprint; effective period; expected occurrences; superseded rather than edited after apply. |
| `receivableTransactions` | Canonical append-safe charges, credits, adjustments, reversals and write-offs | Integer cents; canonical internal IDs; effective/accounting dates; source/version; reversal lineage; actor and reason. |
| `paymentRecords` | Canonical representation of external/manual payment facts | Channel-neutral identity; status is evidence-derived; no destructive edits; correction/reversal lineage. |
| `receivableAllocations` | Allocation of payments, credits, deposits where permitted, and reversals to charges | Many-to-many; amount conservation; idempotent; append/reverse; supports partial and overpayment cases. |
| `accountingPeriods` | Property/company month state | `open`, `review`, `closed`, `reopened`; close snapshot/version; authorized reopen reason. |
| `accountingReconciliations` | Comparison of subledger, provider report, settlement evidence, and external bank/bookkeeper evidence | Versioned results; exceptions and owner; no forced success. |
| `accountingExportBatches` | Reproducible export manifest | Period, filter, schema version, row counts, totals, digest, generated-by and safe public reference. |

### Transaction taxonomy

Every transaction should have a stable type and normal balance effect. Suggested v1 types:

- `rent_charge`
- `deposit_charge`
- `one_time_charge`
- `late_fee_charge` (feature/policy gated)
- `charge_reversal`
- `tenant_credit`
- `credit_reversal`
- `payment_received`
- `payment_returned`
- `payment_refund`
- `payment_correction`
- `write_off`
- `write_off_reversal`
- `opening_balance`

Transaction rows never change historical meaning. A correction creates a linked superseding or reversing transaction. Display balance is a deterministic projection of effective transactions and allocations.

### Balance and responsibility model

Balance must be calculated at the lease/payment-responsibility level first, then projected to tenant, unit, property, landlord/company, and portfolio views.

```text
gross receivable
  = charges - charge reversals

net collectible receivable
  = gross receivable - credits - write-offs + reversed credits/write-offs

open balance
  = net collectible receivable - allocated settled payments + returned/refunded allocations
```

Multi-tenant leases require explicit payment responsibility. The system must not assume each named tenant owes the full lease rent, nor divide it equally without an approved responsibility record. A tenant balance is a projection of assigned responsibility and allocations; a lease balance remains the contract-level total.

Deposit accounting must distinguish “amount contractually due,” “externally received,” and “custody/holding location.” RentChain must not present a deposit as held by RentChain.

### Property accounting projections

Landlord/company projections should include:

- current rent due, collected, pending, failed/returned, credited and outstanding;
- rent roll by property, unit, lease and responsibility;
- aged receivables buckets based on charge due date and remaining allocation;
- payment and return history;
- unapplied credit requiring review;
- monthly charge, collection, adjustment, write-off and ending-receivable roll-forward;
- reconciliation exceptions and period-close status;
- owner statement sourced from closed/reviewed subledger facts, clearly excluding unsupported cash, expense, payable, trust, tax, or bank balances;
- accountant/bookkeeper exports with stable account mapping fields and balanced control totals.

## Target Rotessa Integration Model

### Boundary

Rotessa is an external execution provider. The adapter may create/read customers, schedules, and financial transactions under an approved client/payee context. It may not determine lease ownership, amount owed, allocation, accounting period, or user authorization.

```text
RentChain canonical IDs and accounting facts
  -> Rotessa adapter mapping
    -> restricted Rotessa API
      -> normalized provider evidence
        -> reconciliation and accounting projection
```

### Proposed provider records

| Entity | Purpose | Restricted fields |
| --- | --- | --- |
| `paymentProviderAccounts` | Maps landlord/company/payee context to an approved Rotessa client context | Rotessa client reference, onboarding/status, settlement configuration reference; never user-facing raw ID. |
| `paymentProviderCustomers` | Maps RentChain responsibility/tenant context to a Rotessa customer | Rotessa customer ID/UUID, custom identifier, status, last verification; no raw bank numbers. |
| `padAuthorizations` | RentChain evidence that the tenant authorized the approved agreement/schedule | Agreement version/digest, parties, authorization class, amount/schedule basis, timestamps, cancellation state, evidence reference. |
| `padPaymentInstructions` | Reviewed instruction for one obligation/attempt | Canonical obligation, authorization, amount/date, idempotency key, approval and notice gates. |
| `providerScheduleMappings` | Optional mapping when Rotessa recurring schedules are used | Rotessa schedule reference, expected parameters, state and last compared version. |
| `providerFinancialTransactionReceipts` | Immutable normalized evidence from Rotessa reports/API | Provider transaction reference, observed status/reason, observed-at, report/cursor identity, restricted raw-evidence reference. |

Provider IDs are attributes and restricted correlation keys. Public and landlord views should show safe references such as payment receipt numbers, tenant/property labels, dates, amounts, and normalized statuses.

### Scheduling decision

Rotessa supports recurring schedules, but RentChain should not automatically delegate the authoritative rent schedule to Rotessa. Two patterns require sandbox comparison:

1. **One-time instruction per approved monthly obligation (preferred initial control posture).** RentChain creates one provider schedule/transaction instruction per obligation after amount, date, authorization, notice, duplicate-payment and cutoff checks. This provides clearer idempotency and rent-change control.
2. **Provider recurring schedule.** RentChain maps a versioned recurring schedule and reconciles every generated financial transaction. This reduces monthly API creation but creates harder change, cancellation, proration, lease-renewal, and drift controls.

The initial sandbox should prefer one-time instructions unless Rotessa confirms a safer atomic recurring-schedule lifecycle with suitable idempotency and reporting. The decision must be written before implementation.

### Status normalization

| Rotessa-facing evidence | RentChain attempt state | Accounting effect |
| --- | --- | --- |
| Future | `scheduled` | None; still outstanding. |
| Pending | `pending_provider_confirmation` | None; do not mark paid. |
| Approved | `provider_approved` then `reconciled` | Record/allocate payment only after amount, currency, subject, authorization and provider-account reconciliation. |
| Declined | `failed` | No payment allocation; preserve obligation and create an exception/next action. |
| Chargeback | `returned` | Append return/reversal, reverse prior allocation, reopen balance, and preserve original success evidence. |
| Unknown/missing/mismatch | `manual_review_required` | No success projection or automated retry. |

Polling or report import must be designed as a durable, cursor-based ingestion process if Rotessa does not provide adequate signed webhooks. Each observation needs provider account context, query/report identity, fetched-at time, normalized payload digest, deduplication key, and replay-safe projection. API transport success is not transaction success.

## PAD Authorization Workflow

1. An authorized landlord enables PAD eligibility for an approved property/lease. This does not create a debit.
2. RentChain creates an authorization invitation tied to the lease, payment responsibility, payee/client context, agreement version, approved amount/schedule basis, language, and expiry.
3. The authenticated tenant sees the payee, purpose, amount/frequency basis, change/pre-notification terms, cancellation path, recourse/support wording, privacy disclosure, and processor role.
4. The tenant affirmatively accepts. No prechecked control or lease-access coercion is permitted.
5. Bank information is collected through a provider-controlled or separately approved tokenized flow. RentChain must not receive or persist raw institution, transit, account, login, or verification data.
6. RentChain records authorization only after server-side provider confirmation plus complete agreement evidence. Authorization never defaults to active.
7. The tenant receives or can retrieve the approved confirmation/agreement record through a tenant-safe projection.
8. Amount/date/lease changes run an approved classification: covered change with required notice, renewed consent, or no collection until review.
9. Cancellation/revocation records request time, effective time, provider action, already-submitted transaction impact, and the continuing underlying rent obligation.
10. Every invitation, view where legally required, acceptance, confirmation, notice, change, cancellation, failure, support decision, and evidence export creates append-safe audit evidence.

Suggested authorization states:

`draft -> invited -> viewed -> accepted -> provider_setup_pending -> active -> suspended | cancellation_pending -> cancelled | revoked | expired | failed_review`

No debit instruction is eligible unless authorization is active, the agreement version is current, provider/payee context matches, notice gates pass, and no cancellation or ambiguity exists.

## Ledger and Reconciliation Model

### Source-of-truth hierarchy

```text
approved lease/accounting policy = why and when a charge exists
receivable transaction = booked amount due or adjustment
payment record = money-event evidence
allocation = which receivable the payment/credit satisfies
provider receipt = external execution evidence
reconciliation = comparison and exception result
projection/export = readable financial view
audit event = who did what and why
```

No downstream provider status may edit lease terms or charge history. No notification may change payment truth. No dashboard card may create, retry, write off, or reverse a financial record.

### Monthly close

For each property and accounting period:

1. Confirm expected schedule occurrences were generated once.
2. Reconcile charges to lease versions and approved adjustments.
3. Reconcile manual/card/PAD payment records to allocations.
4. Reconcile Rotessa approved/declined/chargeback evidence and provider totals.
5. Review unapplied cash, credits, partial payments, returns, duplicates and mismatches.
6. Compare expected settlement/payee totals to available provider settlement reports; never claim bank settlement without evidence.
7. Generate control totals and exception list.
8. Close the period with schema version and digest. Later corrections require a controlled reopen or post-close adjusting transaction.

### Accounting exports

Initial exports should be accountant-oriented, not branded as a complete owner financial statement. Recommended files:

- rent roll as of date;
- charge and adjustment detail;
- payment, return and allocation detail;
- aged receivables;
- monthly receivable roll-forward;
- reconciliation exceptions;
- journal-ready CSV with configurable external account/property/unit mapping;
- export manifest with totals, row counts, schema version and digest.

Exports must use labels and stable public references. Internal Firestore IDs, Rotessa IDs, raw bank data, storage paths, support notes, and unrestricted provider payloads must be excluded.

## Tenant, Landlord, and Admin UX

### Landlord/property manager

Landlords should see:

- rent due by lease/property;
- scheduled PAD with date and authorization readiness;
- payment pending, explicitly not collected;
- payment collected after reconciliation;
- payment failed or returned with privacy-safe reason and reviewed next step;
- NSF/retry review, never an automatic retry promise;
- tenant and lease balance with allocation explanation;
- rent roll, aged receivables and monthly reconciliation;
- close/export status and exceptions.

Mutating controls should be narrow and permissioned: preview/apply charge schedule, record external payment, allocate credit/payment, reverse with reason, approve a reviewed PAD instruction, request retry where legally/provider permitted, and close/reopen a period. Every mutation needs expected version/fingerprint, server-resolved authority, actor, reason, and audit event.

### Tenant

Tenants should see only their authorized responsibility context:

- current charges, credits, allocated payments and remaining balance;
- PAD invitation/agreement and authorization status;
- next scheduled debit amount/date;
- pending, collected, failed and returned states with plain-language distinctions;
- agreement confirmation, cancellation path, receipts and support guidance;
- external/manual payments labeled honestly.

Tenant views must not expose landlord settlement data, provider/client IDs, bank account data beyond separately approved masking, other occupants' private responsibilities, internal review notes, or support-only reason detail.

### Admin/support

Purpose-limited support views may show:

- safe provider correlation references;
- authorization, instruction, receipt and reconciliation lineage;
- normalized failure/return reason;
- polling/import cursor or event evidence status;
- exception age, owner and reviewed actions;
- audit and export manifests.

Support must not activate authorization, fabricate approval/settlement, directly edit balances, expose raw bank data, or bypass a tenant cancellation. Controlled replay/reconciliation tools are later work and require dry-run, idempotency, expected state, actor, reason, and audit.

## Compliance and Counsel Questions

This document is not legal advice. Before implementation, obtain written answers for the exact Rotessa and landlord/payee model.

### Payments Canada Rule H1 and PAD terms

- Who is the Payee, Payor, sponsoring member, and payment service provider?
- Which PAD class applies to residential rent and to any business tenancy use case?
- What agreement content, electronic signature/authorization, confirmation delivery, and retention evidence are required?
- How are fixed, variable, sporadic, one-time, rent-increase, proration and changed-due-date cases classified?
- What pre-notification/change notice is required, and which waivers are lawful and advisable?
- What cancellation/revocation instructions, effective timing, confirmation, and already-submitted debit rules apply?
- What tenant recourse/reimbursement and dispute wording is required?
- May a failed debit be re-presented, under what timing/amount constraints, and what notice is required? Payments Canada's public guidance states that an insufficient-funds debit may be tried once more within 30 days for the same amount; product policy must still be approved by provider and counsel.
- What retention and legal-hold periods apply to agreements, notices, payment evidence, cancellation, and disputes?

### Tenancy, consumer and privacy

- Can PAD be offered, required, or made default in each pilot province?
- What alternative payment method, receipt, fee, NSF, rent-increase, arrears, deposit and collection restrictions apply?
- Which party responds to unauthorized-debit claims and tenancy disputes?
- What consent, privacy notice, processor disclosure, data residency/transfer, access, retention/deletion, and incident terms are required?
- Are English/French agreement, notice, receipt, cancellation, and accessibility obligations triggered?

### RPAA and FINTRAC

- Does RentChain perform initiation, authorization, transmission/reception/facilitation of an EFT instruction, or another payment function as a non-incidental service?
- Is RentChain acting as a registered PSP's agent/mandatory, a third-party service provider, or independently for the final flow, and what contracts/evidence support that classification?
- Does the no-custody processor-led design change, but not eliminate, RPAA registration analysis?
- Is Rotessa registered or otherwise eligible for the relevant functions and model, and which RPAA duties remain with each party?
- Does any activity make RentChain a money services business or create FINTRAC registration, compliance-program, reporting, identity-verification, recordkeeping, or sanctions obligations?
- Do platform fees, multi-landlord settlement, reserves, refunds, or future payout control change either analysis?

The Bank of Canada's current registration guidance identifies initiation and authorization/transmission/facilitation of EFT instructions among payment functions and distinguishes agents/mandataries from third-party service providers. Counsel must analyze the actual product and contracts; “we do not hold funds” is not a complete scope conclusion.

## Technical Architecture Risks

| Risk | Why it matters | Required control |
| --- | --- | --- |
| Fragmented financial sources | `payments`, `rentPayments`, `paymentIntents`, ledger entries and reconciliations can disagree | Canonical transaction/allocation contracts, migration reconciliation and documented precedence. |
| Mutable/deletable history | Current manual-payment edit/delete paths can destroy accounting meaning | Append-only correction/reversal for canonical records; retire destructive canonical writes. |
| Derived obligations treated as charges | Current obligation rows can be inferred from lease state | Versioned preview/apply schedule and persisted receivable transaction. |
| Double collection | Manual/card payment may arrive before PAD submission | Allocation-aware eligibility check in the same critical section as instruction creation. |
| Delayed return | Approved can later become chargeback/returned | Append reversal, reopen allocation and preserve original evidence. |
| Rotessa schedule drift | Provider recurring schedule may diverge from lease/rent changes | Version comparison, explicit change/cancel workflow, daily reconciliation and stop switch. |
| Polling gaps or weak events | Status could be delayed or missed | Durable cursors/import receipts, backfill windows, deduplication and aging alerts. |
| Idempotency uncertainty | Retries/timeouts could duplicate debits | Provider-confirmed idempotency strategy plus local unique instruction key and duplicate reconciliation. |
| Raw banking exposure | Public API examples accept bank fields | Provider-hosted/tokenized collection; prohibit raw bank fields in RentChain requests, logs and records. |
| Cross-landlord leakage | Platform/client/customer IDs may be mis-scoped | Server-resolved provider-account authority and negative projection tests. |
| Amount/date changes near cutoff | Incorrect debit or notice breach | Freeze window, notice gate, provider cutoff model and manual review. |
| Accounting-period races | Late events can alter closed reports | Close snapshots, post-close adjustments and controlled reopen. |
| Overclaiming settlement | Provider approval may not equal landlord bank settlement | Separate provider transaction, settlement and reconciliation states. |
| Scale | Month-start generation and reconciliation can spike | Bounded queues, sharding, backpressure, resumable cursors and 3,000-unit load/recovery tests. |

## Implementation Phases

### Phase 0: Accounting ledger hardening without payments

- Define canonical receivable transaction, schedule, payment, allocation, reversal and period schemas.
- Add pure deterministic charge-schedule preview from approved lease versions.
- Add idempotent/stale-safe apply for scheduled charges; no payment initiation.
- Define responsibility for multi-tenant leases.
- Converge lease balance and obligation projections on explicit transactions/allocations.
- Replace future destructive correction semantics with append/reverse semantics.
- Add rent roll, aged-receivable and monthly roll-forward pure projections.
- Add reconciliation/migration reports across existing financial collections.

Exit: one lease/property period balances deterministically from charges through allocations and reversals, with no provider dependency.

### Phase 1: PAD authorization workflow, no live debit

- Provider-neutral authorization invitation, agreement version/evidence, status and cancellation model.
- Tenant/landlord/admin whitelist projections.
- Counsel-approved content represented as versioned templates, but no bank collection or debit.
- Notice/change/cancellation evidence and audit events.

Exit: complete authorization lifecycle can be tested with synthetic/provider-neutral references and cannot trigger money movement.

### Phase 2: Rotessa sandbox integration

- Complete provider, counsel, privacy, security and commercial diligence.
- Implement restricted Rotessa adapter, client/customer mappings and synthetic-only sandbox isolation.
- Validate hosted/tokenized bank-collection approach; do not route raw bank data through RentChain.
- Prove create/read/update/cancel semantics, transaction report ingestion, decline/chargeback normalization, idempotency assumptions, cutoffs and rate limits.

Exit: sandbox evidence package passes; no production credentials or live tenants.

### Phase 3: Scheduled PAD transaction creation

- Generate reviewed, one-time PAD instructions from eligible obligations and active authorizations.
- Enforce notice, amount/date, cutoff, duplicate-payment, allocation and cancellation gates.
- Use authenticated bounded workers and a global/property/lease stop switch.
- No autonomous retry.

Exit: deterministic sandbox instruction creation cannot duplicate or exceed the approved obligation.

### Phase 4: Status and reconciliation

- Durable provider transaction observation via signed events if supported, otherwise cursor-based polling/report import.
- Normalize future/pending/approved/declined/chargeback and reason taxonomy.
- Append provider receipts before projection.
- Reconcile amount, subject, authorization, account context, allocation, settlement evidence and duplicates.
- Handle NSF/return through reviewed workflow and append-safe reversal.

Exit: success, failure, late return, duplicate, mismatch, outage and replay scenarios reconcile correctly.

### Phase 5: Landlord accounting exports and owner statements

- Property rent roll, aging, receivable roll-forward and exception reports.
- Closed-period manifests and accountant mappings.
- Owner statement limited to supported receivables/collection facts and explicit exclusions.
- Export reconciliation to provider reports and pilot bookkeeper workflow.

Exit: a bookkeeper can reproduce totals and trace every row to safe evidence.

### Phase 6: Production compliance review and limited pilot

- Written provider/funds-flow, Rule H1, provincial, RPAA, FINTRAC, privacy, security, insurance and contract approvals.
- One landlord, limited property group, province, volume and debit limits.
- Staffed daily reconciliation/support and incident runbooks.
- Tenant comprehension, cancellation, dispute, outage and rollback exercises.
- Go/no-go review with named owners and evidence.

Exit: only an explicitly approved pilot may use production money movement.

## Recommended First Implementation PR After Audit

Create one backend-only Phase 0 foundation PR: **canonical receivable transaction and charge-schedule preview model**.

Suggested scope:

- introduce pure TypeScript types and validation for versioned `receivableTransactions` and `leaseChargeSchedules`;
- implement deterministic monthly rent schedule preview from a normalized approved lease snapshot;
- compute a preview fingerprint from lease version, responsibility, period, amount, currency, due policy and proration inputs;
- implement pure balance/rent-roll/aging projection helpers from transaction fixtures;
- cover monthly rent, partial first period, one-time charge, credit, adjustment, reversal, partial payment, overpayment, return and write-off cases in tests;
- document mapping from existing `ledgerEntries` and obligation rows;
- do not add a public route, UI, Firestore write, scheduler, provider adapter, PAD authorization, bank field, or payment mutation.

Likely future files (final names should follow current package conventions after implementation audit):

- `rentchain-api/src/lib/accounting/receivableTransactions.ts`
- `rentchain-api/src/lib/accounting/leaseChargeSchedule.ts`
- `rentchain-api/src/lib/accounting/receivableProjections.ts`
- corresponding focused tests under `rentchain-api/src/lib/accounting/__tests__/`

This PR creates the accounting contract that Rotessa must consume later without coupling accounting truth to provider behavior.

## Explicit Non-Goals

- No live payment processing or production money movement.
- No PAD debit or recurring schedule creation.
- No Rotessa credentials, API client, webhook, polling job, or sandbox call in this audit PR.
- No tenant bank-account, institution, transit, login, or verification-data collection.
- No claim that RentChain holds, safeguards, settles, or pays out funds.
- No claim that Rotessa is selected, contracted, approved, or integrated.
- No autonomous retry, NSF fee, late fee, reminder, collection, enforcement, legal notice, or eviction workflow.
- No destructive migration or rewrite of current financial records.
- No general-ledger, accounts-payable, trust-accounting, payroll, tax, or bank-reconciliation replacement in Phase 0.
- No RC1 route, copy, demo, pricing, billing, authentication, entitlement, screening, infrastructure, or deployment change.

## RC1 vs RC2 Boundary

RC1 remains signed off for a guided landlord demo without live PAD. Existing ledger and payment surfaces must be presented according to their validated RC1 behavior, and no demo should imply automated PAD, live bank collection, settlement, or production accounting close.

RC2 should begin with accounting source-of-truth hardening. PAD authorization is a later RC2 readiness layer with no debit. Rotessa sandbox work follows only after provider and counsel questions are sufficiently answered. Scheduled transactions, reconciliation, exports, and a production pilot are separate gated phases.

No accounting or PAD implementation should be merged into the RC1 demo scope.

## Current Primary References

- [Rotessa API Reference](https://rotessa.com/docs/)
- [Rotessa Platform API Reference](https://rotessa.com/platform-documentation/)
- [Rotessa authorization overview](https://support.rotessa.com/overview-of-authorizations)
- [Payments Canada Rule H1](https://www.payments.ca/sites/default/files/h1eng.pdf)
- [Payments Canada PAD consumer guide](https://www.payments.ca/payment-resources/support-guides/consumer-guides/pre-authorized-debit)
- [Bank of Canada criteria for registering payment service providers](https://www.bankofcanada.ca/regulatory-oversight/retail-payments/supervisory-policies/criteria-registering-payment-service-providers)
- [Bank of Canada retail-payments supervisory framework](https://www.bankofcanada.ca/regulatory-oversight/retail-payments/supervisory-framework/)

These references are architecture inputs only. Provider documentation can change and does not establish legal eligibility, regulatory status, contractual allocation, or production approval.
