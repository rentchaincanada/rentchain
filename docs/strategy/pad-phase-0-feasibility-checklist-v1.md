# PAD Phase 0 Feasibility Checklist v1

## Purpose and boundary

This checklist governs the decision to begin a bounded PAD beta. It does not authorize production PAD, customer enrollment, or a live debit. PAD is not implemented today, and this package includes no Stripe/ACSS or Certn implementation. Legacy PAP route, service, and scheduler files are unmounted, unauthenticated prototypes and must not become the production PAD path.

RentChain's intended role is a workflow, evidence, and PAD-readiness layer beside an operator's property-management system (PMS), including Yardi. RentChain must not hold tenant or landlord funds. Provider-managed authorization, payment-method storage, debit submission, settlement, and return handling are required design assumptions, subject to counsel and provider confirmation.

Sandbox evidence is not legal, compliance, security, reconciliation, operational, or production approval. No live debit may occur until counsel approves the authorization and notice language and every mandatory gate below is signed.

## Decision record

| Field | Required entry |
| --- | --- |
| Decision owner | Executive sponsor |
| Target decision date | TBD |
| Proposed provider and funds flow | TBD after provider diligence |
| Payee of record | TBD |
| Settlement destination owner | TBD |
| Liability owner for returns, disputes, fees, and negative balances | TBD |
| Pilot cohort and properties | TBD |
| Recommendation | `GO`, `CONDITIONAL GO`, or `NO-GO` |
| Conditions and expiry | Required for conditional go |
| Approvers | Executive, product, engineering, legal/compliance, security/privacy, finance/reconciliation, operations/support |

## Gate A — business and commercial feasibility

- [ ] Executive sponsor and single accountable pilot owner are named.
- [ ] The initial job is limited to approved rent debits, not a general wallet, custody product, or PMS replacement.
- [ ] Pricing chooses among an enterprise add-on, an annual enterprise-package inclusion, or per-unit pricing plus transaction/provider costs; the pilot validates the choice.
- [ ] The team explicitly decides whether any per-transaction fee, monthly module fee, or per-unit annual bundle is customer-facing or absorbed.
- [ ] The paid pilot is bounded to 60–90 days, named properties, a tenant cohort, and explicit exit criteria.
- [ ] The pilot operates in parallel with the customer's PMS/Yardi process and does not replace the system of record.
- [ ] The commercial reference is documented: $30 per unit per year implies $90,000 per year for 3,000 units.
- [ ] Pricing is treated as an enterprise reference, not a public promise or a cheap flat-tier bundle.
- [ ] Pilot fees, provider fees, return costs, implementation effort, support effort, and liability allocation are modeled.
- [ ] Paid onboarding and migration support are evaluated separately from recurring PAD pricing.
- [ ] Success metrics cover adoption, authorization completion, submission success, settlement evidence, reconciliation, returns, support load, and operator time saved.
- [ ] Pilot and customer owners decide who answers tenant questions and the support coverage commitment.
- [ ] Stop-loss thresholds are defined for failed/returned debits, reconciliation exceptions, complaints, privacy/security incidents, and support capacity.
- [ ] No public launch date, provider commitment, or capability promise has been made.

Evidence: approved pilot charter, unit economics model, cohort definition, success/stop criteria, signed commercial owner review.

## Gate B — payment and provider feasibility

- [ ] The provider decision matrix is complete with evidence for Stripe ACSS, at least one Canadian alternative, and a manual/offline fallback.
- [ ] Stripe ACSS is evaluated as the preferred first feasibility track, not treated as the final provider selection.
- [ ] Provider eligibility, Canadian availability, account configuration, limits, settlement timing, returns, disputes, and support escalation are confirmed in writing.
- [ ] Provider-managed authorization and mandate evidence are supported.
- [ ] A SetupIntent-style flow can save a verified bank payment method and mandate for later use.
- [ ] An off-session PaymentIntent-style debit can be created for each specifically approved rent debit.
- [ ] Payment method data and sensitive bank credentials are not stored by RentChain.
- [ ] Webhook authenticity, idempotency, duplicate delivery, out-of-order events, delayed outcomes, retry safety, and reconciliation exports are tested.
- [ ] The end-to-end funds flow shows that RentChain does not hold funds.
- [ ] Payee ownership, landlord/property-manager onboarding, settlement routing, reserves/negative balances, returns, refunds, and liability are explicitly decided.
- [ ] Production enablement is separate from sandbox credentials and cannot be activated by ordinary application configuration alone.

Evidence: provider responses, architecture diagram, sandbox test record, webhook/reconciliation evidence, approved funds-flow and liability record.

