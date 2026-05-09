# Trust Export Recipient Access Readiness Audit v1

Branch: `strategy/trust-export-recipient-access-readiness-audit-v1`
Scope: documentation-only recipient-access readiness audit, no recipient access implementation

## Executive Summary

RentChain is not ready to implement broad recipient-controlled trust export access yet.

The current tenant-controlled trust export flow is the right first adoption surface: tenant-authenticated, consent-scoped, policy-gated, metadata-only, downloadable, non-public, and revocable inside RentChain state. Its main limitation is also clear: once a tenant downloads and forwards JSON outside RentChain, revocation, expiration, audience scope, and access auditability cannot be technically enforced against that external copy.

The safest long-term model is tenant-mediated recipient access:

- recipient-authenticated
- tenant-approved
- time-bound
- audience-scoped
- revocation-aware
- session-controlled
- metadata-only
- non-public by default

Recommended next mission:

`feat/tenant-mediated-institution-access-v1`

This should be narrower than a general public-link or institution API project. It should define tenant-approved recipient access grants, recipient authentication requirements, access-window lifecycle, audit events, and revocation behavior before any live insurer, lender, subsidy, government, or provider integration.

## Audit Scope Completed

Reviewed strategy and architecture:

- `docs/strategy/trust-export-adoption-readiness-audit-v1.md`
- `docs/architecture/institutional-trust-export-framework-v1.md`
- `docs/architecture/portable-attestation-framework-v1.md`
- `docs/architecture/institutional-sharing-room-v1.md`

Reviewed implementation surfaces:

- `rentchain-api/src/services/tenantPortal/tenantTrustExportService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-frontend/src/api/tenantTrustExports.ts`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/institutionTrustExports/deriveInstitutionalTrustExportPackage.ts`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/routes/publicTenantShareRoutes.ts`
- `rentchain-api/src/middleware/authMiddleware.ts`
- `rentchain-api/src/routes/landlordSharingRoomRoutes.ts`
- institutional sharing-room helpers and tests

## Current Model

Tenant trust exports are currently prepared through authenticated tenant workspace routes:

- `GET /tenant/trust-exports`
- `POST /tenant/trust-exports/preview`
- `POST /tenant/trust-exports`
- `POST /tenant/trust-exports/:exportId/revoke`

The service stores prepared export records in `tenantTrustExports` and keeps the flow:

- tenant-controlled
- consent-required
- audience-scoped
- purpose-scoped
- policy-gated
- metadata-only
- non-public
- external-submission disabled
- revocable in RentChain state
- capped at a short export lifetime

The frontend reinforces those boundaries. The tenant workspace states that exports are non-public, no data is sent automatically, support/internal metadata stays excluded, and revocation cannot recall files already downloaded or shared outside RentChain.

Existing tenant share packages are a separate system. They use hashed bearer tokens, expiry, revocation, and public `/share/:token` routes for scoped tenant profile sharing. That pattern is useful operational precedent, but it is not sufficient as-is for portable trust exports because trust exports carry institution-facing trust semantics and stricter consent, audience, and revocation expectations.

## Current Export Limitations

Downloadable JSON is sufficient as a first, tenant-controlled portability slice, but not sufficient as the long-term institution access model.

Current limitations:

- RentChain cannot technically revoke an already downloaded file.
- RentChain cannot prove who later viewed a forwarded JSON file.
- RentChain cannot enforce recipient audience after external forwarding.
- RentChain cannot require recipient re-authentication for a downloaded file.
- RentChain cannot prevent stale, expired, or superseded JSON from being relied on externally.
- RentChain cannot notify downstream recipients when a tenant revokes a package unless access is still RentChain-controlled.
- RentChain cannot enforce session boundaries, download controls, or institution-specific visibility once the file leaves the platform.
- RentChain cannot distinguish a legitimate institution reviewer from an unintended recipient after file forwarding.

This does not make the current downloadable model unsafe for tenant-controlled review. It means downloads should remain a limited portability mechanism, not the final recipient-access architecture.

