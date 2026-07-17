# PAD External Validation Checklist v1

Status: external-validation preparation only; PAD is planned and not implemented

## Use and boundaries

This checklist coordinates evidence from a payment provider, Canadian payments/privacy/commercial counsel, a prospective enterprise pilot landlord, tenant-style reviewers, and RentChain's internal decision owners. It does not authorize implementation or live debit testing.

Do not reuse the legacy PAP prototype as production PAD. Do not let RentChain hold funds directly in the first implementation. Provider sandbox success is not legal approval. Do not begin live debit testing without counsel-approved authorization language. Do not publicly promise PAD until provider, legal, and beta readiness are confirmed. Do not claim Certn is live unless the integration is actually live.

Allowed status values: `OPEN`, `IN PROGRESS`, `PASS`, `PASS WITH CONDITIONS`, `BLOCKED`, `NOT APPLICABLE`. Every pass needs linked evidence, an owner, a date, and any expiry or assumptions.

## Provider validation

| Validation item | Owner | Evidence required | Pass condition | Notes/status |
| --- | --- | --- | --- | --- |
| Canadian ACSS/PAD eligibility | Payments lead | Written provider confirmation for the actual rent use case, business, volume, and jurisdiction | Sandbox and prospective live eligibility are confirmed with conditions documented | TBD |
| Landlord/payee model | Payments + finance | Participant and payee-of-record statement | Payee, merchant, tenant, landlord/manager, provider, and RentChain roles are unambiguous | TBD |
| Account/Connect model | Payments + engineering | Recommended account configuration and responsibility matrix | Account ownership, KYC, fees, losses, requirements collection, and dashboard access are explicit | TBD |
| No-custody funds flow | Payments + counsel | Provider-confirmed funds-flow diagram | Funds route provider-to-approved payee without RentChain possession or control; counsel separately approves characterization | TBD |
| Mandate/payment references | Engineering + privacy | Sample safe objects and retention/export description | Provider owns sensitive bank data; RentChain can retain only approved opaque references, status, and evidence metadata | TBD |
| Off-session debit | Engineering | Written flow and sandbox test plan | One specifically approved debit can reference the applicable mandate and payment method within mandate terms | TBD |
| Lifecycle/webhooks | Engineering + finance | Event/state matrix | Pending, success, failure, return, cancellation/dispute, and settlement evidence can be represented without premature success claims | TBD |
| NSF/failed/returned handling | Payments operations | Return-code, timing, retry, notice, and dispute documentation | Delayed returns and liability are understood; no silent or autonomous retry is required | TBD |
| Sandbox access | Engineering | Account/access/setup instructions | Isolated test access, supported fixtures, and teardown path are available | TBD |
| Idempotency/replay | Engineering | Provider guarantees plus duplicate, timeout, replay, and out-of-order test cases | Duplicate debit risk is controlled and ambiguous submission requires lookup/reconciliation | TBD |
| Fees, reserves, limits | Finance | Written fee schedule and commercial terms | Transaction, verification, return, dispute, platform, reserve, minimum, and volume costs are modeled | TBD |
| Support limitations | Operations | SLA, escalation, incident, and account-support terms | Beta coverage, escalation contacts, response expectations, and unsupported cases are acceptable | TBD |

## Counsel and legal validation

| Validation item | Owner | Evidence required | Pass condition | Notes/status |
| --- | --- | --- | --- | --- |
| PAD authorization agreement | Counsel | Approved template and assumptions | Agreement class, parties, authorization evidence, delivery, and retention are approved | TBD |
| Fixed/variable treatment | Counsel + product | Written classification and approved copy | Rent amount/timing changes, schedule type, and required new authorization or notice are explicit | TBD |
| Notice requirements | Counsel + operations | Notice matrix and delivery evidence requirements | Pre-notice, change notice, confirmation, and any waiver rules are approved | TBD |
| Cancellation process | Counsel + product | Approved cutoffs, copy, and operational steps | Tenant can cancel/revoke clearly; submitted versus future debit treatment is defined | TBD |
| NSF/return language | Counsel + operations | Approved tenant/landlord terms and messages | Fees, retries, obligations, disputes, and support communications are lawful and understandable | TBD |
| Privacy updates | Privacy counsel | Required change list and data-flow review | Collection, purpose, consent, provider disclosure, transfers, retention, access, and deletion changes are approved | TBD |
| Terms updates | Commercial counsel | Required Terms of Use and agreement changes | RentChain, landlord, tenant, and provider responsibilities and limitations are aligned | TBD |
| RPAA analysis | Payments counsel | Written activity-by-activity memo | Registration, exclusion, agency/mandatary, third-party, safeguarding, and operational-risk conclusions are documented | TBD |
| FINTRAC/MSB analysis | Payments counsel | Written memo | Applicable activities, exemptions, registrations, and controls are documented | TBD |
| Insurance | Counsel + broker | Coverage/exclusion/limit review | Cyber, E&O, crime/funds-transfer, regulatory, and dispute risks are accepted or remediated | TBD |
| No-custody review | Counsel | Final provider response, contracts, and funds-flow diagram | Counsel approves the actual roles and flags any regulatory duties that remain despite no custody | TBD |

