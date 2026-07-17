# PAD Provider Decision Matrix v1

## Decision to be made

Select the first provider and funds-flow model for a bounded Canadian PAD beta. Stripe ACSS is the preferred first feasibility track because it aligns with existing Stripe foundations, but it is not the final selection. All capabilities, commercial terms, eligibility, and regulatory responsibilities require current written confirmation from the provider and counsel.

RentChain must not hold funds. The intended model uses provider-managed authorization and payment-method storage, with one off-session debit object per approved rent debit. No option may advance because of sandbox success alone.

## Non-negotiable requirements

- Canadian PAD support for the proposed merchant/payee and property-management model.
- Provider-hosted or provider-managed bank verification, authorization, and mandate evidence.
- Tokenized payment method; no bank credentials stored by RentChain.
- Explicit payee, settlement destination, onboarding, return/dispute, reserve, negative-balance, and liability model.
- Signed, replay-safe webhooks plus durable provider identifiers and reconciliation evidence.
- Safe idempotent submission and documented delayed-outcome handling.
- Separate sandbox and production enablement with least-privilege credentials.
- Exportable evidence sufficient for operations, audit, counsel, and customer support.
- Acceptable Canadian data-processing, privacy, security, availability, support, and incident terms.

## Options

| Option | Proposed shape | Advantages to validate | Material questions and risks | Initial disposition |
| --- | --- | --- | --- | --- |
| Stripe ACSS Debit | Provider-managed SetupIntent/mandate for future use; one off-session PaymentIntent per approved debit; determine whether Connect/onboarding and settlement routing are required | Reuses existing Stripe/provider, webhook, receipt, reconciliation, and ledger foundations; coherent API lifecycle; sandbox path | Account eligibility; supported merchant/payee structure; Connect account model; delayed outcomes; verification fallback; returns/disputes; settlement routing; reserves and negative balances; pricing and limits | Preferred first feasibility track; not selected |
| Canadian PAD/EFT provider category, with VoPay or Rotessa as diligence candidates | Provider-managed PAD agreement/token and API-driven debit/schedule; provider-specific payee and settlement model | Canadian specialization may offer onboarding, PAD operations, reporting, or support better aligned to the use case | API and webhook maturity; authorization evidence; idempotency; role model; custody/funds flow; settlement; returns; security; reconciliation; portability; commercial minimums | Required comparison; candidate(s) to be qualified |
| Manual/offline fallback | Existing operator-approved rent collection outside RentChain; RentChain records workflow status/evidence without initiating a debit | Preserves a safe operational fallback and parallel run; avoids forcing an unapproved integration | Manual work, delayed evidence, reconciliation errors, duplicate scheduling, unclear source of truth, weak scalability | Pilot contingency only; not the target automated model |

Candidate names are prompts for diligence, not endorsements or capability claims.

For every option, the evidence pack must explicitly cover mandate/authorization support, bank verification, Canadian ACSS/PAD fit, webhooks/events, platform/Connect capability, landlord onboarding, settlement clarity, reconciliation, tenant experience, developer experience, compliance burden, support burden, beta feasibility, enterprise scalability, and unknowns. A missing answer remains `unknown` and cannot be inferred from a generic product page.

## Weighted evaluation

Score each criterion 0–5 using linked evidence. A score without evidence is `unknown`, not zero. Mandatory failures cannot be offset by a high weighted total.

| Criterion | Weight | Mandatory? | Evidence required |
| --- | ---: | --- | --- |
| Legal/regulatory role clarity | 15 | Yes | Provider role/funds-flow response plus counsel analysis |
| No-custody settlement model | 10 | Yes | Diagram and contract terms showing funds movement |
| Payee and landlord/manager onboarding fit | 10 | Yes | Confirmed account/onboarding model |
| Authorization and mandate evidence | 10 | Yes | API flow, retained evidence, notice/cancellation support |
| Debit lifecycle, returns, and disputes | 10 | Yes | State/event documentation and sandbox cases |
| Idempotency, webhooks, and retry safety | 10 | Yes | API guarantees and replay/out-of-order tests |
| Reconciliation and audit evidence | 10 | Yes | Reports/API/export samples and trace test |
| Security, privacy, and data residency | 10 | Yes | Security package, DPA, subprocessor/data-flow review |
| Existing foundation reuse and delivery effort | 5 | No | Engineering estimate and architecture review |
| Commercial model and 3,000-unit economics | 5 | No | Written pricing, limits, fees, reserves, support costs |
| Reliability, support, and incident response | 5 | No | SLA/status history/support escalation terms |
| **Total** | **100** |  |  |

The commercial comparison must show the $30/unit/year enterprise reference ($90,000/year at 3,000 units) alongside provider fees, returns, implementation, paid onboarding, support, reconciliation, and risk costs. PAD is expected to support enterprise positioning more directly than public small-landlord tiers, and it must not be assumed to fit a cheap flat tier.

## Provider diligence questions

1. Who is merchant, payee, payment service provider, settlement recipient, and party liable for returns, disputes, fees, reserves, and negative balances?
2. Can property owners/managers be onboarded without RentChain taking custody, and which provider account model applies?
3. What authorization evidence is created, retained, retrievable, and exportable? Who sends confirmation and pre-notification?
4. How are variable amounts, timing changes, cancellation, revocation, refunds, returns, and disputes represented?
5. Which outcomes are synchronous versus delayed? What are the settlement and return windows?
6. What idempotency, webhook signing, event ordering, replay, retry, and status-retrieval guarantees exist?
7. What sandbox scenarios and production certification are available?
8. What Canadian eligibility, transaction limits, reserves, underwriting, prohibited-business, and volume requirements apply?
9. Where is data processed, which subprocessors are used, and what deletion/export/security commitments apply?
10. What pricing, minimums, onboarding lead time, SLA, escalation, and termination/portability terms apply?

## Decision process

1. Product and engineering document the common use case and required lifecycle without provider-specific assumptions.
2. Finance and operations document payee, settlement, reconciliation, return, and support needs.
3. Providers answer the same diligence pack and demonstrate sandbox flows.
4. Security/privacy review vendor evidence and data flows.
5. Counsel reviews the actual proposed roles, contracts, and funds flow, including Payments Canada rules and RPAA/FINTRAC applicability.
6. The team scores evidence, records mandatory failures, and runs total-cost/sensitivity analysis.
7. Approvers record `SELECT`, `CONDITIONAL`, or `REJECT`, plus assumptions, conditions, expiry, and fallback.

No provider selection authorizes implementation or live debits. Those require a separately approved implementation mission and all Phase 0 gates.
