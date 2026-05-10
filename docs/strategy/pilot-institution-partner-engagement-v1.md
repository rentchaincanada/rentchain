# Pilot Institution Partner Engagement v1

Branch: `strategy/pilot-institution-partner-engagement-v1`
Scope: documentation-first pilot institution partner engagement strategy, no partner integration

## Executive Summary

RentChain is ready to begin controlled pilot institution engagement conversations under a narrow operating model:

- tenant-mediated institution review
- explicit tenant authorization
- authenticated matching-recipient review
- audience and purpose scope
- revocable and expiration-aware access
- lifecycle-governed trust export continuity
- metadata-only, view-only review
- policy-gated summaries
- controlled institution delivery
- recipient onboarding orientation
- support-safe diagnostics
- operator audit timeline reconstruction
- internal-only security telemetry, access forensics, and retention governance

RentChain is not ready to sell or describe institution APIs, provider integrations, downloadable institution exports, public trust profiles, automated institution delivery, institution-controlled workflows, bulk interoperability, or automated eligibility decisions.

Recommended next mission:

`strategy/institution-legal-and-compliance-readiness-v1`

Reason: the technical and operational foundations are strong enough for carefully scoped pilot conversations, but live partner engagement should first convert the current governance posture into legal/compliance review criteria, approved reliance language, partner data handling expectations, retention terms, and pilot eligibility gates. A partner-facing workspace or identity assurance build should come after that review, not before it.

## Strategy And Audit Plan

This mission is documentation-first and governance-first.

1. Review current institution review, delivery, onboarding, observability, telemetry, forensics, retention, runbook, support, and lifecycle systems.
2. Identify current institution-ready capabilities and operational guarantees that can be safely described.
3. Define claims RentChain can make and claims RentChain must not make.
4. Classify realistic near-term pilot partners, moderate-risk partners, and premature/high-risk partners.
5. Define engagement boundaries, support expectations, legal/compliance gaps, and pilot readiness criteria.
6. Recommend the next mission without implementing integrations, APIs, public exposure, downloadable exports, provider connections, blockchain/tokenization, automated decisions, or product-scope widening.

## Audit Scope Completed

Reviewed strategy and operations artifacts:

- `docs/strategy/institution-partner-readiness-v1.md`
- `docs/strategy/institution-interoperability-readiness-audit-v1.md`
- `docs/strategy/institution-review-invite-operational-qa-v1.md`
- `docs/operations/pilot-institution-operations-runbooks-v1.md`
- `docs/operations/security-telemetry-retention-enforcement-v1.md`

