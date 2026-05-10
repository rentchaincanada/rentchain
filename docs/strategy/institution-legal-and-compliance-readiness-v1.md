# Institution Legal And Compliance Readiness v1

Branch: `strategy/institution-legal-and-compliance-readiness-v1`
Scope: documentation-first legal/compliance readiness framework, no legal advice and no product behavior changes

## Non-Legal-Advice Notice

This document is an operational legal/compliance readiness framework for RentChain's controlled pilot institution review operations. It is not legal advice, does not approve any pilot launch, and does not replace review by qualified counsel in the relevant jurisdictions and partner categories.

## Executive Summary

RentChain is approaching readiness for controlled pilot institution engagement under a narrow governed model:

- tenant-mediated institution review
- explicit tenant authorization
- authenticated named-recipient review
- audience and purpose scope
- revocable and expiration-aware RentChain-hosted access
- lifecycle-governed trust export continuity
- metadata-only, view-only review
- policy-gated summaries
- support-safe diagnostics
- operator audit timeline reconstruction
- internal-only security telemetry, access forensics, and retention governance

RentChain is not legally or operationally ready to position itself as an institution API platform, downloadable trust export provider, credit bureau, automated eligibility system, insurer/lender/subsidy decision tool, government verification system, or institution-controlled trust workflow.

Recommended next mission:

**Option E: External legal review preparation first**

Suggested branch:

`strategy/external-legal-review-preparation-v1`

Reason: the product and operations posture is strong enough for carefully scoped pilot discussions, but live partner engagement should first package the current architecture, disclaimers, retention posture, metadata boundaries, partner classifications, and unresolved compliance questions for external legal review. A pilot engagement workspace, identity assurance build, or API readiness plan should follow counsel-reviewed boundaries.

## Legal/Compliance Review Plan

This mission is documentation-first, governance-first, and compliance-first.

1. Review institution partner engagement, onboarding, invite, delivery, session, lifecycle, support, audit, telemetry, retention, and runbook materials.
2. Review current public legal/privacy posture where available.
3. Identify operational guarantees RentChain can safely describe.
4. Identify claims RentChain must not make without further legal/compliance review.
5. Define metadata, support, retention, liability, and institution-facing disclosure boundaries.
6. Classify partner-type legal/compliance readiness.
7. Recommend the next mission without adding legal contract systems, integrations, APIs, public exposure, downloads, blockchain/tokenization, automated decisions, or product-scope widening.

## Audit Scope Completed

Reviewed strategy and operations artifacts:

- `docs/strategy/pilot-institution-partner-engagement-v1.md`
- `docs/strategy/institution-partner-readiness-v1.md`
- `docs/strategy/institution-interoperability-readiness-audit-v1.md`
- `docs/strategy/institution-review-invite-operational-qa-v1.md`
- `docs/operations/pilot-institution-operations-runbooks-v1.md`
- `docs/operations/security-telemetry-retention-enforcement-v1.md`

Reviewed public legal/privacy posture:

- `rentchain-frontend/src/pages/legal/PrivacyPage.tsx`
- `rentchain-frontend/src/pages/legal/TermsPage.tsx`
- `rentchain-frontend/src/pages/legal/AcceptableUsePage.tsx`
- `rentchain-frontend/src/pages/ConsumerReportingGovernancePage.tsx`

