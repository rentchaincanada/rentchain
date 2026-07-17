# PAD Pilot Readiness Runbook v1

## Objective and operating boundary

Prepare and operate a bounded, paid 60–90 day PAD beta for named properties and tenants, beside the customer's PMS/Yardi workflow. The PMS remains the system of record for lease/rent obligations unless the signed pilot charter says otherwise. RentChain is the workflow, evidence, and PAD-readiness layer; it is not a full Yardi replacement and does not hold funds.

This runbook becomes executable for live activity only after counsel, RPAA/FINTRAC, privacy/security, reconciliation, operational, provider, and executive approvals. Sandbox success is not launch approval. No live debit may use unapproved authorization or notice language.

## Pilot charter

| Item | Required decision |
| --- | --- |
| Executive sponsor / pilot owner | Named individual |
| Customer and PMS owner | Named individuals |
| Duration | 60–90 days, with start/end dates |
| Cohort | Named properties, leases, tenants, jurisdictions |
| Rollout | Internal test, staff/friendly cohort if lawful, Property 1, then staged properties |
| Commercial terms | Paid pilot; fees and provider costs documented |
| Reference economics | $30/unit/year; 3,000 units = $90,000/year |
| Source of truth | PMS/Yardi for obligations; provider for processing; RentChain for governed workflow/evidence; reconciliation resolves differences |
| Success and stop criteria | Signed and measurable |
| Fallback | Manual/offline collection and evidence process |
| Onboarding | Decide and disclose any paid migration/onboarding service |

Do not advertise the reference economics as public pricing or promise PAD in a cheap flat tier.

## Roles and approvals

| Role | Accountable for |
| --- | --- |
| Executive sponsor | Go/no-go, scope, risk acceptance, customer commitment |
| Product owner | Charter, cohort, workflow, success metrics, change control |
| Engineering owner | Technical readiness, access, observability, idempotency, pause/rollback |
| Legal/compliance owner | Counsel, PAD rules, RPAA/FINTRAC, approved language/contracts |
| Security/privacy owner | Vendor/data-flow review, least privilege, incident readiness |
| Finance/reconciliation owner | Settlement model, daily reconciliation, exceptions, accounting evidence |
| Operations/support owner | Enrollment, monitoring, cases, scripts, service levels, complaints |
| Customer PMS owner | Roster/obligation accuracy, parallel-run controls, operator decisions |

Any domain owner may block live activity for an unresolved critical risk in their domain.

## Entry checklist

- [ ] Phase 0 checklist is signed `GO`; all conditions are satisfied and current.
- [ ] Provider, payee, onboarding, funds flow, settlement, returns, disputes, and liability are contractually confirmed.
- [ ] Counsel-approved authorization, confirmation, notice, cancellation, complaint, and support language is deployed exactly as approved.
- [ ] Privacy/security, reconciliation, and operational approvals are recorded.
- [ ] Production credentials are least privilege, environment-separated, and protected by an enablement control.
- [ ] Provider webhook signing, idempotency, replay, delayed events, returns, and reconciliation have passed tests.
- [ ] Pilot roster and rent obligations are dual-reviewed against PMS/Yardi.
- [ ] Duplicate-debit controls identify every existing payment schedule or manual process.
- [ ] Support, finance, operations, engineering, provider, and customer escalations are staffed.
- [ ] Pause, cancellation, manual fallback, incident, and customer-communication rehearsals pass.

## Migration and parallel-run procedure

Migration friction is a primary enterprise risk, not an onboarding detail.