Reviewed implementation surfaces:

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/supportConsoleRoutes.ts`
- `rentchain-api/src/lib/institutionReviewSessions/*`
- `rentchain-api/src/lib/institutionTrustExports/*`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/supportConsole/*`
- `rentchain-frontend/src/api/recipientTrustReview.ts`
- `rentchain-frontend/src/api/tenantInstitutionAccess.ts`
- `rentchain-frontend/src/api/supportConsoleApi.ts`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`

No product behavior, API, route, schema, integration, or UI implementation was changed.

## Current Institution-Ready Capabilities

### Tenant-Mediated Review

Institution review begins with tenant action. Access is tied to tenant authorization, recipient email, audience, purpose, expiration, and policy-ready trust package state. Institutions do not initiate access, own tenant trust records, or control review lifecycle.

Safe engagement framing:

- "RentChain supports tenant-authorized institution review."
- "The tenant controls whether a specific recipient may review a limited metadata-only summary."
- "Institution review is not institution-controlled access to tenant records."

Unsafe engagement framing:

- "Institutions can pull tenant trust data."
- "Institutions can query RentChain for tenant eligibility."
- "RentChain creates institution-owned trust profiles."

### Invitation And Controlled Delivery

Tenant-mediated delivery can send or resend review invitations through the governed access stack. Delivery is blocked when the grant is revoked, expired, policy-denied, lifecycle-invalid, missing consent, or missing an authorized recipient. Delivery emails do not contain trust payloads, raw IDs, downloads, public profiles, or bearer-token authorization.

Safe engagement framing:

- "RentChain can help a tenant deliver an authenticated review invitation to a named recipient."
- "The delivery email is an entry point, not authorization by itself."
- "Review requires sign-in with the tenant-authorized recipient email."

Unsafe engagement framing:

- "RentChain automatically sends trust data to partners."
- "Invite links are sufficient to view tenant trust data."
- "Partner delivery is API-based or automatic."

### Recipient Authentication And Onboarding

Recipient review requires authenticated recipient context and matching invited email. The recipient sees a controlled onboarding orientation before included review metadata is shown. The orientation explains tenant authorization, authentication, metadata-only scope, revocation, expiration, no downloads, no public profile, and non-decision semantics.

Safe engagement framing:

- "Recipients are oriented before review and must acknowledge the scope."
- "Review is metadata-only, view-only, time-bound, and revocable."
- "RentChain does not represent the review as approval, eligibility, underwriting, subsidy, government, or automated decisioning."

Unsafe engagement framing:

- "Recipients are onboarded as institution accounts."
- "RentChain verifies institution employees."
- "Acknowledgement creates a partner contract or institution identity proof."

### Session And Lifecycle Governance

Recipient sessions are grant-bound, recipient-bound, audience-bound, purpose-bound, time-bound, and continuity-fingerprinted. Revoked, expired, blocked, stale, replayed, policy-denied, lifecycle-invalid, superseded, archived, invalidated, or reverification-required states block review inside RentChain-controlled surfaces.

Safe engagement framing:

- "Review is revalidated against current access and trust export lifecycle state."
- "Revoked and expired access blocks future RentChain-hosted review."
- "Stale or mismatched sessions require reauthentication."

Unsafe engagement framing:

- "Revocation recalls screenshots or external notes."
- "RentChain controls partner retention after a reviewer copies information."
- "A review remains valid permanently."

### Metadata-Only Trust Review

Institution-facing review uses policy-gated claim categories, lifecycle labels, consent expiry, audience, purpose, redactions, disclaimers, and review/session state. Raw trust payloads, raw provider payloads, raw identity documents, raw property payloads, support/internal metadata, public profiles, and downloads are excluded.

Safe engagement framing:

- "RentChain provides a limited metadata-only review context."
- "The review helps an intended recipient understand tenant-authorized trust status categories."
- "The review is not a raw document room or provider-data feed."

Unsafe engagement framing:

- "RentChain shares source documents."
- "RentChain shares provider payloads."
- "RentChain exports complete trust files to institutions."

### Supportability And Operational Controls

Support-safe diagnostics, institution review observability, operator audit timelines, security/session telemetry, access forensics, and retention governance support operational troubleshooting without exposing trust payloads. Operators can reconstruct lifecycle events, blocked attempts, wrong-recipient attempts, revocation, expiration, delivery status, and review continuity using redacted metadata.

Safe engagement framing:

- "RentChain can troubleshoot review access using support-safe operational metadata."
- "Operator diagnostic access is auditable."
- "Security telemetry is internal-only and non-portable."

Unsafe engagement framing:

- "Partners receive security telemetry."
- "Partners can access support diagnostics."
- "RentChain exposes raw IPs, device fingerprints, or internal forensic chains."

## Operational Guarantees RentChain Can Safely Describe

Inside RentChain-controlled review surfaces, RentChain can safely state:

- access is tenant-mediated
- review requires explicit tenant authorization
- review is scoped to a named recipient email, audience, and purpose
- recipient review requires authentication
- possession of an invitation or delivery link is not enough to view review metadata
- review access has an expiration
- tenant revocation blocks future review
- expired access blocks future review
- policy-denied summaries are blocked
- lifecycle-invalid trust export packages are blocked
- stale or mismatched sessions require reauthentication
- review is metadata-only and view-only
- downloads are disabled
- public profiles and public trust URLs are not created
- support/operator diagnostics are redacted and metadata-only
- operator access is auditable
- internal security telemetry is classified as internal-only and non-portable
- retention governance exists for security/session telemetry summaries

## Claims RentChain Must Not Make

RentChain must not state or imply:

- RentChain approves tenants
- RentChain determines eligibility
- RentChain provides underwriting decisions
- RentChain provides credit decisions or credit reports
- RentChain verifies government, subsidy, insurance, lending, or housing-program eligibility
- RentChain certifies tenants as safe, low-risk, insurable, lendable, subsidy-eligible, or government-approved
- RentChain is a credit bureau
- RentChain is a public trust network
- RentChain creates permanent credentials
- institutions can pull tenant data through APIs
- institutions can download trust packages
- institutions can rely on RentChain as the source of truth for legal identity, tenancy, ownership, payment, screening, or provider records
- revocation can recall information copied outside RentChain
- partner retention is technically enforced outside RentChain
- institution recipients are organization-verified beyond current authenticated email matching
- security telemetry, forensics, or support diagnostics are institution-visible
- AI or automated systems make eligibility decisions inside RentChain review workflows

## Safe Institution-Facing Semantics

Use these terms in pilot conversations:

- tenant-authorized review
- tenant-mediated review
- metadata-only review
- view-only review
- authenticated recipient
- named recipient
- audience-scoped
- purpose-scoped
- time-bound access
- revocable access in RentChain-controlled surfaces
- policy-gated summary
- lifecycle-governed review
- non-public review
- support-safe diagnostics
- audit-safe operational timeline
- not an approval or eligibility decision
- not a credit report
- not a public profile
- not an automated decision

Avoid these terms:

- approved tenant
- eligible tenant
- verified tenant
- creditworthy
- insurable
- lendable
- subsidy eligible
- government verified
- provider verified
- institution certified
- guaranteed acceptance
- tenant score
- trust score
- risk score
- source of truth
- permanent credential
- public credential
- public verification
- automated approval
- automated underwriting

## Metadata Institutions Should Never Receive

Institutions should never receive through this pilot engagement model:

- raw government ID images
- biometric or liveness payloads
- SIN/SSN equivalents
- raw provider payloads
- raw screening reports
- bureau payloads
- raw banking or open-banking payloads
- raw title, registry, or property-provider payloads
- raw identity documents
- raw property documents
- raw legal document files unless a separate explicit document workflow exists
- support-console notes
- operator private notes
- internal governance notes
- internal policy rule internals beyond safe blocked categories
- raw security telemetry
- raw IP addresses
- full user agents
- device fingerprints
- precise geolocation
- behavioral profiles
- access token hashes
- session fingerprints
- hidden confidence calculations
- tenant scoring or risk scoring outputs
- raw internal trust package payloads
- downloadable institution trust exports
- automated eligibility, credit, insurance, subsidy, government, or approval conclusions

## Pilot Partner Classifications

| Partner Type | Classification | Engagement Finding |
| --- | --- | --- |
| Institutional landlords | Realistic near-term pilot | Best fit for first engagement because the workflow resembles existing rental review. Must remain tenant-mediated, authenticated, metadata-only, and non-decisioning. |
| Advocate/caseworker-assisted organizations | Realistic near-term pilot with constraints | Good fit when a tenant wants help navigating housing workflows. Requires clear recipient role, consent framing, and no independent institution control. |
| Nonprofit housing support organizations | Realistic near-term pilot with constraints | Similar to advocate/caseworker workflows. Needs retention expectations, safe support channels, and careful non-eligibility language. |
| Insurers | Moderate risk | Possible exploratory conversation, but pilot use requires legal/compliance review because insurance semantics may imply underwriting or eligibility. |
| Lenders | Premature/high risk | Lending workflows can imply creditworthiness or underwriting. Requires consumer-reporting review, partner terms, stronger identity assurance, and approved reliance language. |
| Subsidy programs | Premature/high risk | Program eligibility language and statutory duties are sensitive. Requires program-specific consent, legal basis, retention, notices, and compliance review. |
| Government housing programs | Premature/high risk | Requires verified organization identity, authorized-role model, statutory purpose mapping, retention and disclosure rules, incident obligations, and legal/compliance review. |

## Recommended Pilot Engagement Model

Initial pilot engagement should be a structured conversation and manual operating model, not a product integration.

### Entry Criteria

A pilot partner candidate should have:

- a narrow review-only use case
- a named operational contact
- a small number of authorized recipient emails
- willingness to use RentChain-hosted authenticated review
- acceptance that review is metadata-only and view-only
- acceptance that no downloads, APIs, public profiles, or automated decisions are provided
- ability to handle tenant revocation and expiration limits
- agreement not to characterize RentChain review as approval, eligibility, underwriting, or verification authority
- legal/compliance review complete for its partner category before live tenant data review

### Conversation Structure

Pilot conversations should cover:

1. What tenant-mediated review means.
2. What metadata-only review includes and excludes.
3. How authentication, recipient email matching, expiration, and revocation work.
4. What lifecycle states can block review.
5. What support can troubleshoot using redacted operational metadata.
6. What RentChain does not provide: APIs, downloads, public profiles, institution-controlled workflows, automated decisions, raw documents, raw provider payloads, or partner telemetry.
7. What legal/compliance review remains before any live pilot.
8. What pilot exit criteria would determine whether further product work is justified.

### Pilot Scope Limits

Every pilot should be bounded by:

- partner type
- use case
- audience
- purpose
- recipient role
- recipient email list
- expiration window
- support contact
- escalation contact
- retention expectation
- communication language
- legal/compliance review status
- no-download and no-API commitment
- revocation and expiration acknowledgement

## Support And Escalation Expectations

RentChain can support pilot partners through operational channels, but expectations must be narrow:

- support can diagnose authentication failures, wrong-recipient attempts, expired access, revoked access, delivery failures, stale sessions, replay-blocked sessions, policy-denied review, and lifecycle invalidation
- support can explain safe status categories using runbook language
- support can confirm that deterministic access controls blocked review where applicable
- support can escalate suspicious access patterns to security/governance review
- support can escalate lifecycle inconsistencies to product/engineering

RentChain should not promise:

- custom partner support SLAs without a separate operating agreement
- legal interpretation of tenant eligibility
- partner-specific data exports
- real-time external revocation notifications
- organization identity verification
- partner SSO
- custom APIs
- audit exports for partner systems
- support access to raw trust payloads

## Legal And Compliance Review Gaps

Legal/compliance review is required before live pilot data sharing with any institution partner.

Open review areas:

- consumer reporting exposure
- insurance underwriting interpretation
- lending/creditworthiness interpretation
- subsidy or government eligibility implications
- fair housing and anti-discrimination risk
- consent language sufficiency
- partner retention and deletion obligations
- partner incident notification obligations
- partner secondary use restrictions
- recipient authority and role validation
- audit log retention and disclosure policy
- disclaimers and reliance limitations
- treatment of partner-side AI-assisted review
- accessibility and language clarity for recipients

These gaps do not block strategy conversations. They do block production partner launch, APIs, downloads, automated delivery, institution-controlled workflows, and any eligibility/reliance language.

## Unsafe Marketing And Positioning Risks

The main engagement risk is overclaiming.

High-risk positioning patterns:

- describing RentChain as an eligibility or approval platform
- describing tenant metadata as verification authority
- implying institution partners can rely on the review as a legal decision
- implying partner APIs are available or imminent
- implying downloads or exports can be provided on request
- implying revocation controls what a recipient remembers, copies, screenshots, or stores externally
- implying RentChain verifies institution employment or delegated authority
- implying security telemetry can be shared with partners
- implying RentChain scores tenants or ranks risk

Approved positioning pattern:

"RentChain supports tenant-mediated, authenticated, metadata-only institution review in a RentChain-controlled surface. Review is purpose-scoped, time-bound, revocable, policy-gated, lifecycle-governed, support-safe, and audit-aware. RentChain does not provide approval, eligibility, underwriting, credit, subsidy, government, or automated decisioning."

## Institution Expectations To Set Explicitly

Institutions should expect:

- manual pilot engagement
- tenant-controlled authorization
- authenticated recipient review
- named-recipient access
- metadata-only, view-only review
- time-bound access
- revocation-aware RentChain-hosted review
- conservative non-decision wording
- support through RentChain operational channels
- legal/compliance review before live pilot workflows

Institutions should not expect:

- institution accounts
- institution APIs
- provider APIs
- automated delivery
- institution-initiated access
- partner-managed tenant profiles
- downloadable trust packages
- public verification pages
- permanent credentials
- integration credentials
- data warehouse access
- raw document or provider payloads
- security telemetry access
- institution-visible support diagnostics
- automated eligibility, approval, underwriting, or government determinations

## Readiness Decision

Readiness level: **ready for controlled pilot institution engagement conversations; not ready for live partner operations without legal/compliance readiness review.**

RentChain can safely begin structured conversations with:

- institutional landlords
- nonprofit housing support organizations
- advocate/caseworker-assisted organizations

RentChain can cautiously explore insurer conversations if the discussion remains metadata-only, non-decisioning, and explicitly pre-pilot pending legal/compliance review.

RentChain should not start live lender, subsidy, or government housing pilot operations yet.

RentChain should not proceed with institution APIs, automated institution delivery, downloadable institution exports, institution-controlled workflows, public profiles, automated eligibility, partner SSO, or broad interoperability.

## Recommended Next Mission

Recommended:

`strategy/institution-legal-and-compliance-readiness-v1`

Purpose:

- convert current operational guarantees into legal/compliance review criteria
- define approved partner reliance language
- define partner data handling, retention, and deletion expectations
- classify consumer reporting, insurance, lending, subsidy, government, fair housing, and anti-discrimination risks
- define pre-pilot legal gates for each partner category

Not recommended next:

- `feat/pilot-institution-review-engagement-workspace-v1`

Reason: a workspace would be useful after legal/compliance readiness, but it could prematurely operationalize partner engagement before reliance language and partner obligations are approved.

Not recommended next:

- `feat/institution-identity-assurance-readiness-v1`

Reason: identity assurance is important, but it should follow partner category and legal/compliance requirements so the model does not overbuild or imply verified institution accounts prematurely.

Not recommended next:

- future institution API readiness planning

Reason: APIs remain premature until controlled pilots establish real operational needs and legal/compliance obligations.

## Remaining Risks

- Partner organization identity is not verified beyond invited authenticated email.
- External retention and secondary use are not technically enforced outside RentChain-controlled review surfaces.
- Revocation cannot recall screenshots, copied text, memory, or external notes.
- No external revocation acknowledgement or partner receipt model exists.
- No formal partner contract, data processing addendum, or reliance-language approval exists.
- No partner-facing audit export policy exists.
- Lender, subsidy, government, and insurer use cases may trigger legal/compliance regimes that require separate review.
- AI-assisted partner-side review remains outside RentChain controls and must be governed through partner terms before live pilots.

## PR-Ready Summary

This strategy establishes the pilot institution partner engagement boundary. It confirms RentChain can safely discuss controlled pilot institution review only under the existing tenant-mediated, authenticated, revocable, expiration-aware, lifecycle-governed, metadata-only, support-safe model.

It also confirms RentChain must not position itself as a credit bureau, public trust network, tenant scoring engine, automated institutional decision platform, decentralized identity marketplace, or source of institution-controlled trust ownership.

No product behavior changed. No institution integration, provider integration, institution API, public trust profile, downloadable institution export, automated delivery, automated decisioning, blockchain/tokenization, or trust visibility expansion was introduced.
