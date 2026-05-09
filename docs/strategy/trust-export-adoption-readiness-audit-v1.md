# Trust Export Adoption Readiness Audit v1

Branch: `strategy/trust-export-adoption-readiness-audit-v1`
Scope: documentation-only adoption readiness audit, no live trust export adoption

## Executive Summary

RentChain is not ready to wire institutional trust exports into live external sharing yet.

The platform is technically ready to compose policy-gated institutional trust export packages, but live adoption still needs consent UX, revocation UX, recipient-purpose binding, post-export lifecycle rules, and clearer institution-facing semantics.

Safest next mission:

`feat/tenant-controlled-trust-export-v1`

Condition: this should proceed only after the first slice includes consent/revocation UX groundwork inside the same mission or as a prerequisite sub-scope. The first live surface should be tenant-controlled, non-public, metadata-only, policy-gated, time-bound, and tenant-reviewable before any recipient receives it.

RentChain should not proceed next with lender, insurer, subsidy, government, institution API, landlord-controlled, public URL, or automated workflow adoption.

## Audit Scope Completed

Reviewed strategy and architecture:

- `docs/architecture/institutional-trust-export-framework-v1.md`
- `docs/architecture/portable-attestation-framework-v1.md`
- `docs/architecture/institution-export-layer-v1.md`
- `docs/architecture/institutional-sharing-room-v1.md`
- `docs/architecture/institutional-identity-assurance-framework-v1.md`
- `docs/strategy/portable-attestation-readiness-audit-v1.md`
- `docs/strategy/future-rwa-execution-readiness-audit-v1.md`

Reviewed implementation surfaces:

- `rentchain-api/src/lib/institutionTrustExports/*`
- `rentchain-api/src/lib/portableAttestations/*`
- `rentchain-api/src/lib/institutionExports/*`
- `rentchain-api/src/lib/governance/platformGovernance.ts`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/services/identityPortability/*`
- `rentchain-api/src/services/institutional/deriveInstitutionalIdentityPackage.ts`
- tenant workspace share controls
- public tenant share package page
- institutional export preview page
- institutional sharing room architecture

## Current Readiness Findings

The newest trust export foundation provides:

- package-level institutional trust export composition
- audience and purpose mapping
- policy-gated portable attestation export summaries
- export minimization redactions
- provenance and audit metadata
- explicit non-public and external-submission-disabled flags
- optional attachment to institution export previews only when portable attestations are explicitly supplied

The current adoption gap is not the backend composer. The gap is controlled live usage:

- no claim-level consent UX
- no tenant-facing export preview UX
- no export recipient confirmation UX
- no revocation receipt UX
- no post-export invalidation or notification model
- no recipient-specific semantics guide
- no durable export ledger for tenant-visible history
- no institution package signing or delivery channel
- no policy for trust metadata changes after export

## Adoption Surface Ranking

| Surface | Rank | Readiness | Rationale |
| --- | --- | --- | --- |
| Tenant-controlled trust export preparation | Safest | Medium | Tenant share packages already have user control, expiry, revocation, and approval patterns. First adoption can keep the export tenant-visible and non-public. |
| Tenant-controlled downloadable trust summary | Safest with constraints | Medium-low | Safe only if generated for tenant review first, metadata-only, watermarked/non-authority, time-bound, and revocable in state even if the downloaded file cannot be pulled back. |
| Internal review exports | Moderate | Medium | Useful for operator review, but internal review must not become a portability loophole or expose support metadata. |
| Existing institution export bundles | Moderate | Medium-low | The package composer can attach trust export summaries, but live routes do not yet load attestations. Adoption needs explicit consent and recipient binding. |
| Landlord-controlled trust exports | High risk | Low | Landlord/property trust metadata may be appropriate later, but tenant-related identity, payment, lease, and application metadata must not be landlord-controlled without tenant consent. |
| Insurer onboarding exports | High risk | Low | Insurer use cases are plausible, but require recipient purpose, consent receipts, and strong identity/property semantics. |
| Lender onboarding exports | High risk | Low | Lender workflows can be read as creditworthiness or underwriting. Requires additional compliance and semantics review. |
| Subsidy/government exports | Unsafe today | Low | Requires stronger identity assurance, eligibility semantics, government-program consent, and legal/privacy review. |
| Institution-facing APIs | Unsafe today | Low | APIs need recipient authentication, contracts, revocation notification, rate limits, audit logs, schema governance, and data processing terms. |
| Public trust profiles or public export URLs | Prohibited | Not ready | Conflicts with non-public, consent-scoped trust orchestration. |
| Support/admin-only exports | Prohibited as portable exports | Not ready | Support metadata must remain internal and cannot become an external trust payload. |

## First Live Surface Recommendation

The first live trust-export surface should be tenant-controlled trust export preparation.

Required shape:

- tenant initiates or approves the export
- export is non-public
- export uses claim-level consent
- export is audience-scoped
- export is purpose-scoped
- export is policy-gated by `buildPolicySafeExportSummary`
- export is metadata-only
- export is tenant-previewable before sharing
- export has an expiration timestamp
- export can be revoked in RentChain state
- export carries non-authority disclaimers
- export creates a tenant-visible audit history entry

This should not initially send data to an institution. It should prepare or generate a trust export package for tenant review and optional manual sharing.

## Tenant-Controlled Export Requirements

Tenant-controlled exports must include:

- a clear recipient category, such as insurer, lender, government program, auditor, landlord, or tenant portability
- an explicit purpose, such as insurance review or lender review
- claim categories requested and claim categories approved
- consent text summary and consent version
- consent granted timestamp
- consent expiration timestamp
- revocation control
- policy decision status per attestation
- plain-language blocked reasons safe for tenants
- warnings for expired or reverification-required trust metadata
- export preview before generation
- export history visible to the tenant

The tenant must be able to see what is excluded:

- raw provider payloads
- raw government IDs
- raw screening reports
- raw registry/title payloads
- support/internal notes
- internal policy reasons
- payment account details
- private documents not explicitly selected

## Landlord-Controlled Export Requirements

Landlord-controlled exports should be delayed.

They may be appropriate later for:

- landlord account trust metadata
- business legitimacy metadata
- property authority metadata
- registry linkage metadata
- operator authority metadata
- non-tenant property readiness summaries

They should not control:

- tenant identity assurance metadata
- tenant payment readiness metadata
- tenant lease participation attestations
- tenant documents
- tenant application reuse summaries
- screening-derived tenant trust summaries

Any landlord-controlled adoption must still include audience, purpose, expiry, revocation, non-authority disclaimers, and proof that no tenant-controlled metadata is included without tenant consent.

## Consent UX Requirements

The consent UX must answer:

- who is sharing
- who may receive the export
- why the export is being created
- which claims are included
- which claims are blocked or unavailable
- when the export expires
- how revocation works
- what revocation cannot technically undo if a file was already downloaded
- what RentChain is and is not claiming

Consent should be claim-level, not just package-level.

A consent record should bind:

- subject id and subject type
- actor id
- audience
- purpose
- approved claim categories
- approved attribute scopes
- export id
- attestation ids and versions
- issued timestamp
- expiration timestamp
- revocation timestamp when applicable
- consent text version
- audit event reference

## Revocation, Expiration, And Reverification Requirements

Trust export adoption must treat lifecycle as first-class.

Required behavior:

- expired attestations are not exportable
- revoked attestations are not exportable
- superseded attestations are not exportable
- reverification-required attestations are not exportable
- revoked export packages are no longer available in RentChain-controlled surfaces
- expired export packages are no longer available in RentChain-controlled surfaces
- tenant history should still show that an export existed and was revoked or expired
- future exports must regenerate from current attestations rather than reuse old summaries

When trust metadata changes after export:

- new exports should reflect the current trust state
- previous export history should remain audit-visible
- if the export is still RentChain-hosted, it should show expired, revoked, or superseded status
- if a file was downloaded externally, the UI must explain that revocation affects RentChain access and future reliance, not physical copies already shared

## Institution-Facing Semantics

Safe semantics:

- "metadata present"
- "policy-gated"
- "consent-scoped"
- "evidence category"
- "issuer category"
- "not a legal ownership conclusion"
- "not a credit decision"
- "not a subsidy eligibility decision"
- "not identity proof by RentChain"
- "requires manual review"

Unsafe semantics:

- "approved"
- "creditworthy"
- "insurable"
- "subsidy eligible"
- "government verified"
- "owner verified"
- "identity proven by RentChain"
- "KYC approved"
- "automated decision ready"
- "source of truth"
- "reputation score"

The first adoption should avoid broad "verified" badges and prefer precise status labels such as:

- "Identity assurance metadata available"
- "Property authority metadata available"
- "Consent required before export"
- "Reverification required before export"
- "Expired; not exportable"
- "Revoked; not exportable"

## Metadata That Must Never Leave Internal Governance

The following must remain internal-only:

- support-console notes and diagnostics
- raw provider payloads
- raw identity documents
- biometric or liveness artifacts
- SIN/SSN equivalents and document numbers
- raw screening or credit bureau data
- raw banking, card, routing, payout, or open-banking payloads
- raw title, registry, business, beneficial ownership, or KYB payloads
- private messages
- internal fraud or policy rules
- internal policy evaluator traces
- telemetry and observability diagnostics
- token hashes
- public-link implementation details
- internal collection ids and route destinations
- AI reasoning traces or operator notes

Internal metadata may inform a portable attestation, but only the minimized policy-approved summary may be exported.

## Governance And Privacy Findings

Current strengths:

- portable attestations are metadata-only
- policy gate is deny-by-default
- institutional trust export packages are non-public and external-submission disabled
- existing share packages have expiry and revocation
- governance helpers classify sensitivity and redact identifiers
- institution export previews are manual-only
- sharing rooms are view-only and non-downloadable

Current gaps:

- no export-specific consent receipt model
- no tenant-facing claim preview model
- no export revocation/invalidation UX
- no durable tenant-visible trust export ledger
- no recipient authentication model
- no institution-specific schema variants
- no signed/tamper-evident packet
- no recipient notification after revocation
- no policy for downloaded files after revocation
- no public copy semantics defining safe trust language

## Institution-Readiness Findings

Insurers and lenders are plausible future audiences, but not first live integrations.

Before external institution workflows:

- recipient organizations must be identified and authorized
- institution purpose must be explicit
- recipient data-use expectations must be recorded
- institution-specific schemas must be reviewed
- consent receipts must be retained
- revocation/expiration behavior must be visible
- unsupported decision semantics must be blocked
- packet signing or integrity checks should be considered

Subsidy and government workflows require stronger identity, eligibility, legal, and privacy governance. They should not be first adoption targets.

## Recommended Staged Adoption Path

1. Consent/revocation UX groundwork

   Define tenant-facing consent receipts, export history, expiration, revocation, and post-download limitations.

2. `feat/tenant-controlled-trust-export-v1`

   Add tenant-controlled, non-public, policy-gated trust export preparation. Keep it manual and metadata-only. Do not integrate institutions.

3. Institution-safe export package adoption

   Attach trust export packages to institution export previews only after claim-level consent and tenant/landlord authority boundaries are proven.

4. Insurer or lender pilot readiness

   Pick one low-risk recipient class after legal/privacy review. Keep manual review and no API submission.

5. Government/subsidy readiness

   Defer until identity assurance, eligibility attestations, consent receipts, and legal/program governance mature.

## Recommended Next Mission

Recommended next mission:

`feat/tenant-controlled-trust-export-v1`

Required constraints:

- tenant-controlled first
- consent/revocation UX included
- no public trust profile
- no institution API
- no automated decisioning
- no blockchain/tokenization
- no raw provider payloads
- no support/internal metadata
- no landlord-controlled tenant metadata export

If product wants a smaller prerequisite first, use:

`feat/trust-export-consent-revocation-ux-v1`

This would be Option C from the mission prompt: additional consent/revocation UX groundwork first. It is safer if the next implementation team wants to split UX and export preparation.

## Readiness Answer

RentChain is approaching readiness for live trust-export adoption, but only for a narrow tenant-controlled first surface.

RentChain is not ready for:

- insurer APIs
- lender APIs
- subsidy/government exports
- public trust pages
- landlord-controlled tenant trust exports
- automated institutional decisions
- downloadable public reputation-style credentials

The correct strategic posture remains governed, consent-scoped portable institutional trust orchestration.

## Remaining Risks

- Existing public share package language may still be overread as institution-grade verification.
- Downloaded files cannot be technically revoked after leaving RentChain-controlled storage.
- Future integrations may try to reuse internal review exports as portable exports.
- Institution-specific schemas and legal semantics remain undefined.
- Consent receipts are not yet a first-class trust export artifact.
- Tenant-controlled exports will still need careful UX to prevent accidental over-sharing.