## Gate C — legal, regulatory, privacy, and security

- [ ] Canadian payments counsel has reviewed the exact proposed participant roles and funds flow.
- [ ] Counsel has provided a documented RPAA/Bank of Canada analysis; no-custody is not assumed by itself to settle regulatory scope.
- [ ] Counsel has reviewed applicable Payments Canada PAD rules and the authorization, confirmation, pre-notification, cancellation, dispute, and record-retention approach.
- [ ] Counsel has approved the tenant-facing mandate, debit authorization, variable-amount/timing disclosure, notice, cancellation, and support language.
- [ ] Counsel has confirmed whether landlord/property-manager agreements require amendments.
- [ ] Counsel and the insurance broker assess insurance coverage, exclusions, limits, and notification obligations.
- [ ] Counsel advises whether a separate payments entity is required or advisable now or at a later scale threshold.
- [ ] Privacy review covers data inventory, purpose, consent, retention, deletion, subprocessors, cross-border processing, and access requests.
- [ ] Security review covers threat model, least privilege, restricted provider keys, secret storage, environment separation, signed webhooks, audit logs, incident response, and vendor risk.
- [ ] RentChain's terms and privacy documents are assessed, but no public document is changed in this mission.
- [ ] No live debit occurs before the preceding reviews are approved.

Evidence: counsel memo, approved language, RPAA/FINTRAC applicability record, privacy impact review, security approval, vendor-risk record.

## Gate D — technical feasibility

- [ ] Current reusable foundations are confirmed: authenticated payment entry points, provider boundary, signed webhook handling, provider receipts, reconciliation, canonical events, ledger projections, tenant payment views, and tests.
- [ ] Production PAD is isolated from legacy PAP prototypes and uses authenticated, authority-resolved routes.
- [ ] The canonical data model covers customer/payee configuration, authorization, payment method reference, debit instruction, attempt, provider event, settlement/return, reconciliation exception, and immutable audit evidence.
- [ ] Lifecycle states and allowed transitions are deterministic and distinguish submitted, processing, succeeded, settled, failed, returned, cancelled, and reconciliation-exception outcomes.
- [ ] Each debit is traceable to an approved rent obligation, authorization, actor, amount, schedule, provider request, provider event, ledger projection, and settlement result.
- [ ] Idempotency keys and durable request fingerprints prevent duplicate debit creation.
- [ ] Webhook processing is signature-verified, replay-safe, order-tolerant, and auditable.
- [ ] Retry policy never silently creates a second debit and requires operator review where outcome is ambiguous.
- [ ] Tenant, landlord/property-manager, and admin/support projections expose only role-appropriate information.
- [ ] Sandbox exit evidence is repeatable and reviewed; it is not represented as production readiness.

Evidence: approved design, threat model, test matrix/results, trace samples, failure/replay tests, engineering sign-off.

## Gate E — operational and pilot readiness

- [ ] Pilot runbook names accountable owners and escalation paths for enrollment, debit approval, monitoring, returns, cancellations, complaints, incidents, reconciliation, and customer communications.
- [ ] Tenant support can explain authorization, debit timing, cancellation, returns, and escalation without giving legal advice.
- [ ] Finance approves daily reconciliation, exception aging, evidence retention, and month-end treatment.
- [ ] Operations approves manual review queues and service levels.
- [ ] A staged property rollout and rollback/pause mechanism are rehearsed.
- [ ] The PMS/Yardi parallel-run source-of-truth and double-entry prevention controls are documented.
- [ ] Migration friction is tracked as a primary enterprise risk, including roster quality, ownership mapping, authorization conversion limits, duplicate schedules, and operator training.
- [ ] Incident exercises cover duplicate submission, delayed provider event, returned debit, wrong amount, cancellation race, provider outage, compromised credential, and reconciliation mismatch.
- [ ] A final pre-live review confirms no unresolved critical risks.

Evidence: runbook rehearsal, support scripts, reconciliation sign-off, incident tabletop results, pilot roster, rollback record, operational approval.

## Go/no-go rule

`GO` requires all mandatory gates, named owners, signed approvals, no unresolved critical risk, and a production-enablement control. `CONDITIONAL GO` is allowed only for non-live preparation with explicit conditions, owners, deadlines, and expiry. It never authorizes a live debit. `NO-GO` is required if payee, settlement, liability, counsel, RPAA/FINTRAC, privacy/security, reconciliation, operational, provider, or duplicate-debit controls remain unresolved.

The executive sponsor records the result. Legal/compliance, security/privacy, finance/reconciliation, or operations may independently block live activation within their domain.
