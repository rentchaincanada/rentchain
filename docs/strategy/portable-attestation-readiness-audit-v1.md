# Portable Attestation Readiness Audit v1

Branch: `strategy/portable-attestation-readiness-audit-v1`
Scope: documentation-only readiness audit, no portable-attestation implementation

## Executive Summary

RentChain is approaching readiness for a portable attestation framework, but it is not ready to expose portable institutional trust metadata yet.

The platform now has meaningful foundations:

- account trust summaries with metadata-only verification signals
- institutional identity assurance metadata
- business and property authority metadata
- identity-layer profiles with consent, lineage, redaction, and trust summaries
- tenant share packages with tenant-controlled scopes, expiry, revocation, and verification requests
- institutional export previews with redactions and manual-only behavior
- institutional sharing rooms with view-only, non-public, non-downloadable controls
- governance utilities for sensitivity, retention, telemetry sanitization, and identifier redaction
- legal document metadata with export governance classification

The gap is that these systems still describe internal readiness and controlled review state. They do not yet define a portable attestation contract that can safely leave RentChain under explicit consent, institution purpose, expiration, revocation, and strict data minimization.

Recommended next mission:

`feat/portable-attestation-framework-v1`

RentChain is ready for that framework only if the first implementation remains schema-first and metadata-only, keeps support/internal metadata separate from portable payloads, requires consent references for every portable claim, and blocks unsupported public reputation or source-of-truth semantics.

## Audit Scope Completed

Reviewed current strategy and architecture documentation:

- `docs/architecture/institutional-identity-assurance-framework-v1.md`
- `docs/architecture/business-and-property-verification-foundations-v1.md`
- `docs/architecture/identity-layer-v1.md`
- `docs/architecture/institution-export-layer-v1.md`
- `docs/architecture/institutional-sharing-room-v1.md`
- `docs/strategy/future-rwa-execution-readiness-audit-v1.md`
- `docs/strategy/institutional-identity-readiness-audit-v1.md`

Reviewed implementation surfaces:

- `rentchain-api/src/lib/accountTrust/*`
- `rentchain-api/src/lib/identityAssurance/*`
- `rentchain-api/src/lib/propertyTrust/*`
- `rentchain-api/src/lib/identityLayer/*`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/services/identityPortability/*`
- `rentchain-api/src/services/identityExchange/*`
- `rentchain-api/src/lib/institutionExports/*`
- `rentchain-api/src/lib/sharingRooms/*`
- `rentchain-api/src/lib/governance/platformGovernance.ts`
- `rentchain-api/src/lib/supportConsole/*`
- `rentchain-api/src/lib/legalDocuments/legalDocumentEngine.ts`
- public tenant share routes and frontend share/export/readiness surfaces

## Current Portable Trust Metadata

The following metadata is a useful foundation for future portability, assuming it is projected through a new consent-scoped portable schema rather than shared directly.

| Area | Current Metadata | Portability Value | Current Limit |
| --- | --- | --- | --- |
| Account trust | Subject type, trust level, signal summaries, active metadata-only signals, missing signals, review reasons | Can explain broad trust posture | Internal trust levels are not external claims by themselves |
| Identity assurance | Assurance level, status, lifecycle, provider category, consent scope, retention class, expiry, revocation, reverification timestamp | Strong base for provider-neutral attestations | No portable schema or recipient policy yet |
| Business/property trust | Business/property/operator authority statuses, registry linkage, relationship type, confidence, support-safe references | Base for landlord/property authority attestations | Must avoid ownership conclusions and public exposure |
| Identity layer | Identity lineage, consent references, redactions, portability status, trust summaries | Good review read model | Contains internal reference status and support-oriented redactions |
| Tenant share packages | Token hash, expiry, revocation, approved scopes, requested scopes, verification request lifecycle | Existing tenant-controlled sharing scaffold | Current payloads are summaries, not institution-grade attestations |
| Institution exports | Audience, package type, section status, redactions, aggregate payload preview | Useful future packet wrapper | Preview-only, no signed attestation payloads or external schema |
| Sharing rooms | View-only access, expiry, redaction, scope references, audit references | Governance model for institutional review | No portable claim model or download/submission policy |
| Legal documents | Document kind, version, province, sensitivity, export governance metadata | Useful for document provenance claims | Not a legal attestation or tribunal proof package by itself |
| Canonical events | Audit/event descriptors and references | Can support attestation lineage | Not all attestation events are canonicalized or recipient-safe |

## Internal-Only Metadata

The following should remain internal unless a future mission explicitly creates a redacted portable projection:

- raw verification signals and evidence refs before portability filtering
- support-console diagnostics
- support-safe summaries that include redacted provider/evidence references
- internal canonical event ids unless explicitly allowed by an audit packet schema
- review reasons intended for operators
- blocked reasons that reveal internal policy, fraud, or support logic
- telemetry and observability diagnostics
- identity-layer lineage destination paths
- institution export preview internals
- sharing-room access-control implementation details
- token hashes and public-share token mechanics
- provider keys that identify sensitive vendor workflow internals

Internal metadata can inform a portable attestation, but it should not become the portable payload.

## Metadata That Should Never Become Portable

The following should not be externally portable through RentChain:

- raw government ID scans, passport/licence images, biometric/liveness artifacts, selfie payloads
- SIN/SSN equivalents or identity document numbers
- raw provider KYC/KYB/AML responses
- screening provider payloads, credit bureau files, risk models, and adverse-action-sensitive internals
- bank account, card, routing, payment processor, open-banking, or payout credentials
- raw title documents, raw land-title payloads, beneficial ownership payloads, or registry source payloads
- private tenant documents unless a future document-specific consent workflow allows a narrow handoff
- private message contents and unrestricted support notes
- support-console debug metadata
- internal fraud rules, policy evaluator internals, automation diagnostics, or AI reasoning traces
- unsupported conclusions such as legal identity proof, legal ownership proof, creditworthiness, subsidy eligibility, or eviction/legal enforcement readiness

## Public and Share Exposure Risks

Current tenant share packages already expose summary-only sections under tenant-controlled permission scopes. They should not be treated as a portable attestation system yet.

Risks:

- Existing words such as `identityStatus`, `verification.level`, or `portabilityStatus` may be overread by recipients as provider-grade identity proof.
- Public share routes allow external requesters to ask for more sections; this is acceptable for current summaries but not enough for institutional attestations.
- Tenant share packages do not yet bind every claim to a consent object, purpose, recipient, issuer, expiry, revocation, evidence reference, and allowed use.
- Identity exchange references describe readiness, not attested truth.
- Share URLs are controlled by token/expiry/revocation, but portable attestations need claim-level expiry and revocation as well.

Portable attestations should not be added to current share payloads until there is a dedicated projection and policy gate.

## Consent Governance Gaps

Existing systems contain partial consent and share lifecycle patterns:

- identity assurance and property trust models include consent scope metadata
- tenant share packages include approved/requested scopes and revocation
- identity-layer profiles count consent references
- sharing rooms enforce manual review and expiry

Missing for portable attestations:

- a reusable consent artifact linking subject, issuer, recipient, purpose, claim scopes, expiry, revocation, and audit event
- recipient-specific consent such as insurer, lender, government, auditor, landlord, or future institution
- claim-level consent rather than package-level permission only
- consent versioning and renewal
- explicit withdrawal behavior for already-issued portable packets
- consent receipts suitable for institutional audit
- tenant-controlled visibility into exactly which attestations are shareable
- landlord/business/property authority consent paths separate from tenant consent paths

Required principle:

No portable attestation should be generated without an active consent reference, a permitted purpose, an expiration timestamp, and a revocation path.

## Revocation and Reverification Gaps

Current trust layers model expiration, revocation, and reverification metadata, but the behavior is not yet portable.

Missing:

- claim-level expiration semantics for externally shared attestations
- recipient notification or invalidation behavior after revocation
- a portable attestation status vocabulary such as active, expired, revoked, superseded, retracted, or recipient_limited
- downgrade behavior when an underlying identity/business/property attestation expires
- evidence freshness policy by claim type
- institution-triggered reverification rules
- subject-triggered reverification rules after name, address, lease, business, property, operator, or registry changes
- audit trail connecting an exported portable claim back to the internal attestation version that produced it

Expiration should be claim-specific:

- account-control/contact signals: short to medium freshness window
- identity assurance: provider or policy driven
- business/property authority: shorter window when registry/authority context can change
- lease/payment/readiness summaries: tied to lease/payment period freshness
- documents/legal metadata: tied to document version and signature/export lineage

## Institution-Readability Gaps

Institutions will expect more structure than current summaries provide.

Likely required fields:

- attestation id
- issuer type and issuer key
- subject type and subject reference
- claim type
- claim status
- assurance level
- confidence level where appropriate
- evidence category, not raw evidence
- consent reference
- recipient type and permitted purpose
- issued, effective, expires, revoked, and superseded timestamps
- jurisdiction and province where relevant
- retention class
- redaction profile
- audit event reference
- disclaimers and non-authority flags

Current gaps:

- no portable claim taxonomy
- no institution-specific schema variants
- no signed or tamper-evident export packet format
- no external recipient policy matrix
- no rule mapping subject type plus institution type to allowed claims
- no public/private claim separation
- no final portable redaction profile

## Recommended Portability Boundaries

Future portable attestations should be metadata-first projections, not direct database records.

Safe to consider portable after explicit consent and schema filtering:

- attestation type and claim category
- high-level status such as completed, expired, revoked, or review_required
- assurance or confidence level with careful definitions
- provider category, not raw provider payload
- issuer category, such as RentChain, provider, institution review, registry linkage, or operator review
- issued/completed/expires/revoked/reverification timestamps
- subject category and scoped subject reference
- redaction and retention class
- permitted purpose and recipient type
- non-authority disclaimers

Must remain internal-only:

- support/admin diagnostics
- internal review notes and policy reasons
- raw provider or evidence references unless a specific handoff is consented and lawful
- tenant/private document contents
- route destinations, collection ids, token hashes, and operational access-control internals
- observability and telemetry details

Dangerous or unsupported claims:

- "identity proven by RentChain"
- "government ID verified" without a provider-backed identity attestation and permitted language
- "owner verified" without legally sufficient source and review policy
- "creditworthy", "insurable", "subsidy eligible", or "lender approved"
- "government verified" unless the issuer is actually a government credential provider and RentChain is only a relying party
- "execution eligible" or "automated decision ready"

Safe claim examples:

- "Tenant identity assurance metadata is present through an approved workflow."
- "Account-control signals are present."
- "Property registry linkage metadata is present; this is not an ownership conclusion."
- "Business verification metadata is present; raw KYB payloads are not included."
- "Lease summary metadata is available for manual institutional review."
- "This attestation expired on the stated date and should not be relied on."

## Tenant-Controlled Trust Metadata

Tenants should control portability for:

- tenant identity assurance summaries
- account/contact-control summaries
- application reuse/readiness summaries
- selected document summaries
- lease participation summaries
- payment readiness summaries
- rental history or ledger summaries, if future consent and accuracy policies exist
- insurer/government/lender packet preparation requests involving tenant data

Tenant controls should include:

- choose recipient type
- choose claim scopes
- approve or deny requests
- see expiration and revocation state
- revoke future access
- see what was excluded or redacted

Tenant control should not allow export of raw provider payloads, raw screening files, private support notes, or institution-only risk conclusions.

## Landlord-Controlled Trust Metadata

Landlords or authorized operators should control portability for:

- landlord account/business trust summaries
- property authority summaries
- operator authority metadata
- property registry linkage summaries
- institution export previews for portfolio, leases, occupancy, maintenance, and audit summaries
- institutional sharing room scopes

Landlord control must not override tenant consent for tenant identity, tenant documents, tenant screening, payment, or private tenant data.

## Institution-Only Visibility

Some future claims may be visible only to approved institution recipients under explicit purpose:

- lender due-diligence package status
- insurer onboarding review status
- government program packet status
- auditor review packet metadata
- institution-reviewed authority outcomes
- signed audit packet references

Institution-only visibility should still exclude raw support-console data, raw provider data, and internal policy logic.

## Scenario Readiness

| Scenario | Current Readiness | Notes |
| --- | --- | --- |
| Tenant insurance onboarding | Approaching framework readiness | Tenant share controls, identity assurance metadata, and payment/lease summaries exist, but insurer schema and consent-bound attestations are missing. |
| Landlord insurance onboarding | Low-medium | Business/property trust foundations exist, but provider-backed business authority and property/operator authority workflows are not implemented. |
| Lender verification workflows | Low-medium | Institution export previews exist, but rent-roll attestations, property authority claims, signed packets, and tenant consent policy are missing. |
| Credit bureau trust workflows | Not ready | Requires permitted-purpose, adverse-action, consent, retention, dispute, and reporting governance. RentChain should not become a credit bureau. |
| Subsidy eligibility workflows | Not ready | Requires provider-grade identity, household/eligibility attestations, government-specific schemas, and human review. |
| Government housing workflows | Not ready | Requires agency-specific consent, program eligibility, identity assurance, property eligibility, and audit packet contracts. |
| Institutional landlord onboarding | Low-medium | Business/property/operator foundations help, but business provider orchestration and institution review workflows are missing. |
| Tenant portable trust packages | Approaching framework readiness | Current share packages are a scaffold, but portable attestation schemas and claim lifecycle are missing. |
| Landlord/property authority exports | Low-medium | Property trust metadata exists, but should not leave RentChain until consent, disclaimers, and authority schema are defined. |
| Institution-grade audit exports | Medium as preview | Export and sharing room previews exist; signed or tamper-evident packets are missing. |
| AI-assisted institutional review | Not ready for decisions | AI may consume privacy-safe summaries in future, but must not score, decide, or infer unverified claims. |

## Export Schema Readiness

Current institution exports are useful wrappers but not portable attestation schemas.

Future `PortableAttestationEnvelope` should likely include:

- envelope id
- schema version
- issuer
- subject
- recipient policy
- claim set
- consent reference
- redaction profile
- expiration/revocation metadata
- audit lineage
- disclaimers
- generated timestamp

Future `PortableAttestationClaim` should likely include:

- claim id
- claim type
- claim status
- assurance/confidence
- evidence category
- source category
- effective timestamp
- expires timestamp
- revoked/superseded timestamp
- allowed recipient types
- allowed purposes
- non-authority flags

Do not include:

- raw evidence payloads
- raw provider ids by default
- support-only notes
- internal policy reasons
- public reputation scores
- automated decision recommendations

## Privacy and Governance Concerns

Main risks:

- trust inflation from broad "verified" language
- accidental support-console or provider-reference leakage
- recipient overreliance on platform-derived readiness summaries
- tenant share packages becoming a public reputation surface
- landlord/property authority metadata being misread as ownership proof
- expired/revoked claims remaining externally visible
- institutional packets being treated as submitted or certified
- AI workflows inferring claims from incomplete summaries

Required governance controls before implementation:

- portable schema allowlist
- claim-level consent
- recipient-purpose matrix
- redaction policy matrix
- expiration/revocation policy
- support/internal metadata exclusion
- audit event lineage
- clear disclaimers for non-authority claims
- tenant and landlord control separation
- no public indexing or reputation profile behavior

## Primary Questions Answered

1. Current trust metadata includes account trust, identity assurance, property trust, identity-layer lineage, share package permissions, institution export previews, sharing room scopes, governance metadata, legal document metadata, and canonical event references.
2. Safe portability candidates are consent-scoped, metadata-only summaries of assurance level, status, issuer category, evidence category, timestamps, recipient purpose, redaction class, and non-authority disclaimers.
3. Internal-only metadata includes support diagnostics, raw evidence refs, operational destinations, policy internals, telemetry, token hashes, and internal review reasons.
4. Never-portable metadata includes raw identity documents, biometrics, SIN/SSN equivalents, raw provider payloads, screening payloads, banking credentials, raw title payloads, support notes, and unsupported eligibility/ownership/credit claims.
5. Required consent architecture is claim-level, recipient-scoped, purpose-scoped, time-bound, revocable, and auditable.
6. Revocation/reverification must operate per claim and should downgrade or invalidate portable claims when underlying attestations expire or are revoked.
7. Institutions will expect versioned claim envelopes, recipient policies, consent references, evidence categories, lifecycle timestamps, redactions, audit lineage, and disclaimers.
8. Safe claims are scoped and explainable, such as "metadata present" or "completed through approved workflow."
9. Dangerous claims include RentChain-proven identity, owner verified, creditworthy, subsidy eligible, government verified, automated approval, or execution ready.
10. Tenants should control tenant identity, documents, application, lease, payment readiness, and rental-history portability.
11. Landlords should control business/property/operator authority and portfolio package portability, subject to tenant data boundaries.
12. Institution-only metadata should include approved packet status, institution review outcomes, and signed audit packet references, never support internals.
13. Expiration should be claim-specific and tied to underlying attestation freshness, consent expiry, and recipient purpose.
14. Tenant insurance and tenant portable packages are closest to framework readiness; lender, landlord insurance, subsidy, government, and credit bureau workflows need more governance and schemas.
15. RentChain is ready for a portable attestation framework mission, but not for live institution integrations or public portable trust sharing.

## Recommended Next Mission

Proceed next with:

`feat/portable-attestation-framework-v1`

Initial implementation should be limited to:

- portable attestation types and schemas
- allowlisted projection helpers from account trust, identity assurance, property trust, and share package metadata
- consent-required validation
- redaction policy helpers
- revocation/expiration status helpers
- tests proving no raw provider/support/private metadata is portable
- documentation of safe and unsafe claims

Do not implement:

- public trust profiles
- external institution APIs
- provider integrations
- credit bureau workflows
- subsidy APIs
- lender/insurer API submissions
- blockchain/tokenization
- automated institutional decisioning

## Remaining Risks

- Current readiness labels may still be misinterpreted by external recipients if copied into portable contexts without a new schema.
- Current tenant share package lifecycle is package-level and section-level; portable attestations need claim-level consent and expiration.
- Property and business authority metadata remains provider-neutral and should not imply legal ownership.
- Institution exports remain previews and should not become portable packages without signed schema and review policy.
- Support-safe summaries are not portable summaries.
- Future AI workflows must consume only portable-safe projections, not internal governance metadata.
