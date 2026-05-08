# Verified Account Foundations v1

Status: implemented foundation
Branch: `feat/verified-account-foundations-v1`
Scope: additive trust-state infrastructure, no provider integration, no raw identity custody

## Verification and Trust Audit Summary

RentChain had useful identity and onboarding readiness signals before this mission, but they were fragmented across tenant identity projections, landlord activation, application phone verification, screening status, payment readiness, property registry projections, identity portability, share packages, and identity layer lineage views.

The audit found that existing "verified" language often means an operational reference is available, not that RentChain has provider-grade identity assurance. This is acceptable for current workflow support, but unsafe for future institutional or execution systems unless trust states become explicit and scoped.

## Current Verification Flows

- Landlord onboarding tracks operational activation steps: property, unit, applicant, viewing, screening, and decision readiness.
- Tenant onboarding derives identity readiness from profile completeness, application reuse, document availability, screening status, and lease evidence.
- Application phone verification uses OTP metadata on application records.
- Email verification exists in auth and invite flows, but was not normalized into a reusable account trust projection.
- Screening completion is a workflow signal, not a government identity assertion.
- Payment readiness intentionally does not enable processor connection, stored payment methods, money movement, or custody.
- Property registry projections can support public registry lineage, but do not prove ownership or operator authority.

## Self-Asserted vs Verified Data Map

| Data or signal | Current assurance |
| --- | --- |
| Tenant profile fields, application data, income, employment, references | Self-asserted |
| Uploaded document presence or checklist completion | Self-asserted or platform-observed presence |
| Landlord-entered property, unit, lease, rent, and tenant details | Self-asserted until corroborated |
| Application reuse, lease participation, identity timeline, share-package state | Platform-correlated |
| Phone OTP success | Contact-channel verified |
| Email verification | Account/contact-channel verified |
| Screening completion | Workflow/provider-adjacent, not government ID assurance |
| Public registry projection | Provider/public-source attested for scoped property registry lineage |
| Business, government identity, ownership/operator authority | Not implemented |

## Trust-State Model

The foundation introduces a conservative trust-state model:

- `asserted`: self-entered or incomplete account context.
- `authenticated`: verified account access or contact-channel signal.
- `platform_correlated`: authenticated account plus aligned RentChain operational records.
- `provider_attested`: scoped provider, registry, or future identity-provider metadata exists.
- `institution_reviewed`: operator or institution review metadata is present.

V1 deliberately does not introduce execution eligibility. All derived trust states remain manual-review-first and metadata-only.

## Verification Signal Model

Verification signals now carry:

- subject type and subject id
- signal type
- lifecycle status
- source
- evidence type
- confidence
- provider key
- evidence reference
- issued, verified, expiry, and revocation timestamps
- privacy flags proving metadata-only handling

The model is provider-ready for future identity, business, property, screening, payment, insurer, lender, or government attestations without integrating any provider in this mission.

## Governance and Privacy Boundaries

The trust-state foundation preserves these hard boundaries:

- raw government identity documents are excluded
- raw screening provider payloads are excluded
- banking and payment account details are excluded
- biometric payloads are not represented
- provider integrations are disabled
- execution eligibility is false
- external sharing still requires explicit consent
- manual review remains required

## Adoption

Initial adoption is intentionally narrow:

- Identity layer profiles now include `trustState`.
- Identity layer trust state is derived from existing metadata-only references.
- The frontend identity layer shows a conservative account trust state panel.

This avoids changing onboarding flows, export APIs, screening providers, auth core, legal documents, or payment behavior.

## Regression Risks

- Future work could still read old "verified" labels too strongly if it bypasses `trustState`.
- Provider-grade identity assurance is not implemented yet.
- Business verification and property ownership/operator authority remain future work.
- Public share packages should not expose new trust metadata without a separate consent and scope review.

## Recommended Next Path

Future missions should build on this layer with provider-attestation storage and explicit consent scopes before any institutional records or permissioned execution work.
