# PAD Payment Lifecycle v1

Status: future-state state-machine design only; no debit execution is implemented

## Lifecycle Principles

- State transitions occur server-side from explicit commands or verified provider evidence.
- Every command carries an expected version and every provider event has a deterministic receipt.
- Pending is not paid; initiated is not settled; a later return can reverse earlier success projections.
- Terminal mandate states prohibit new debit initiation.
- Retries are new attempts with lineage, not mutations of failed attempts.
- Unknown or contradictory evidence routes to manual review.
- Payment transitions never mutate lease truth.

## Mandate Lifecycle

```text
draft
  -> pending_authorization
    -> pending_verification
      -> active
        -> suspended -> active
        -> cancellation_pending -> cancelled
        -> revoked
        -> expired

pending_authorization | pending_verification
  -> failed_review | cancelled
```

| Transition | Required evidence/control |
| --- | --- |
| `draft -> pending_authorization` | Eligible lease/tenant/payee context and versioned agreement invitation. |
| `pending_authorization -> pending_verification` | Tenant acceptance plus provider setup reference; no client-only activation. |
| `pending_verification -> active` | Provider-confirmed verification, mandate reference and complete agreement evidence. |
| `active -> suspended` | Provider restriction or authorized hold; reason and actor required. |
| `active/suspended -> cancellation_pending` | Tenant/payee request and calculated effective cutoff under approved policy. |
| `cancellation_pending -> cancelled` | Effective cancellation recorded; queued future attempts cancelled where possible. |
| `active -> revoked/expired` | Verified provider/legal/term event. |

Activation must never default from request input. Cancellation does not erase rent owed or prior payment history.

## Rent Obligation Lifecycle

```text
scheduled -> due -> pending_payment -> paid
              |          |             -> returned -> due | overdue | manual_review_required
              |          -> partially_paid -> paid | overdue
              -> overdue

scheduled | due -> adjusted (superseded by new version)
scheduled | due -> waived | cancelled
any nonterminal -> manual_review_required
```

- `scheduled`: approved future obligation version exists.
- `due`: due date reached and balance remains.
- `pending_payment`: one or more attempts are processing; outstanding balance remains visible.
- `partially_paid`: reconciled allocations are less than amount due.
- `paid`: reconciled allocations equal the obligation balance.
- `returned`: a prior allocation was reversed by provider evidence.
- `overdue`: unpaid balance passed the approved grace/aging rule; no autonomous enforcement implied.
- `adjusted`: prior version is superseded by an append-safe adjustment/new obligation version.
- `waived`: authorized adjustment reduces balance to zero.

## Payment Attempt Lifecycle

```text
created
  -> notice_pending
    -> ready
      -> initiation_queued
        -> processing
          -> pending_settlement
            -> succeeded
              -> returned

created | notice_pending | ready | initiation_queued -> cancelled
processing | pending_settlement -> failed | manual_review_required
failed | returned -> retry_scheduled (decision only) -> new created attempt
```

`succeeded` requires provider success evidence and reconciliation. Because PAD is delayed-notification, product projections and payout views must accommodate later returns. A return creates reversal/allocation evidence and may reopen the obligation.

## Command And Event Rules

| Action | Command authority | Evidence source |
| --- | --- | --- |
| Invite authorization | Landlord/PM with explicit permission | Lease/payee policy and audit event. |
| Accept mandate | Authenticated tenant | Provider-controlled flow plus agreement evidence. |
| Generate obligations | System preview; authorized apply | Versioned lease terms and preview fingerprint. |
| Queue debit | Governed scheduler | Active mandate, eligible obligation, notice gate, no conflicting payment. |
| Mark processing/success/failure/return | System only | Signed provider event plus reconciliation. |
| Pause/cancel/retry | Authorized tenant/landlord/support role per policy | Reasoned command and audit event; provider response where applicable. |
| Record manual payment | Authorized landlord workflow | External/manual evidence and explicit allocation; never PAD success. |

## Idempotency

### Command keys

Suggested deterministic forms (hashed before external display):

```text
mandate_invitation:{leaseId}:{tenantId}:{agreementVersion}
obligation:{leaseId}:{responsibilityId}:{periodStart}:{periodEnd}:{termsDigest}
pad_attempt:{obligationId}:{mandateId}:{attemptNumber}:{amountCents}:{currency}
provider_event:{provider}:{accountContext}:{providerEventId}
notice:{noticeType}:{mandateOrAttemptId}:{contentVersion}:{effectiveDate}
receipt:{paymentAttemptId}:{reconciliationVersion}
```

The attempt key is passed as the provider idempotency key where supported and persisted before the external call. A timeout must cause lookup/reconciliation, not blind re-initiation.