## Downloadable Export Risks

Risks after external redistribution:

- stale trust metadata can outlive its intended access window
- revoked exports can still circulate as old files
- audience-specific packages can be forwarded to a different audience
- tenant consent can become detached from downstream use
- recipients can copy, archive, or transform JSON outside RentChain governance
- institution reviewers may over-read metadata as approval, eligibility, creditworthiness, or verification authority
- support cannot verify whether a specific recipient relied on the latest package
- dispute handling is weaker because access logs end at download time

Required mitigation for continued downloads:

- clear non-authority disclaimers
- generated-at, expires-at, revoked-at, and policy-gated fields visible in the payload
- explicit warning that external copies cannot be technically recalled
- no raw identity, provider, screening, banking, property-title, support, or internal governance payloads
- no public URLs embedded in the payload
- future recipient-access systems should supersede downloads for high-trust institution workflows

## Recipient Access Model Ranking

| Model | Ranking | Readiness | Findings |
| --- | --- | --- | --- |
| Tenant-reviewed downloadable JSON | Safe first slice with constraints | Implemented | Appropriate for tenant agency and manual portability, but revocation cannot reach external copies. |
| Bearer expiring trust access links | Moderate risk | Not ready | Expiry helps, but bearer links are forwardable and weak for institution-facing trust unless paired with recipient verification and tenant approval. |
| Recipient-authenticated portal | Safest long-term | Not ready | Best fit for revocation propagation, access logs, and audience control, but requires recipient identity/session model and access-grant lifecycle. |
| Audience-scoped temporary sessions | Safest controlled pattern | Not ready | Strong next architecture candidate when initiated by tenant approval and backed by policy-gated package derivation. |
| Institution-scoped review sessions | Later-stage safe pattern | Not ready | Suitable for insurers, lenders, subsidy programs, and government reviewers only after institution onboarding and role expectations exist. |
| Tenant-mediated access grants | Recommended next | Approaching ready | Narrow enough to implement before institution integrations, provided recipients authenticate and access is revocable/time-bound. |
| Public export URLs | Prohibited | Not ready | Conflicts with non-public, consent-scoped trust orchestration. |
| Public trust profiles | Prohibited | Not ready | Creates reputation-network drift and unsupported public verification semantics. |
| Blockchain/verifiable credential publishing | Prohibited | Not ready | Outside scope and incompatible with current privacy/revocation requirements. |

## Recipient Authentication Findings

Appropriate recipient authentication should be progressive by audience risk:

| Recipient category | Minimum future control | Notes |
| --- | --- | --- |
| Tenant self-download | Tenant session | Current model is acceptable for self-review and manual sharing. |
| Individual landlord reviewer | Tenant-mediated invite plus authenticated session | Should not use a bare public link for trust metadata. |
| Institutional landlord | Tenant-mediated invite, verified recipient email/domain, time-bound session | Should receive only the tenant-approved audience-specific package. |
| Insurer | Recipient-authenticated session, tenant approval, purpose binding, audit log | No insurer API delivery until partnership and privacy terms exist. |
| Lender | Stronger recipient and organization verification, explicit purpose, legal/compliance semantics review | Higher risk because trust metadata can be interpreted as underwriting or creditworthiness. |
| Subsidy program | Program-specific recipient authentication, government/program terms, strict schema | Not ready without identity assurance and program eligibility governance. |
| Government reviewer | Strongest controls, program-specific authorization, access logging, legal/privacy review | Not ready for implementation. |
| Auditor | Authenticated session with narrow scope and expiration | Acceptable later for review-only metadata, not internal support details. |

Email-only magic links may be acceptable for low-risk review initiation, but should not be the only control for lender, subsidy, government, or high-sensitivity institutional workflows.

## Revocation And Expiration Findings

Current state:

