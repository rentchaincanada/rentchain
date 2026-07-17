# PAD Compliance And Risk Gates v1

Status: implementation checklist for qualified review; not legal advice or compliance certification

## Gate Ownership

No single engineering approval is sufficient. The launch record must name owners and evidence for product, payments operations, Canadian payments/privacy counsel, security, privacy, finance/reconciliation, support and the pilot landlord. Unknown or conditional findings keep the gate closed.

## Legal And Counsel Review

- Identify the payee, processor, sponsor/financial institution, merchant/connected account, statement descriptor and landlord/tenant responsibilities for the exact funds flow.
- Approve the PAD agreement class and language, electronic authorization, agreement delivery/confirmation and evidence standard.
- Map fixed, variable, sporadic/interval/combined and rent-change scenarios to approved mandate terms.
- Approve advance/pre-notification, waiver and change-notice requirements and delivery evidence.
- Approve cancellation/revocation rights, effective cutoffs and effect on already-submitted debits and underlying lease obligations.
- Approve NSF/returned-payment language, any fee treatment, retry eligibility/caps and landlord/tenant communications.
- Approve refund, reversal, adjustment, dispute/reimbursement and unauthorized-debit processes.
- Review applicable provincial tenancy/consumer rules for requiring/offering payment methods, receipts, fees, rent changes and arrears handling.
- Approve Terms of Use, privacy policy, PAD agreement, landlord/pilot agreement, support terms and processor-contract alignment before production.
- Approve audit, agreement, notice, receipt, dispute and payment-record retention and legal-hold procedure.

## Regulatory Review

- Document the processor-led ACSS/PAD flow and confirm RentChain does not hold funds under the approved architecture.
- Obtain written RPAA scope analysis for every payment function RentChain performs; no-custody alone is not treated as an exemption.
- Obtain written FINTRAC/MSB scope analysis for the final activities and funds flow.
- Verify provider/partner registration, sponsorship and contractual responsibilities where applicable; a registry entry is not an endorsement.
- Review funds safeguarding only if any design change causes RentChain or its agent to hold end-user funds; that change requires a new architecture approval.
- Review cyber, technology E&O, crime/funds-transfer, regulatory and payment/dispute insurance coverage and exclusions.
- Record provincial launch scope. Expanding to another province requires a delta review.

## Provider And Commercial Gate

- Sandbox and live product eligibility confirmed in writing.
- Payee/merchant account ownership, onboarding/KYC, negative-balance and return liability approved.
- Settlement destination, timing, reserves/holds, fees, limits, statement descriptors and reporting documented.
- Mandate ownership, portability, cancellation and provider-exit/export documented.
- Webhook types, status/return codes, retry behavior, rate limits, idempotency and support escalation documented.
- Data processing, subprocessors, residency/transfer, incident notice, retention/deletion and audit rights approved.
- Sandbox behavior and test fixtures are sufficient to exercise delayed failures/returns and disputes.

## Security And Privacy Gate

### Data minimization

- Bank details are collected only on a provider-controlled/tokenized surface.
- RentChain stores provider tokens/references and approved masked display data only.
- Raw bank, transit, institution, login, verification and micro-deposit data are prohibited from product records, logs, analytics and support tools.
- Raw provider payload storage is prohibited unless a separate encrypted forensic store, access policy and retention decision are approved.

### Access and secrets

- Tenant, landlord/PM and support projections are explicit allowlists with cross-tenant/landlord negative tests.
- Every mutation resolves server-side authority and requires the minimum role permission.
- Use provider restricted API keys with minimum endpoint permissions where supported, separate per service/environment.
- Store keys and webhook secrets in the platform secrets manager; never source control, client code or logged environment dumps.
- Apply provider-supported IP restrictions and strong dashboard access controls; require phishing-resistant 2FA where practical.

### Webhooks and jobs

- Verify webhook signatures against the raw body before parsing/processing.
- Deduplicate durable provider-event receipts atomically.
- Bound request size, validate schema, reject unknown account context and rate limit abuse.
- Separate sandbox/staging/production endpoints, secrets, accounts, data and queues.
- Scheduler/worker entry points use authenticated service identity, least privilege, bounded batches and replay-safe locks.
- Controlled replay requires allowlisted event types, dry-run, reason, actor, expected state/version and audit record.