### Duplicate webhooks

1. Verify signature against the raw request body.
2. Derive receipt ID from provider/account/event ID.
3. Atomically create or load the receipt.
4. If already processed, return success without repeating effects.
5. Normalize minimal facts and resolve the internal subject server-side.
6. Apply a version-guarded transition only if allowed.
7. Persist reconciliation and audit event.
8. Mark the receipt processed; failures remain replayable through a future controlled tool.

Out-of-order events are compared against state precedence and provider timestamps. They must never regress a settled/returned record to processing.

### Retry safety

- Retry policy is counsel/provider/landlord approved, capped and notice-aware.
- Only retry eligible normalized failure categories.
- Confirm mandate is active, obligation balance remains, no manual/card payment satisfied it, and lease/payee context is unchanged.
- Create a new attempt number and idempotency key.
- Never let the provider's optional automatic retry and RentChain retry run concurrently without one declared owner.
- Ambiguous timeouts, duplicate risk, disputed debits and cancellation races require manual review.

## Failure Scenarios

| Scenario | Required behavior |
| --- | --- |
| NSF / insufficient funds | Normalize as return/failure according to evidence; reopen balance, notify safely, require reviewed retry policy. |
| Bank account closed/invalid | Fail attempt, suspend mandate pending tenant action; do not retry automatically. |
| Mandate cancelled/revoked | Block new attempts; cancel queued work; reconcile any already-submitted debit under provider/counsel rules. |
| Processor outage/timeout | Persist uncertain request state, query by idempotency/reference, and hold retries until resolved. |
| Webhook delay/missing | Keep pending; scheduled reconciliation polling may fetch status within rate limits; alert after SLA. |
| Duplicate webhook | Return success from existing receipt; no duplicate ledger, receipt or notice. |
| Out-of-order webhook | Apply transition precedence; preserve receipt and flag contradictions. |
| Tenant disputes debit | Freeze automation for mandate/attempt, preserve evidence, use counsel/provider dispute process and restricted support workflow. |
| Lease ended before debit | Eligibility recheck at queue and immediately before provider call; hold/cancel and audit. |
| Rent changes after schedule | Freeze applied attempt amount; supersede future obligation versions; ambiguous/late changes require review and possibly new notice. |
| Partial month/move-out | Use approved deterministic proration; no UI-entered ad hoc debit amount. |
| Manual/card payment outside PAD | Allocate external payment, reduce balance and cancel unsubmitted attempt; submitted races require reconciliation. |
| Landlord pauses collection | Stop future queueing at authorized scope; do not represent pause as mandate cancellation or debt waiver. |
| Amount/currency/payee mismatch | No success projection; manual review and incident alert. |
| Notification failure | Payment truth is unchanged; retry delivery and expose missing-notice gate before initiation where legally required. |
| Later return after success | Append reversal, supersede receipt status, reopen obligation balance and notify; never delete original evidence. |

## Audit Taxonomy

Proposed canonical event families:

- `pad.mandate_invited`, `pad.mandate_authorized`, `pad.mandate_verified`, `pad.mandate_suspended`, `pad.mandate_cancellation_requested`, `pad.mandate_cancelled`, `pad.mandate_revoked`, `pad.mandate_expired`;
- `rent.obligation_previewed`, `rent.obligation_created`, `rent.obligation_adjusted`, `rent.obligation_waived`;
- `pad.attempt_created`, `pad.attempt_queued`, `pad.attempt_initiated`, `pad.attempt_pending`, `pad.attempt_succeeded`, `pad.attempt_failed`, `pad.attempt_returned`, `pad.attempt_cancelled`, `pad.retry_decided`;
- `pad.provider_event_received`, `pad.reconciliation_completed`, `pad.reconciliation_manual_review_required`;
- `pad.notice_sent`, `pad.notice_delivery_failed`, `pad.receipt_issued`, `pad.receipt_reversed`.

Events contain safe references and allowlisted summaries only. Actor, authority, reason, policy/version and source evidence must be attributable.

## Reconciliation Cadence

- Event-driven reconciliation on every verified provider event.
- Scheduled reconciliation for attempts pending beyond provider-specific thresholds.
- Daily exception report during beta.
- Period close/export reconciliation agreed with the pilot landlord.
- No “paid out” status without provider settlement evidence tied to the approved payee context.

## Lifecycle Test Matrix

Test every allowed and forbidden transition, concurrent commands, stale versions, duplicate/out-of-order events, delayed success/failure/return, cancellation at each cutoff, schedule change races, multi-tenant responsibility, partial/manual payments and projection isolation. State-machine tests must be pure; provider contract tests use versioned fixtures; sandbox E2E tests prove real signature and delayed-status behavior.