- Prepared tenant trust exports can be revoked in RentChain.
- Export packages include expiration metadata.
- Policy gates block expired, revoked, superseded, and reverification-required attestations when deriving export-safe summaries.
- Downloaded files remain outside RentChain control.

Required future behavior for recipient access:

- recipient access checks must evaluate export lifecycle on every view
- revoked packages must stop resolving immediately in RentChain-controlled surfaces
- expired packages must stop resolving automatically
- reverification-required trust metadata must block package regeneration or display as unavailable
- recipients should see that access is revoked, expired, or superseded without seeing the old trust payload
- tenants should see who accessed an export, when, for what audience, and under which purpose
- new trust metadata should require a fresh package derivation rather than mutating old exports silently
- if an export is superseded, old access should show superseded status and route the tenant to create a new package

Revocation must be represented as a RentChain-controlled access decision, not only as historical metadata.

## Audience Enforcement Gaps

Current packages encode audience and purpose, and the policy gate enforces matching while deriving summaries. That is necessary but not sufficient for recipient access.

Future recipient access must additionally bind:

- export id
- tenant subject
- recipient identity
- recipient organization where applicable
- intended audience
- intended purpose
- approved claim categories
- access window
- access method
- consent record
- policy-gate version
- package schema version

The access grant should fail closed when recipient identity, audience, purpose, lifecycle, or consent cannot be resolved.

## Secure Sharing Architecture Options

### Option 1: Continue Downloadable JSON Only

Pros:

- preserves tenant control
- no public access surface
- no new recipient identity model
- simple and currently implemented

Cons:

- no revocation propagation after download
- no recipient authentication
- no access audit after download
- no audience enforcement after forwarding
- weak for insurer, lender, subsidy, and government workflows

Recommendation: keep as a limited tenant-controlled portability mechanism, not the long-term institution access model.

### Option 2: Expiring Signed Links

Pros:

- can expire automatically
- can show current revoked/expired state
- less friction than full recipient accounts
- useful for low-risk review initiation

Cons:

- bearer links can be forwarded
- recipient identity can remain unknown
- institution-specific authorization is weak
- risky if used for lenders, subsidy programs, or government workflows

Recommendation: acceptable only if link access is secondary to recipient identity checks or limited to low-sensitivity initiation. Do not implement public trust export links as the primary control.

### Option 3: Recipient-Authenticated Portal

Pros:

- strongest revocation propagation
- supports per-view audit logs
- supports recipient identity and organization binding
- supports session-bound access and download controls
- supports institution-specific visibility later

Cons:

- requires recipient identity/session model
- requires tenant-mediated access grants
- requires institution/organization semantics
- requires stricter support and abuse handling

Recommendation: safest long-term direction, but should begin with a narrow tenant-mediated access grant mission.

### Option 4: Tenant-Mediated Temporary Sessions

Pros:

- keeps tenant agency central
- enables audience-scoped access without broad integrations
- supports revocation, expiration, and access auditability
- avoids public profiles
- can reuse policy-gated package derivation

Cons:

- still needs recipient authentication and access ledger design
- needs clear UX for revocation and recipient status
- needs careful semantics for institutional audiences

Recommendation: best next implementation path.

### Option 5: Institution-Scoped Review Sessions

Pros:

- strong fit for future insurers, lenders, subsidy programs, government reviewers, and institutional landlords
- aligns with sharing-room architecture
- supports organization-level governance

Cons:

- requires institution onboarding, role management, terms, and governance
- premature before a narrow tenant-mediated model exists

Recommendation: later-stage architecture after tenant-mediated recipient access proves safe.

## Institution Readiness Findings

Insurer workflows are plausible after tenant-mediated access exists. They should receive only metadata relevant to tenant-controlled insurance review, and exports must avoid eligibility or approval semantics.

Lender workflows are higher risk. They may be interpreted as creditworthiness, underwriting, or regulated decision support. Lender access needs stronger organization verification, explicit permitted purpose, retention boundaries, and legal/compliance review.