### Incident readiness

- Threat model covers duplicate/unauthorized debit, account takeover, cross-tenant leakage, compromised key/webhook, provider outage, incorrect schedule, insider misuse and reconciliation drift.
- Runbooks cover key rotation, webhook compromise, duplicate-debit allegation, unauthorized debit/dispute, privacy incident, provider outage and queue/reconciliation recovery.
- Alerts avoid sensitive payloads and include safe correlation references.

## Data And Financial Integrity Gate

- Lease-to-obligation source-of-truth and multi-tenant responsibility are approved.
- Obligation preview/apply is deterministic, versioned and stale-safe.
- Attempt idempotency survives timeouts, retries, worker restarts and duplicate jobs.
- Provider receipt and reconciliation precede ledger/receipt success projection.
- Manual/card/external payments prevent duplicate PAD collection through allocation checks.
- Returns reverse allocations append-safely and reopen balances correctly.
- Settlement/payee reconciliation and exports balance to provider reports for the pilot scope.
- No destructive correction or last-write-wins financial history exists.

## Product And Accessibility Gate

- Tenant understands payee, amount/schedule basis, mandate status, cancellation and support path.
- Pending, succeeded, failed and returned language is distinct and user tested.
- Consent is affirmative, versioned and accessible; no prechecked or coercive control.
- Notifications are accessible, privacy-safe and retain delivery evidence.
- Landlord views expose actionable exceptions without raw banking/provider data.
- English/French and accessibility obligations are assessed for the launch scope.

## Operational Gate

- Named payment operations and support owners exist with severity/escalation targets.
- Daily exception/reconciliation queue, ownership and aging controls are rehearsed.
- Support cannot fabricate payment success, activate mandates or bypass authorization.
- Provider escalation and tenant/landlord communication templates are approved.
- Pilot volume, debit limits, retry rules, rollout cohorts, stop switch and rollback/export path are documented.
- Business continuity covers provider, email and RentChain outages around due dates.

## Go / No-Go Checklist

Production remains **no-go** until all are evidenced:

1. Provider and funds-flow decision approved; sandbox account/onboarding complete.
2. Counsel signs off on PAD authorization, notices, cancellation, failure/return, dispute and provincial launch language.
3. RPAA and FINTRAC/MSB analyses are written and approved.
4. Privacy policy, terms, agreements and data-processing records are updated outside this design PR.
5. Security/threat model and privacy assessment pass; secrets and environment separation verified.
6. Mandate, obligation and attempt state-machine tests pass.
7. Signed-webhook, duplicate, out-of-order, delayed, missing and replay tests pass.
8. NSF, closed account, cancellation race, rent change, partial period, manual payment and later-return scenarios pass.
9. Ledger allocation, receipt reversal, provider settlement and export reconciliation pass.
10. Load/recovery tests pass at production-shaped 3,000-unit volume with documented SLOs.
11. Support, incident, reconciliation and provider-outage playbooks are exercised.
12. Pilot landlord agreement, data ownership, limits, success criteria and exit plan are signed.
13. Final production readiness review records named approval from every gate owner.

Any material funds-flow, provider, province, mandate, retry, settlement or data-retention change reopens the applicable gates.

## Evidence Register Template

| Gate | Owner | Evidence link/reference | Status | Conditions/expiry | Approved at |
| --- | --- | --- | --- | --- | --- |
| Provider/funds flow | Payments lead | Future | Open | — | — |
| Legal/Rule H1 | Counsel | Future | Open | — | — |
| RPAA/FINTRAC | Counsel | Future | Open | — | — |
| Privacy/data | Privacy owner | Future | Open | — | — |
| Security | Security owner | Future | Open | — | — |
| Financial reconciliation | Finance/ops | Future | Open | — | — |
| Support/incident | Support owner | Future | Open | — | — |
| Pilot acceptance | Customer owner | Future | Open | — | — |

This template intentionally begins open. Documentation completion is not gate approval.