Reviewed implementation surfaces for governance boundary confirmation:

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/securityTelemetry/securityTelemetryRetention.ts`
- `rentchain-api/src/lib/supportConsole/securityAccessForensics.ts`

No product behavior, API route, schema, legal contract system, institution integration, public exposure, downloadable export, or automated decision flow was changed.

## Current Legal/Compliance Strengths

### Platform Role Is Already Constrained

The current public terms and privacy posture state that RentChain provides governed operational infrastructure and does not operate as a consumer reporting agency, credit bureau, government authority, collections service, legal decision-maker, or platform that makes rental decisions.

This supports the institution-review boundary because the product should be framed as tenant-authorized review infrastructure, not a decision authority.

### Tenant-Mediated Consent Is The Core Control

Institution review begins with tenant action and explicit authorization. The current institution access stack binds review to recipient email, audience, purpose, expiration, consent state, grant lifecycle, session state, and policy-gated trust package readiness.

Safe claim:

- "RentChain supports tenant-authorized, audience-scoped, purpose-scoped review in a RentChain-controlled surface."

Unsafe claim:

- "Institutions can pull or own tenant trust records."

### Metadata-Only Review Is A Strong Privacy Boundary

Institution-facing review excludes raw trust payloads, raw provider payloads, raw identity documents, raw property data, support-console notes, internal governance notes, security telemetry, downloadable exports, public profiles, and automated decision outputs.

Safe claim:

- "Institution review is metadata-only and view-only."

Unsafe claim:

- "RentChain delivers complete tenant files or source documents to institutions."

### Lifecycle Governance Is Mature Inside RentChain-Controlled Surfaces

Access is expiration-aware, revocation-aware, session-bound, and policy-gated. Revoked, expired, blocked, stale, replayed, policy-denied, lifecycle-invalid, superseded, archived, invalidated, and reverification-required states can block active review in RentChain-hosted flows.

Safe claim:

- "RentChain revalidates access against current grant, session, policy, and lifecycle state before showing review metadata."

Unsafe claim:

- "RentChain can recall or erase information already copied outside RentChain."

### Support And Auditability Are Operationally Scoped

Support-safe diagnostics, operator audit timelines, observability, security telemetry, access forensics, and retention governance support operational reconstruction without exposing trust payloads.

Safe claim:

- "RentChain can reconstruct review lifecycle and access events using redacted operational metadata."

Unsafe claim:

- "Institutions receive support diagnostics, telemetry, forensics, or internal audit exports."

## Operational Disclosure Gaps

Before live pilot engagement, RentChain should define counsel-reviewed disclosures for:

- tenant authorization scope
- metadata-only review limits
- non-decision and non-eligibility posture
- no credit report or consumer reporting representation
- no institution API or downloadable export availability
- expiration and revocation behavior inside RentChain
- limits of external recall after recipient viewing
- partner retention and deletion responsibilities
- partner secondary-use restrictions
- partner incident reporting expectations
- recipient organization authority limitations
- support scope and escalation channels
- audit log retention and disclosure limits

These gaps do not require product changes in this mission. They do require legal/compliance review before live pilot data review with institutional partners.

## Safe Institution-Facing Guarantees

RentChain can safely describe the following guarantees for RentChain-controlled review surfaces:

- review is tenant-mediated
- review requires explicit tenant authorization
- review is scoped to a named recipient email
- review is scoped to an audience and purpose
- recipient review requires authentication
- possession of an invite or delivery link is not sufficient authorization
- review access has an expiration
- tenant revocation blocks future RentChain-hosted review
- expired access blocks future RentChain-hosted review
- policy-denied summaries are blocked
- lifecycle-invalid trust export packages are blocked
- stale or mismatched recipient sessions require reauthentication
- review is metadata-only and view-only
- downloads are disabled
- public trust profiles and public trust URLs are not created
- support/operator diagnostics are redacted and metadata-only
- operator diagnostic access is auditable
- security/session telemetry is internal-only and non-portable
- retention governance exists for internal security/session telemetry summaries

These guarantees should be paired with limitations. They apply to RentChain-controlled surfaces and do not promise partner-side behavior outside RentChain.

## Guarantees RentChain Must Not Make

RentChain must not state or imply that it:

- approves tenants
- determines tenant eligibility
- provides underwriting decisions
- provides credit decisions or credit reports
- operates as a credit bureau or consumer reporting agency
- verifies subsidy, insurance, lending, government, or housing-program eligibility
- certifies tenants as safe, low-risk, insurable, lendable, subsidy-eligible, or government-approved
- verifies institution employment or delegated authority beyond current authenticated email matching
- creates permanent tenant credentials
- creates public trust profiles
- provides downloadable institution trust exports
- provides institution APIs or data warehouse access
- creates institution-owned tenant trust records
- controls recipient screenshots, memory, notes, or external copies after review
- technically enforces partner retention outside RentChain
- shares raw documents, raw provider payloads, raw screening reports, or raw telemetry with institutions
- uses AI or automated systems to make eligibility, underwriting, approval, subsidy, government, or credit decisions

## Safe And Unsafe Operational Claims

| Area | Safe Claim | Unsafe Claim |
| --- | --- | --- |
| Platform role | RentChain provides governed review infrastructure. | RentChain is an approval, eligibility, credit, or government decision platform. |
| Tenant control | Review starts with tenant authorization. | Institutions can initiate or own tenant trust access. |
| Access model | Review is authenticated, email-bound, audience-scoped, purpose-scoped, and time-bound. | Invite links alone authorize trust access. |
| Review payload | Review is metadata-only and view-only. | Review includes raw documents, provider payloads, or complete tenant files. |
| Revocation | Revocation blocks future RentChain-hosted review. | Revocation recalls information already copied outside RentChain. |
| Expiration | Expired access blocks future RentChain-hosted review. | Review remains valid permanently. |
| Lifecycle | Lifecycle-invalid summaries are blocked. | Stale trust claims remain institution-valid. |
| Auditability | Operators can reconstruct redacted lifecycle events. | Institutions receive internal telemetry, forensic chains, or support diagnostics. |
| Support | Support can troubleshoot access status and lifecycle blocks. | Support provides legal interpretations or eligibility determinations. |
| Partner use | Partners may review only within scoped pilot boundaries. | Partners can use RentChain as an unrestricted tenant intelligence source. |

## Metadata Institutions Should Never Receive

Institutions should never receive through controlled institution review:

- raw government ID images
- biometric or liveness payloads
- SIN/SSN equivalents
- raw screening reports
- raw credit bureau payloads
- raw provider payloads
- raw banking or open-banking payloads
- raw title, registry, or property-provider payloads
- raw legal document files unless a separate explicit document workflow exists
- raw identity documents
- raw property documents
- support-console notes
- operator private notes
- internal governance notes
- internal policy internals beyond safe blocked categories
- hidden confidence calculations
- tenant scoring or risk scoring outputs
- access token hashes
- session fingerprints
- raw IP addresses
- full user agents
- precise geolocation
- device fingerprints
- behavioral profiles
- raw internal trust package payloads
- security telemetry
- access forensics
- telemetry retention internals
- downloadable institution trust exports
- automated approval, eligibility, credit, insurance, subsidy, government, or underwriting conclusions

## Legal/Compliance Area Findings

### Lifecycle Governance Representations

RentChain can describe lifecycle checks as operational controls inside RentChain-hosted review. It should not describe lifecycle state as legal validity, provider verification, partner reliance approval, or permanent trust status.

Required disclosure boundary:

- Lifecycle state describes current RentChain-controlled review availability, not an institution's legal conclusion.

### Revocation And Expiration Semantics

RentChain can state that revoked or expired access blocks future RentChain-hosted review. It must disclose that revocation and expiration do not control information already observed, copied, remembered, screenshotted, or stored by a recipient outside RentChain.

Required disclosure boundary:

- Partner terms should define retention, deletion, secondary use, and incident obligations before live pilot review.

### Auditability Positioning

RentChain can state that it keeps metadata-only operational audit records for review lifecycle, access, support, and security accountability. It should not promise partner-visible audit exports, legal evidence certification, or institution compliance reporting without a separate reviewed workflow.

Required disclosure boundary:

- Audit timelines are internal/support-safe unless a separate counsel-reviewed disclosure process exists.

### Telemetry And Privacy Positioning

RentChain can state that security/session telemetry is internal-only, redacted, retention-governed, and non-portable. It must not share raw IPs, full user agents, telemetry events, forensic chains, or suspicious-access signals with institutions, tenants, or recipients through review payloads.

Required disclosure boundary:

- Telemetry exists for security accountability and support investigation, not institution-visible analytics or scoring.

### Supportability Expectations

RentChain can support authentication failures, wrong-recipient attempts, expired access, revoked access, policy-denied review, lifecycle invalidation, delivery issues, stale sessions, replay-blocked attempts, and redacted operational diagnostics.

RentChain should not promise custom SLAs, legal interpretations, partner audit exports, organization identity verification, partner SSO, or partner-specific reporting without a separate operating agreement.

### Institution-Facing Disclaimers

Every pilot-facing description should preserve these concepts:

- tenant-authorized review
- authenticated named recipient
- metadata-only and view-only
- time-bound and revocable
- not a public profile
- not a downloadable export
- not a credit report
- not an eligibility, underwriting, subsidy, government, or approval decision
- not legal advice
- no automated decision is made by RentChain

## Operational Liability Boundaries

RentChain should keep the following boundaries explicit:

- RentChain operates the review workflow; it does not make the institution's decision.
- Tenants authorize review; institutions do not independently pull tenant trust records.
- Recipients are responsible for using viewed information lawfully and within the pilot scope.
- Partners are responsible for their own retention, deletion, secondary-use, and onward-disclosure obligations.
- Landlords and institution recipients remain responsible for applicable housing, human rights, privacy, consumer reporting, anti-discrimination, and program-specific requirements.
- RentChain support can explain workflow state, but cannot provide legal advice or eligibility interpretations.
- RentChain's revocation and expiration controls apply to RentChain-hosted access, not external copies.
- RentChain does not guarantee third-party provider accuracy, legal sufficiency, or partner reliance outcomes.

## Partner-Type Legal/Compliance Classification

| Partner Type | Classification | Legal/Compliance Finding |
| --- | --- | --- |
| Institutional landlords | Most realistic near-term pilot | Similar to existing rental review, but still needs counsel-approved non-decision language, fair housing review, partner terms, and retention expectations. |
| Advocate/caseworker-assisted organizations | Realistic with constraints | Tenant-assistance use cases fit the tenant-mediated model. Must clarify agency boundaries, consent, support scope, and no independent institution control. |
| Nonprofit housing support organizations | Realistic with constraints | Potential fit for support workflows. Requires retention/deletion terms, safe communication channels, and no eligibility or government-program implication. |
| Insurers | Moderate/high risk | Insurance context can imply underwriting or eligibility. Requires counsel-reviewed reliance language, permissible use, partner retention, and no automated underwriting posture. |
| Lenders | High risk / premature | Lending can trigger creditworthiness, underwriting, and consumer reporting concerns. Requires consumer reporting analysis, stronger identity assurance, partner terms, and approved reliance limits before any live use. |
| Subsidy programs | High risk / premature | Program eligibility and statutory duties are sensitive. Requires program-specific legal basis, notices, consent language, retention, accessibility, and government/program review. |
| Government housing programs | High risk / premature | Requires verified organization identity, authorized role model, statutory purpose mapping, audit obligations, incident procedures, procurement/privacy review, and counsel involvement. |

## Retention And Disposal Expectations

Current security/session telemetry retention governance defines:

- active retention window
- archive window
- retention-expired state
- purge-pending state
- internal-only classification
- non-portable and non-exportable boundaries
- destructive purge job not implemented

Legal/compliance gaps:

- final retention windows require counsel confirmation
- partner retention and deletion terms are not yet defined
- external deletion confirmation is not modeled
- partner-side AI, screenshots, notes, or copied data are not technically controlled by RentChain
- immutable audit records need separate review before destructive cleanup policy is broadened

Operational disclosure:

- RentChain should describe internal telemetry retention as an internal governance control, not a partner-visible guarantee or institution analytics feature.

## Existing Legal/Privacy Posture Alignment

The current public legal/privacy posture already supports important boundaries:

- RentChain does not sell personal information.
- RentChain states it is not a consumer reporting agency or credit bureau.
- RentChain states it does not make rental decisions or provide legal advice.
- Screening provider outputs remain subject to provider requirements.
- Users must comply with housing, human rights, privacy, and consumer reporting requirements.
- Governance, consent, audit, and interoperability features are operational tooling and do not create automatic approvals.

Readiness gap:

- Institution pilot-specific terms, disclaimers, partner data handling requirements, support obligations, and reliance limitations are not yet formalized.

## Unresolved Legal/Compliance Gaps

These gaps should be resolved or explicitly accepted before live pilot institution data review:

- external legal review of institution-review positioning
- consumer reporting exposure analysis
- fair housing and anti-discrimination review
- insurance underwriting interpretation review
- lending/creditworthiness interpretation review
- subsidy/government program legal basis review
- partner retention, deletion, and secondary-use terms
- partner incident notification expectations
- partner-side AI-assisted review restrictions
- recipient organization authority and role validation
- institution identity assurance posture
- pilot participant terms or acknowledgement model
- approved reliance limitation language
- accessibility and plain-language review of recipient/institution copy
- audit log retention and disclosure policy
- support escalation liability boundaries
- privacy impact assessment for institution pilot workflows

## Institution-Facing Disclosure Checklist

Before any live pilot review, partner-facing materials should disclose:

1. Review is tenant-authorized.
2. Review is available only to the named authenticated recipient.
3. Review is metadata-only and view-only.
4. No raw documents or provider payloads are included.
5. No downloadable institution export is available.
6. Access is time-bound and may expire.
7. Tenant revocation blocks future RentChain-hosted review.
8. Revocation does not control recipient-side screenshots, notes, memory, or external copies.
9. RentChain does not make approval, eligibility, underwriting, credit, subsidy, government, or legal decisions.
10. RentChain is not a credit bureau or consumer reporting agency.
11. Partners must use information lawfully and within the pilot purpose.
12. Partners must follow agreed retention, deletion, incident, and secondary-use limits.
13. Support can troubleshoot workflow access and lifecycle state, not provide legal conclusions.
14. Internal telemetry, support diagnostics, and forensics are not institution-visible.
15. Counsel review remains required for partner category and use case.

## Readiness Decision

Readiness level: **approaching readiness for controlled pilot institution engagement after external legal review preparation; not ready for live partner operations requiring regulated reliance.**

RentChain can continue structured pilot conversations if the conversation stays non-production, non-integrated, non-downloadable, non-decisioning, and governance-first.

RentChain should not launch live institution pilot review with tenant data until counsel-reviewed materials exist for the relevant partner category.

## Recommended Next Mission

Recommended:

**Option E: External legal review preparation first**

Suggested scope:

- compile architecture and data-flow packet for counsel
- prepare institution review disclaimer language for review
- prepare partner data handling and retention questions
- prepare consumer reporting, fair housing, insurance, lending, subsidy, and government issue list
- prepare pilot terms checklist
- prepare partner-side AI and secondary-use questions
- prepare counsel review outputs needed before live partner data review

Secondary next mission after legal review preparation:

`strategy/institution-identity-assurance-readiness-v1`

Reason: recipient identity is currently authenticated-email based, not organization-verified. Stronger identity assurance should follow legal review because required assurance level depends on partner type and compliance posture.

## Regression Risks

No product behavior changed in this mission. Future implementation work should watch for:

- institution-facing copy drifting into eligibility, approval, underwriting, credit, subsidy, government, or verification claims
- support diagnostics becoming institution-visible
- telemetry or forensics leaking into tenant, recipient, institution, trust export, or public payloads
- downloadable exports being added before retention/revocation and partner terms are resolved
- partner onboarding implying organization verification before it exists
- lifecycle status being represented as legal validity
- support workflows giving legal advice or partner-specific eligibility interpretations

## Acceptance Criteria Review

- Legal/compliance readiness strategy completed.
- Institution-facing risk areas documented.
- Lifecycle and support guarantees documented.
- Governance and privacy boundaries documented.
- Safe versus unsafe operational claims documented.
- Unresolved legal/compliance gaps documented.
- No product behavior changes introduced.
- No institution integrations introduced.
- Next recommended mission identified clearly.
