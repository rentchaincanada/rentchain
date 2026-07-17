# PAD Counsel Go/No-Go Request v1

Status: request for qualified Canadian legal advice; not legal advice or launch authorization

## RentChain context

RentChain is a Canadian proptech/SaaS platform for landlords/property managers and tenants, with lease-linked workflow, payment evidence, maintenance, portal, and export foundations. PAD is planned and not implemented. RentChain prefers a processor-led model and does not intend to hold tenant or landlord funds directly.

The proposed beta would be paid, limited to a staged property group, and run for 60–90 days beside Yardi or another existing PMS. No full migration is required. Provider feasibility and all legal conclusions remain open.

## Proposed flow for review

1. A landlord enables PAD for an eligible lease/property.
2. A tenant receives counsel-approved, versioned authorization language.
3. The tenant completes provider-managed bank verification and authorization.
4. The provider stores sensitive payment information and returns mandate/payment references.
5. RentChain stores approved opaque references, status, agreement metadata, and evidence only.
6. RentChain creates versioned lease-linked rent obligations.
7. One approved off-session debit request is sent per obligation under the mandate.
8. Signed provider events and reconciliation update lifecycle status.
9. Tenant and landlord receive approved notices, status, receipts, failure/return, cancellation, and support information.
10. Append-safe evidence covers authorization, notice, debit, return, dispute, reconciliation, and decisions.

## Documents to provide counsel

- PAD technical design, lifecycle, data model, compliance/risk gates, beta plan, and Phase 0 package.
- This external-validation package and completed provider feasibility response.
- Participant/responsibility and end-to-end funds-flow diagrams.
- Proposed mandate model and provider authorization artifacts.
- Draft tenant authorization, confirmation, notice, cancellation, failure/return, complaint, and privacy copy, if available.
- Landlord pilot agreement concept, commercial structure, cohort, province, and responsibility matrix.
- Privacy/data inventory, processing, retention, deletion, access, and incident plan.
- Support, reconciliation, complaint, dispute, and payment-incident playbooks.

## Questions for counsel

1. Which PAD agreement class and authorization terms apply to the proposed rent flow?
2. How should fixed, variable, interval, sporadic/combined, rent-change, adjustment, and timing scenarios be treated?
3. What confirmation, pre-notification, change-notice, delivery-evidence, and waiver requirements apply?
4. What cancellation/revocation rights, methods, effective cutoffs, and already-submitted-debit treatment apply?
5. What tenant dispute, reimbursement, unauthorized-debit, refund, and complaint processes are required?
6. What NSF/returned-payment, fee, retry, rent-obligation, and communication terms are permitted?
7. What responsibilities must the landlord/payee accept for authority, tenant data, amounts, notices, settlement, returns, disputes, and support?
8. What responsibilities and liability should remain with RentChain and with the processor/provider?
9. Which Terms of Use, privacy policy, PAD agreement, landlord agreement, pilot agreement, and support-term changes are required before external or live use?
10. What authorization, notice, provider, payment, reconciliation, support, audit, and legal-hold records must be retained, by whom, where, and for how long?
11. Does RentChain perform one or more payment functions within RPAA scope under the actual model? Analyze incidental activity, agent/mandatary, third-party service provider, registration, operational-risk, incident, and safeguarding implications.
12. Does the final activity/funds flow create FINTRAC/MSB registration, compliance, reporting, recordkeeping, or related exposure?
13. Does avoiding funds custody change—but not necessarily eliminate—RPAA, FINTRAC, contractual, privacy, or operational duties?
14. Which cyber, technology E&O, crime/funds-transfer, regulatory, payment/dispute, or other insurance coverage and limits are appropriate?
15. Is a separate payment entity required or advisable now or after a defined activity, jurisdiction, volume, or risk threshold?
16. Are electronic authorization/signature, language, accessibility, consumer-protection, tenancy, payment-method-choice, fee, receipt, or provincial requirements triggered?
17. Are the proposed pilot terms, pricing validation, data exchange, parallel run, rollback, support, indemnity, limitation, and risk allocation appropriate?
18. What exact conditions constitute legal `GO`, `GO WITH CONDITIONS`, or `NO-GO` for beta implementation and separately for a first live debit?

## Requested counsel deliverables

- PAD authorization template and agreement/evidence requirements.
- Approved or recommended confirmation, notice, cancellation, change, NSF/return, dispute, complaint, and support language.
- Terms/privacy and landlord/pilot agreement change recommendations.
- Short written RPAA and FINTRAC/MSB scope memo with assumptions and re-review triggers.
- Recommended participant, payee, no-custody funds-flow, responsibility, and risk-allocation structure.
- Insurance and separate-entity recommendations.
- A gate table labeling each issue `APPROVED`, `APPROVED WITH CONDITIONS`, `BLOCKED`, or `OUT OF SCOPE`.
- Go/no-go recommendation for beta implementation and distinct conditions for any live debit.

Counsel approval must expire if provider, roles, funds flow, jurisdiction, authorization model, settlement, liability, data processing, or customer language materially changes.

## Email-ready request

**Subject:** Go/no-go legal review — Canadian PAD beta preparation

Hello [Counsel name],

RentChain is preparing external validation for a possible provider-processed Canadian PAD beta. PAD is planned, not implemented, and no live debit is authorized. Our preferred model uses provider-managed verification and authorization, opaque provider references, and direct settlement to the approved payee; RentChain does not intend to hold funds.

Please review the attached provider response, proposed flow, funds-flow and responsibility diagrams, draft customer language, data plan, and pilot concept. We request written conclusions on PAD rules, authorization/notice/cancellation/returns, agreements, privacy, retention, RPAA, FINTRAC/MSB, insurance, entity structure, and risk allocation, plus an explicit go/no-go recommendation.

We will not treat sandbox success as legal approval or begin live debit testing without approved authorization language and all required gates.

Regards,

[Executive/legal owner]

## Current official references for counsel

- Payments Canada Rule H1: <https://www.payments.ca/sites/default/files/h1eng.pdf>
- Bank of Canada RPAA supervisory framework: <https://www.bankofcanada.ca/regulatory-oversight/retail-payments/supervisory-framework/>
- Bank of Canada registration criteria: <https://www.bankofcanada.ca/2026/06/criteria-for-registering-payment-service-providers/>

These links do not replace counsel's current-source review or legal analysis of RentChain's actual activities.