Subsidy and government workflows are not ready. They require program-specific schemas, identity assurance, recipient authorization, legal/privacy review, accessibility of reviewer workflows, audit exports, and non-decisioning guardrails.

Institutional landlords are a reasonable early recipient category only for tenant-approved packages. Landlord-controlled trust exports should remain separate from tenant-controlled tenant metadata.

Auditor review can be supported later through narrow, authenticated, time-bound sessions. Auditor access must not include support-console notes or internal governance details.

## Metadata That Must Never Become Recipient-Accessible

The following must remain inaccessible to recipients:

- raw government ID images or document numbers
- biometric, liveness, or selfie payloads
- SIN/SSN equivalents
- raw identity provider payloads
- raw screening provider payloads
- raw credit bureau data
- banking credentials, card data, account numbers, or payment processor payloads
- raw title, registry, business, or property-provider payloads
- support-console notes and diagnostics
- internal governance notes
- unpublished confidence internals
- raw policy decision internals not intended for external interpretation
- token hashes, secrets, session identifiers, or internal access-control references
- private tenant documents not explicitly selected and policy-approved
- automated eligibility, creditworthiness, insurability, ownership, or subsidy conclusions

Recipient-visible packages should remain metadata-only and explainable.

## Safe And Unsafe Semantics

Safe institution-facing semantics:

- "tenant consent granted for this package"
- "metadata-only trust summary"
- "policy-gated export"
- "audience-scoped"
- "expires on"
- "revoked on"
- "reverification required"
- "evidence category"
- "issuer category"
- "manual review required"
- "not a RentChain eligibility decision"

Unsafe semantics:

- "approved tenant"
- "creditworthy"
- "insurable"
- "subsidy eligible"
- "government verified"
- "KYC approved"
- "identity proven by RentChain"
- "owner verified"
- "source of truth"
- "automated decision ready"
- "permanent credential"
- "public trust score"

Recipient access must keep semantics descriptive and non-authoritative.

## Recommended Next Mission

Proceed next with:

`feat/tenant-mediated-institution-access-v1`

Required scope:

- tenant-approved recipient access grants
- recipient authentication baseline
- audience and purpose binding
- revocable and expiring access windows
- per-view audit metadata
- policy-gated package derivation on access
- no public profiles
- no institution/provider APIs
- no automated decisions
- no share-package widening
- no raw payload exposure

Do not proceed next with general `feat/recipient-authenticated-trust-access-v1` unless it is constrained to tenant-mediated access grants. Do not proceed with `feat/expiring-trust-access-links-v1` as a standalone bearer-link project; signed links without recipient authentication would not solve the core recipient identity and forwarding problem.

## Acceptance Answer: Is RentChain Ready?

RentChain is ready for a narrow tenant-mediated recipient access foundation.

RentChain is not ready for:

- broad recipient-controlled trust access
- public trust export links
- institution APIs
- insurer/lender/subsidy/government integrations
- recipient-controlled onward sharing
- public trust profiles
- automated institutional decisions

The current architecture has the correct prerequisites: tenant-controlled export preparation, policy-gated summaries, portable attestation guardrails, institution export composition, non-public flags, and revocation state. The missing prerequisite is a recipient access-grant model that keeps tenant control, recipient authentication, revocation, expiration, and auditability inside RentChain-controlled surfaces.

## Regression Risks

Future implementation risks:

- treating signed URLs as recipient authentication
- widening existing public tenant share packages to carry trust exports
- allowing downloads from recipient sessions before recipient access policy is mature
- exposing support/internal metadata through recipient summaries
- allowing lender or government semantics before legal/privacy review
- creating evergreen access grants without expiration
- failing to re-check revocation on each view
- showing stale trust metadata after reverification is required
- using broad "verified" labels that imply unsupported authority

## Verification

This audit is documentation-only. It does not add:

- recipient access routes
- public links
- institution integrations
- provider integrations
- share-package behavior changes
- export API changes
- blockchain, verifiable credential, or tokenization behavior
- automated decisioning

