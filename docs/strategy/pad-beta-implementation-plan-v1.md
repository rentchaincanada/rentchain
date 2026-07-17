# PAD Beta Implementation Plan v1

Status: future mission plan only; no PAD, Stripe/ACSS, route, UI, schema or migration implementation is authorized

## Objective

Deliver a processor-led, lease-linked and tenant-authorized Canadian PAD beta for one landlord and a limited property group, with no RentChain funds custody. The narrow proof is:

```text
tenant authorization
  -> versioned rent obligation
    -> one idempotent debit attempt
      -> verified provider status
        -> reconciliation
          -> tenant/landlord record and append-safe evidence
```

The plan supports the 3,000-unit enterprise conversation and `$30/unit/year` / `$90,000/year` reference, but the beta must start with a bounded cohort. It should run beside the landlord's existing PMS/accounting system under the merged migration/parallel-run strategy.

## Delivery Rules

- Each phase is a separate operator-approved, reviewable mission with acceptance gates.
- Provider, legal and security decisions precede live debit code.
- Existing card rent payments and billing/screening flows remain behaviorally isolated.
- Certn is outside scope.
- No autonomous retry, collection enforcement or hidden remediation.
- Every phase preserves an export/exit path and explicit source-of-truth ownership.

## Phase 0 — Discovery And Provider Confirmation

### Work

- Confirm current card checkout, payment provider adapter, receipt, reconciliation, ledger, audit, tenant projection and notification boundaries.
- Quarantine/deprecation-plan the unmounted PAP prototype; do not migrate its bank fields.
- Compare Stripe ACSS debit with at least one Canadian PAD alternative using the decision matrix in the technical design.
- Decide payee/merchant/connected-account model, landlord onboarding, statement descriptor, settlement destination, liability, fees and mandate scope.
- Confirm SetupIntent/mandate and off-session PaymentIntent feasibility in sandbox if Stripe is selected.
- Complete counsel, RPAA, FINTRAC/MSB, privacy, security and insurance discovery.
- Define pilot province, property group, volume, incumbent PMS authority and success baseline.

### Deliverables / exit gate

Provider decision record, signed-off funds-flow diagram, responsibility matrix, data inventory, legal/security question log, sandbox test plan, cost model and explicit go/no-go. No production code.

## Phase 1 — Data Model, State Machines And Audit Contracts

### Work

- Finalize collection/entity names after reconciling existing `paymentIntents`, `rentPayments`, provider receipts and reconciliation records.
- Implement pure mandate, obligation and attempt state machines first.
- Define deterministic IDs/idempotency, optimistic concurrency and append-safe adjustment/allocation contracts.
- Define canonical PAD audit events and tenant/landlord/support projection schemas.
- Define Firestore query/index plan and retention classifications; do not deploy indexes/rules without explicit scope.
- Add pure unit tests, property/transition tests and projection-negative tests.

### Exit gate

No provider call or UI. All allowed/forbidden transitions, stale versions, multi-tenant responsibility, money/date normalization and sensitive-field exclusions pass review.

## Phase 2 — Tenant Authorization Prototype

### Work

- Create authenticated, lease-owned authorization invitation/session endpoints.
- Use provider-hosted/tokenized bank collection and SetupIntent/mandate lifecycle where selected.
- Store only opaque provider references and approved masked display metadata.
- Persist agreement version/digest, acceptance and verification evidence.
- Add tenant mandate status/cancellation-request prototype and landlord readiness/status projection.
- Consume sandbox setup/verification webhooks into deduplicated receipts.

### Safety boundary

No PaymentIntent/debit initiation. Sandbox only. Legacy PAP routes remain unmounted/quarantined. Provider client uses least-privilege test credentials and verified webhooks.

### Exit gate

Instant and micro-deposit verification, abandoned flow, duplicate/out-of-order webhook, cancellation and cross-tenant/landlord tests pass. Counsel approves the prototype language before any external pilot exposure.

## Phase 3 — Rent Schedule And Obligation Linking

### Work

- Build a pure monthly obligation preview from authoritative lease versions.
- Support due date/time zone, partial first/last period, move-in/out, rent change, renewal, credits/adjustments, starting balance and multi-tenant responsibility policies.
- Add preview fingerprint, authorized idempotent apply and supersession history.
- Add manual/card payment allocation checks and exception queue.
- Benchmark preview/apply at 3,000-unit, multi-month volume in an isolated environment.

### Exit gate

Control totals and repeat runs are deterministic; stale previews fail; ambiguous lease terms require review; no obligation automatically initiates payment.

## Phase 4 — Payment Attempt Lifecycle

### Work

- Add PAD initiation capability to the provider boundary without changing card checkout behavior.
- Create one PaymentIntent/equivalent per approved attempt with deterministic provider idempotency.
- Persist attempt before provider call; handle timeout through lookup/reconciliation.
- Add signed webhook normalization for processing, success, failure and return.
- Extend receipt/reconciliation models for mandate, obligation, payee and delayed-return evidence.
- Implement reviewed/capped retry decision records, not autonomous retry.
- Issue receipt only after reconciled success and reverse/supersede on later return.

### Exit gate