1. Export the bounded property, lease, tenant, rent-obligation, and existing-payment-schedule roster from the PMS.
2. Map records to canonical RentChain IDs with an exception queue; never use external identifiers as product primary keys.
3. Use bounded CSV/import/export only where needed for the pilot; do not make a full platform migration a prerequisite.
4. Have the customer PMS owner validate ownership, payee, settlement destination, amount, timing, lease status, tenant contact data, and duplicates.
5. Do not assume an existing bank authorization is portable. Obtain a new provider-managed authorization unless counsel and the provider confirm lawful, evidenced conversion.
6. Record a cutover state per lease: `MANUAL_ONLY`, `AUTHORIZATION_PENDING`, `PAD_READY`, `PAD_ACTIVE`, `PAUSED`, or `EXITED`.
7. Before each debit window, compare PMS obligation, RentChain approved instruction, provider state, and any manual/external schedule.
8. Maintain manual/offline collection until the lease is explicitly active and reconciled; never run both collection paths for the same obligation.
9. Reconcile outcomes back to the PMS/operator process through approved evidence rather than claiming RentChain replaces the PMS ledger.

## Staged rollout

### Stage 0 — production-safe readiness

Use non-live verification, access review, tabletop incidents, and a final roster dry run. Confirm the production kill switch and that legacy PAP prototypes are not mounted or called.

### Stage 1 — first property

Enroll only the approved small cohort. Require dual approval for every initial debit instruction. Hold expansion until authorization, submission, webhook, support, and daily reconciliation evidence is reviewed.

### Stage 2 — additional properties

Add one property batch at a time. Each batch requires clean roster mapping, no unresolved severe exceptions, capacity confirmation, and a signed expansion decision.

### Stage 3 — pilot completion

Stop new enrollment, finish settlement/return observation, reconcile all instructions, export evidence, collect customer/tenant/support feedback, and decide `EXIT`, `EXTEND`, or `PROPOSE BETA IMPLEMENTATION`. No automatic general availability follows.

## Per-debit operating procedure

1. Confirm current authorization, approved amount/timing, lease/tenant/payee ownership, and absence of another schedule.
2. Record the operator/user approval and deterministic debit instruction.
3. Submit exactly once with a durable idempotency key; retain provider request identifiers without sensitive bank data.
4. Show `submitted/processing`, not paid or settled, until the appropriate provider evidence exists.
5. Process only signed provider events; tolerate duplicates and out-of-order delivery.
6. Reconcile provider, instruction, obligation, receipt, ledger projection, and settlement/return state.
7. Route ambiguous, failed, returned, disputed, cancelled, or mismatched results to review. Do not silently retry.
8. Notify affected parties using counsel-approved templates and record delivery evidence.

## Daily operations

- Review submissions, processing age, failures, returns, cancellations, disputes, webhook health, reconciliation exceptions, complaints, and support backlog.
- Verify provider totals against RentChain instructions and approved settlement evidence.
- Age and assign every exception; require dual review for manual correction or retry.
- Sample authorization/notice evidence and role-based views for privacy and accuracy.
- Confirm the PMS/operator record does not schedule or represent a duplicate collection.
- Produce a daily signed status: `CONTINUE`, `HOLD EXPANSION`, or `PAUSE`.
- Hold a weekly customer review of metrics, exceptions, tenant/landlord feedback, support load, reconciliation time, pricing feedback, and expansion eligibility.

## Immediate pause conditions

Pause affected debits—and the whole pilot when scope is uncertain—for duplicate or wrong-amount submission, unauthorized debit, compromised credential, webhook verification failure, unexplained reconciliation difference, settlement to the wrong recipient, systemic provider outage, missing approved notice, privacy/security incident, excessive returns/complaints, or loss of operational coverage.

On pause: disable new submission through the approved control; preserve evidence; notify incident owners and provider; assess tenant/customer communications with counsel; continue safe status retrieval/reconciliation; use the manual fallback without duplicating obligations; and require written restart approval.

## Exit and evidence package

- Every instruction has a final or explicitly tracked delayed state.
- Provider totals, settlement/return evidence, RentChain records, and operator/PMS records reconcile.
- Authorizations, approvals, notices, provider events, support cases, incidents, exceptions, and decisions are exportable and retained per approved policy.
- Success/stop metrics and unit economics are reported without overstating production readiness.
- Customer migration friction, operator time, complaints, failures/returns, and support effort are included.
- Counsel, security/privacy, finance, operations, product, engineering, and executive owners record follow-up conditions.
