# PAD Sandbox Readiness Plan v1

## Purpose

Produce repeatable technical and operational evidence for a provider decision without implementing or enabling production PAD. Stripe ACSS is the preferred first feasibility track, not the final provider selection. A second Canadian PAD/EFT candidate must receive a comparable assessment.

Sandbox work does not constitute legal approval, production readiness, provider eligibility, or authority to debit. RentChain will not hold funds. No public promise, live customer enrollment, real bank credential, real debit, pricing-page change, or production configuration is in scope.

## Preconditions

- Product supplies one provider-neutral use case: provider-managed authorization for later rent debits and one off-session debit per approved obligation.
- Finance and operations draft payee, onboarding, settlement, reconciliation, return, and liability questions; unresolved items stay visibly open.
- Counsel identifies prohibited test data and confirms that sandbox artifacts cannot be reused as live authorization.
- Security approves isolated test accounts, synthetic data, secret handling, least privilege, retention, and access logging.
- Engineering confirms legacy PAP prototypes remain unmounted and are not reused as the sandbox implementation path.
- A time-box, owner, evidence repository, decision date, and teardown date are set.

## Workstreams

Before implementation, engineering must confirm current provider documentation; enumerate required environment variables and secrets without recording values; define webhook-signature verification; specify synthetic tenant, landlord, property, lease, authorization, debit, event, and return fixtures; define event replay/status-retrieval tooling; document local, sandbox, staging, and production separation; and obtain approved retention and log-redaction rules.

### 1. Provider/account feasibility

Obtain written confirmation or record `unknown` for Canadian account eligibility, ACSS/PAD enablement, provider account model, payee/settlement recipient, onboarding, limits, delayed outcomes, returns/disputes, reserves/negative balances, support, pricing, and production approval steps.

For a Connect-style model, evaluate the provider's current account/controller model and hosted onboarding; do not base a new design on legacy account-type labels. The chosen model must show that funds do not pass through RentChain custody.

### 2. Authorization feasibility

Demonstrate with synthetic test identities and provider test methods:

- provider-managed bank verification;
- a SetupIntent-style future-use flow and retrievable mandate/authorization evidence;
- success, incomplete verification, failure, cancellation, expiry, and replacement;
- provider-published test bank details/payment methods only, including instant-verification and fallback paths where supported;
- evidence references sufficient for tenant, operator, support, and audit views;
- no raw bank credential stored or logged by RentChain.

Capture provider-hosted screens or artifacts only under approved data-handling rules. Counsel must separately approve live language and evidence sufficiency.

### 3. Debit lifecycle feasibility

Demonstrate one off-session PaymentIntent-style object per approved debit and test:

- deterministic request/idempotency identity;
- submitted/processing behavior without premature paid/settled claims;
- success and settlement evidence;
- insufficient funds or equivalent failure;
- delayed failure/return after an earlier processing or success signal;
- cancellation race and ambiguous network response;
- duplicate request suppression and safe operator-directed retry;
- refund/dispute representation where supported.
- simulated NSF/return and delayed settlement/return outcomes where supported.

Do not hardcode a provider payment-method list merely to force a sandbox result; use provider account/payment-method configuration consistent with current provider guidance.

### 4. Webhook, event, and reconciliation feasibility

- Verify signatures using isolated secrets.
- Test duplicates, replays, out-of-order events, missing events, delayed events, unknown objects, and key rotation.
- Prove processing is idempotent and creates append-safe canonical evidence.
- Compare API status retrieval, event history, provider report/export, debit instruction, receipt, ledger projection, and settlement/return outcome.
- Create an exception when sources disagree; never rewrite history to hide the difference.
- Measure detection and recovery time for a missed event and reconciliation mismatch.

### 5. Role and operational feasibility

Using synthetic data, review least-information projections for:

- tenant: authorization, approved debit, current non-misleading status, notice/cancellation/support evidence;
- landlord/property manager: authorized cohort, obligation/debit status, settlement/return and actionable exceptions;
- admin/support: evidence trace, provider identifiers, event/reconciliation state, safe remediation controls.

Run table-top exercises for duplicate debit, wrong amount, returned debit, provider outage, compromised key, unauthorized access, cancellation race, wrong settlement recipient, and customer complaint.

### 6. Comparative provider spike

Run the same evidence checklist against at least one qualified Canadian provider/category. A documentation/API review may replace code when access is unavailable, but all untested claims must remain `unknown`. Compare capability, role clarity, evidence, integration effort, risk, support, and total cost at the $30/unit/year reference ($90,000/year for 3,000 units).

## Test evidence register

| Test | Expected evidence | Owner | Result |
| --- | --- | --- | --- |
| Authorization success/failure/replacement | Provider IDs, safe screenshots/logs, mandate evidence reference | Engineering | TBD |
| Off-session debit success/processing/failure/return | Object/event timeline and application state trace | Engineering | TBD |
| Duplicate and ambiguous submission | One provider debit and reviewable outcome | Engineering | TBD |
| Webhook replay/out-of-order/missing | Idempotent event processing and recovery record | Engineering | TBD |
| Reconciliation match/mismatch | Provider-to-instruction trace and exception | Finance/engineering | TBD |
| Role projections | Approved tenant/operator/support view review | Product/privacy | TBD |
| Incident tabletop | Timeline, decisions, communication and restart gates | Operations/security | TBD |
| Provider/account/funds-flow confirmation | Written provider response and diagram | Product/finance | TBD |

Every artifact records environment, date, provider/API version where applicable, test identifiers, expected/actual result, reviewer, limitations, and linked issue. Do not include secrets, raw bank details, or unrelated personal data.

## Exit criteria

The sandbox phase may recommend `PROCEED TO DESIGN/IMPLEMENTATION APPROVAL`, `CONTINUE DILIGENCE`, or `STOP`. A proceed recommendation requires repeatable evidence for authorization, one-debit-per-approval submission, webhook/idempotency/retry safety, delayed outcomes, reconciliation, role projections, secure environment separation, and a plausible no-custody funds flow.

It also requires provider answers sufficient for counsel and the provider matrix, provider account approval or a documented approval path, an approved payment-flow diagram, a selected pilot landlord, and a defined support escalation path. It does not require or imply a live debit. Unresolved payee, settlement, liability, provider eligibility, counsel, RPAA/FINTRAC, privacy/security, reconciliation, or operational questions must block production enablement.

## Teardown

At the time-box end, revoke unused test credentials, remove unnecessary test access, delete synthetic artifacts according to policy, retain the approved evidence package, record open risks, and verify no production flag, live credential, customer authorization, schedule, or public product claim was created.