## Pilot landlord validation

| Validation item | Owner | Evidence required | Pass condition | Notes/status |
| --- | --- | --- | --- | --- |
| Candidate and property group | Enterprise lead | Named customer, decision makers, and bounded cohort | Serious candidate and safe limited property group are identified | TBD |
| Pain points | Product | Interview notes and baseline measures | PAD, reconciliation, evidence, onboarding, and support problems are concrete and prioritized | TBD |
| Parallel run | Customer sponsor | Written acceptance of field ownership and operating model | Pilot runs beside Yardi/existing PMS with no forced replacement | TBD |
| Paid pilot | Enterprise lead | Commercial discussion record | 60–90 day paid structure is accepted or under written negotiation | TBD |
| Annual pricing path | Executive + customer sponsor | Pricing feedback | $30/unit/year reference and provider/transaction costs are discussed without public commitment | TBD |
| Data availability | Customer technical owner | Sample export and data inventory | Limited CSV/import/export can support the cohort with identified quality gaps | TBD |
| Support ownership | Operations + customer | Named contacts and coverage | Tenant, landlord, payment, and technical escalation owners are assigned | TBD |
| Success metrics | Product + customer | Signed metric/exit sheet | Annualization, extension, pause, and stop criteria have measurable baselines | TBD |

## Tenant experience validation

| Validation item | Owner | Evidence required | Pass condition | Notes/status |
| --- | --- | --- | --- | --- |
| Authorization copy | Product + counsel | Counsel-approved draft tested with reviewers | Reviewers understand authorization, payee, amount/schedule, data handling, and support | TBD |
| 3–5 comprehension tests | Research owner | Completed test templates | At least 3–5 uncoached tenant-style reviews are recorded | TBD |
| Mobile comprehension | Design/research | Mobile-first review notes | Key terms and actions are understandable without desktop context | TBD |
| Receipt/status language | Product + operations | Review results for pending/success/settled/returned states | Reviewers do not confuse initiation, processing, payment, and settlement | TBD |
| Failed-payment notice | Counsel + support | Tested approved copy | Reviewer understands what happened, what remains owed, and who to contact | TBD |
| Cancellation/change flow | Product + counsel | Tested scenario notes | Reviewer understands cancellation timing, rent changes, and future debit impact | TBD |

## Internal operational validation

| Validation item | Owner | Evidence required | Pass condition | Notes/status |
| --- | --- | --- | --- | --- |
| Payment incident playbook | Security + operations | Tabletop record | Duplicate/unauthorized debit, provider outage, compromised key, and reconciliation incidents are executable | TBD |
| Support scripts | Support + counsel | Approved scripts | Tenant/landlord questions, cancellation, failures, and escalation are covered without legal overclaim | TBD |
| Audit event list | Engineering + compliance | Reviewed taxonomy | Authorization, notices, attempts, provider evidence, returns, decisions, and reconciliation are attributable and append-safe | TBD |
| Reconciliation workflow | Finance + operations | Daily/period process and exception ownership | Provider, obligation, attempt, ledger, settlement, and PMS evidence can be balanced | TBD |
| Provider memo | Payments lead | Signed feasibility memo | Provider findings, conditions, costs, risks, and unknowns are complete | TBD |
| Counsel memo | Counsel owner | Signed go/no-go memo | Required legal deliverables and blockers are complete | TBD |
| Pilot memo | Enterprise lead | Customer validation summary | Demand, cohort, pricing, data, support, metrics, and commitment are recorded | TBD |
| Internal meeting | Executive sponsor | Minutes and signed decision table | All critical owners record proceed, extend, or pause decision | TBD |

## Pricing, migration, and final gate

The enterprise reference is $30/unit/year, or $90,000/year for 3,000 units. PAD supports enterprise value more directly than public small-landlord pricing, must not be bundled into low-cost flat monthly tiers without enterprise review, and requires pilot validation of provider costs and willingness to annualize. White-glove onboarding may be paid.

The pilot should use staged property groups beside Yardi/existing PMS, no forced full migration, and limited CSV/import/export only as needed.

**PAD beta implementation cannot begin until provider feasibility, counsel go/no-go, and pilot landlord commitment are complete.**
