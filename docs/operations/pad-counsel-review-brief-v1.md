# PAD Counsel Review Brief v1

## Request

RentChain requests Canadian payments counsel's written advice on a proposed, bounded PAD beta. The immediate goal is feasibility and approved language—not launch approval by implication. PAD is not currently implemented, no live debit is authorized, and no public capability promise should be made.

## Business context

RentChain is rental workflow, evidence, and property intelligence infrastructure. For an enterprise customer, it should enter beside the customer's PMS/Yardi rather than claim to replace it. The proposed 60–90 day paid pilot would use staged properties and a parallel run. The commercial reference is $30 per unit per year, or $90,000 per year for 3,000 units; this is planning context, not public pricing or a commitment to bundle PAD in a cheap flat tier.

## Proposed model for review

- A tenant authorizes bank debits through a provider-managed authorization and bank-verification flow.
- The provider stores sensitive payment credentials and returns a token/reference and mandate evidence.
- RentChain records authorization status and evidence references, but does not hold tenant or landlord funds.
- For each specifically approved rent obligation, RentChain would create an off-session provider debit request using the saved payment method.
- The provider processes the debit and routes settlement to the approved payee/recipient under the selected provider account model.
- Signed provider events update an auditable lifecycle, reconciliation, and role-appropriate views.
- Stripe ACSS is the preferred first feasibility track; provider selection and the exact account/funds-flow model remain open.

The following Phase 0 decisions are intentionally unresolved: payee of record; landlord/property-manager onboarding; settlement routing; responsibility for notices and authorization records; returns, disputes, refunds, fees, reserves, and negative balances; and allocation of regulatory and operational liability.

Legacy PAP route, service, and scheduler files are unmounted, unauthenticated prototypes. They are not production PAD and will not be used as the legal or technical basis for the beta.

## Advice requested

Please provide written conclusions, assumptions, required changes, and blockers for:

1. The legal characterization and responsibilities of RentChain, the payment provider, tenant, property owner/manager, payee, and settlement recipient.
2. Applicability of the Retail Payment Activities Act and Bank of Canada registration/operational-risk/safeguarding requirements. Please assess the actual activities and do not assume that avoiding custody alone resolves scope.
3. Applicability of FINTRAC requirements and whether the proposed parties or activities create money-services-business or related obligations.
4. Applicable Payments Canada PAD rules, including the appropriate PAD category and requirements for authorization, confirmation, pre-notification, waiver/variation, cancellation/revocation, disputes/reimbursement, and evidence retention.
5. Whether electronic/provider-managed authorization and the proposed evidence record are sufficient, and which party must produce evidence on demand.
6. Required tenant-facing language for variable rent amounts, debit timing, changes, failed/returned debits, fees, cancellation, complaints, refunds, and support.
7. Required property-owner/property-manager/payee agreements, representations, allocation of return/dispute liability, reserves/negative balances, and authorization to initiate debits.
8. Privacy and consent implications, including bank/payment data, provider/subprocessor disclosures, cross-border processing, retention, deletion, access, and incident notice.
9. Consumer-protection, accessibility, language, electronic-commerce/signature, record-keeping, and provincial considerations for the initial pilot jurisdictions.
10. Restrictions on product claims, pilot communications, pricing language, or use of terms such as PAD, automated rent, guaranteed, settled, or compliant.
11. The minimum legal gates and documentary evidence required before the first live debit.
12. Insurance implications, including appropriate coverage, exclusions, limits, notices, and risk allocation.
13. Whether a separate payment entity is required or advisable now or after a defined activity/scale threshold.

## Materials counsel should receive

- PAD technical design, data model, lifecycle, compliance gates, beta plan, and this Phase 0 package.
- Participant/authority diagram and end-to-end funds-flow diagram for each provider option.
- Provider terms, account/onboarding model, authorization/mandate artifacts, data-processing terms, and return/dispute rules.
- Draft tenant authorization, confirmation, notice, cancellation, support, and complaint language.
- Draft landlord/property-manager/payee agreement changes.
- Requested deliverables: PAD authorization template; terms/privacy change language; cancellation/notice and NSF/return language; RPAA/FINTRAC/MSB memo; recommended funds flow; risk allocation; insurance/entity advice; and pilot agreement terms.
- Data inventory, retention schedule, privacy/security review, and incident process.
- Pilot charter, provinces, property/tenant cohort, operating model, and support/escalation plan.

## Required form of response

For each issue, counsel should label the result `APPROVED`, `APPROVED WITH CONDITIONS`, `BLOCKED`, or `OUT OF SCOPE`; state assumptions; cite the governing source where useful; identify the accountable party; provide required language/actions; and state whether it blocks sandbox work, production implementation, enrollment, or the first live debit.

Counsel approval expires if the provider, participant roles, funds flow, jurisdictions, authorization method, settlement routing, liability allocation, or customer-facing language materially changes.

## Draft email request

**Subject:** Counsel review request — RentChain Canadian PAD Phase 0 feasibility

Hello [Counsel name],

RentChain is evaluating a bounded 60–90 day paid pilot for provider-processed Canadian pre-authorized rent debits. PAD is not implemented today, and we are not requesting permission to launch based only on a sandbox test.

Our proposed direction is provider-managed bank verification and authorization, a saved provider payment-method reference, and one off-session debit request per specifically approved rent obligation. The provider would process and settle the debit to the approved payee; RentChain would not hold funds. Stripe ACSS is our preferred first feasibility track, but neither the provider nor the account/funds-flow model has been selected.

Please review the attached brief and designs and advise on participant roles, Payments Canada PAD rules, RPAA/Bank of Canada and FINTRAC applicability, authorization/notice/cancellation language, evidence retention, agreements, privacy, consumer protection, and liability for settlement, returns, disputes, fees, reserves, and negative balances.

We need a written gate decision and approved tenant/customer language before any live debit. Please identify assumptions, blockers, conditions, required documents, and any facts you need from us or a provider.

Regards,

[Executive sponsor / legal owner]