Sandbox matrix passes success, NSF, closed account, delayed failure, later return, duplicate/out-of-order/missing webhook, timeout, cancellation race, amount/currency mismatch and manual-payment race. No live mode.

## Phase 5 — Landlord And Tenant Visibility

### Work

- Tenant: agreement/mandate status, upcoming debit, attempt timeline, receipt/return, cancellation and support.
- Landlord/PM: mandate readiness, obligation/debit status, failure/return and reconciliation exception queue, reviewed retry/pause and export.
- Admin/support: purpose-limited safe references, receipt/reconciliation history and audited review decisions.
- Notifications: upcoming debit, mandate confirmation/cancellation, success, failure/return and retry with versioned content/delivery evidence.
- Accessibility, mobile, privacy, error-language and projection isolation QA.

### Exit gate

No raw bank details, provider payloads, internal IDs as labels or cross-scope data leak. User research shows pending/success/return/cancellation are understood. Support runbook is executable.

## Phase 6 — Paid Pilot Rollout

### Shape

- One landlord, one limited property group and named users/tenants.
- 60–90 days, paid, with weekly operating reviews.
- Sandbox rehearsal followed by live limited rollout only after every compliance/risk gate passes.
- Daily reconciliation/exception ownership, provider escalation and a tested stop switch.
- Parallel run beside the incumbent PMS/accounting system with field ownership, control totals and agreed exports.
- No entire 3,000-unit portfolio cutover.

### Rollout cohorts

1. Internal synthetic/sandbox tenants.
2. Staff/friendly test cohort where legally and contractually permitted.
3. Small live property cohort with conservative debit/volume limits.
4. Expand within pilot only after a full rent cycle reconciles and the go/no-go group approves.

### Exit/rollback

Stop new initiations, preserve mandate/payment evidence, reconcile in-flight attempts, notify affected parties under approved templates, export records and return payment collection to the agreed incumbent/manual process. Ending the pilot must not strand tenant access to records or erase history.

## Phase 7 — Enterprise Scale

Only after pilot evidence:

- bulk schedule generation and exception operations;
- portfolio cohort administration and permission templates;
- migration imports with preview/apply/reconciliation;
- accounting and settlement exports/adapters;
- payout/reconciliation reporting and period close;
- support/replay tooling with strict controls;
- performance, queue backpressure, disaster recovery and multi-region/provider continuity decisions;
- contract/pricing refinement and annual rollout.

Do not interpret Phase 7 as authorization for a full Yardi replacement, native general ledger or direct funds custody.

## Pilot Success Metrics

Agree targets against a measured baseline before launch.

| Metric | Definition / guardrail |
| --- | --- |
| Authorization completion | Eligible invited tenants reaching verified active mandate; segment abandonment and verification delays. |
| Debit success | Attempts reconciled succeeded after the provider's delayed-notification window; never count initiation as success. |
| Return/NSF rate | Attempts failed/returned by normalized category and time-to-resolution. |
| Failure handling time | From verified failure/return receipt to owned next action and tenant/landlord notice. |
| Reconciliation effort | Operator minutes and unresolved exceptions per payment cycle versus baseline. |
| Duplicate/unauthorized debit | Target zero; any case is a severity-one stop-review event. |
| Notice delivery | Required notices with confirmed delivery evidence before applicable gate. |
| Evidence completeness | Mandate, obligation, attempt, provider receipt, reconciliation, notice and audit chain complete. |
| Support burden | Tickets per 100 tenants, severity, repeat contacts and resolution time. |
| Tenant experience | Confusion, complaints, cancellation success and accessibility issues. |
| Landlord value | Collection visibility, exception aging, export usefulness and willingness to annualize. |
| Commercial outcome | Willingness to move to per-unit annual pricing around the approved enterprise package; no public pricing change implied. |

## Dependencies And Risks

| Dependency/risk | Plan response |
| --- | --- |
| Provider account/funds-flow ambiguity | Phase 0 blocks implementation until ownership/liability/settlement are explicit. |
| Legal/regulatory uncertainty | Written counsel gates; no engineering inference presented as legal conclusion. |
| Legacy PAP prototype | Quarantine; no reuse of unauthenticated routes or bank fields. |
| Existing payment model overlap | Reconcile obligation vs execution naming before schema work; preserve card behavior. |
| Delayed failure/returns | Asynchronous state machine, reconciliation and receipt reversal. |
| Duplicate collection across rails/PMS | Allocation checks, parallel-run ownership and pre-initiation revalidation. |
| Scale at 3,000 units unproven | Production-shaped schedule/queue/reconciliation load tests before pilot expansion. |
| Support capacity | Bounded cohort, named owners, daily exceptions and stop switch. |
| Provider lock-in | Provider-neutral internal contracts and exportable authorization/evidence references where legally portable. |
| Migration friction | CSV-first preview/apply, signed reconciliation, staged property cohorts and exit export. |

## Immediate Next Mission

Phase 0 provider and funds-flow decision record. It should produce no live payment code and should answer: who is payee, who onboards each landlord, where funds settle, who bears returns/negative balances, how mandates are scoped, what RentChain stores, and which legal/security gates apply.
