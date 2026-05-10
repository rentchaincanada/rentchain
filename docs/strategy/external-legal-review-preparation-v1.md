# External Legal Review Preparation v1

Branch: `strategy/external-legal-review-preparation-v1`
Scope: documentation-first external legal/compliance review preparation package, no legal advice and no product behavior changes

## Non-Legal-Advice Notice

This package organizes RentChain's current institution-review architecture, governance posture, operational assumptions, and open legal/compliance questions for future external counsel review. It is not legal advice, does not approve a pilot launch, does not create legal contracts, and does not replace jurisdiction-specific review by qualified counsel.

## Executive Summary

RentChain is structurally ready for external legal/compliance review of controlled pilot institution review operations.

The platform now has a clear governance-first operating model:

- tenant-mediated institution review
- explicit tenant authorization
- authenticated named-recipient review
- audience and purpose scope
- revocable and expiration-aware RentChain-hosted access
- lifecycle-governed trust export continuity
- metadata-only, view-only recipient review
- policy-gated summaries
- controlled tenant-mediated delivery
- recipient orientation/onboarding copy
- support-safe diagnostics
- operator audit timeline reconstruction
- internal-only security telemetry, access forensics, and retention governance

The platform is not ready to launch institution APIs, downloadable institution exports, institution-controlled trust workflows, public trust profiles, automated eligibility systems, regulated adjudication workflows, or partner-side reliance claims without external legal/compliance review.

Recommended next mission:

**Option D: External legal review execution first**

Reason: the current package gives counsel enough structure to review data flows, role definitions, disclosures, retention posture, non-decision language, partner-type risks, and pilot terms. A pilot workspace, identity assurance build, or broader engagement readiness update should wait until external counsel has reviewed the package and identified required changes.

## Legal-Review Preparation Plan

This mission is documentation-first and legal-preparation-focused.

1. Review current legal/compliance readiness, partner engagement, runbook, telemetry retention, public legal/privacy, and implementation-boundary materials.
2. Summarize platform capabilities that exist today.
3. Summarize governance, lifecycle, revocation, expiration, metadata, support, auditability, telemetry, and retention boundaries.
4. Identify unresolved legal/compliance and operational policy questions.
5. Prioritize external legal review areas.
6. Recommend the next mission without implementing contracts, integrations, APIs, public trust exposure, downloads, automated decisions, or product behavior changes.

## Audit Scope Completed

Reviewed strategy and operations artifacts:

- `docs/strategy/institution-legal-and-compliance-readiness-v1.md`
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

Reviewed implementation surfaces for boundary confirmation:

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/securityTelemetry/securityTelemetryRetention.ts`
- `rentchain-api/src/lib/supportConsole/securityAccessForensics.ts`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.tsx`
- `rentchain-frontend/src/api/recipientTrustReview.ts`
- `rentchain-frontend/src/api/tenantInstitutionAccess.ts`
- `rentchain-frontend/src/api/supportConsoleApi.ts`

No product behavior, API route, schema, legal contract system, institution integration, public trust exposure, downloadable export, or automated decision flow was changed.

## Current Platform Capability Summary

### Tenant-Mediated Institution Review

Institution review begins with tenant authorization. Access is scoped to a named recipient email, audience, purpose, expiration, consent state, access grant lifecycle, recipient session state, and policy-gated trust package readiness.

Current capability:

- tenant prepares or sends an institution review invitation/delivery through the existing access stack
- review is bound to the tenant-authorized recipient email
- review is non-public and RentChain-hosted
- review is metadata-only and view-only

Counsel review focus:

- whether tenant authorization language is sufficient for each pilot partner type
- whether partner-facing materials need additional acknowledgement or terms
- whether recipient organization authority requires additional verification before pilots

### Controlled Institution Delivery

Tenant-mediated delivery helps send an authenticated review invitation to a named recipient. Delivery email copy is conservative and does not include trust payloads, raw IDs, downloads, public profile language, approval claims, eligibility claims, or bearer-token authorization.

Current capability:

- delivery status can be tracked as prepared, sent, failed, blocked, resent, revoked, or expired
- delivery is blocked when access is revoked, expired, policy-denied, lifecycle-invalid, missing consent, or missing a recipient email
- the link is an entry point, not authorization

Counsel review focus:

- email and invitation language
- retention and secondary-use obligations for recipients
- whether delivery constitutes a regulated disclosure for specific partner categories

### Authenticated Recipient Review

Recipient review requires authentication and matching invited email. Possession of an invite or delivery link is not enough to view review metadata.

Current capability:

- unauthenticated access is rejected
- wrong-recipient access is rejected
- revoked or expired access is rejected
- policy-denied and lifecycle-invalid review is rejected
- recipient onboarding/orientation appears before trust metadata is shown

Counsel review focus:

- whether email-session identity is enough for proposed partner pilots
- whether institution identity assurance or organization-role validation is required before live use
- whether recipient acknowledgement language is sufficient

### Institution Review Onboarding

The recipient orientation explains tenant authorization, authenticated access, metadata-only scope, revocation, expiration, no downloads, no public profile, and non-decision semantics.

Current capability:

- recipient must acknowledge review scope before first review
- onboarding events are metadata-only
- review remains blocked or limited until acknowledgement

Counsel review focus:

- acknowledgement text
- disclaimer sufficiency
- whether acknowledgement creates any unintended contractual implication
- whether accessibility/plain-language review is required

## Governance Boundary Summary

RentChain institution workflows are designed to remain:

- tenant-mediated
- authenticated
- revocable
- expiration-aware
- metadata-only
- lifecycle-governed
- policy-gated
- support-safe
- audit-safe
- non-public
- non-downloadable

RentChain institution workflows must not become:

- institution-controlled trust ownership
- public trust portability
- downloadable trust repositories
- automated eligibility systems
- tenant scoring systems
- hidden risk scoring
- institution-visible security telemetry
- public reputation infrastructure
- regulated financial adjudication
- legal certification or verification authority

## Lifecycle Guarantee Summary

Inside RentChain-controlled review surfaces, current lifecycle behavior supports:

- active access may show metadata-only review after authentication and acknowledgement
- expired access blocks active review
- revoked access blocks active review
- blocked access returns no active trust summary
- policy-denied summaries are not rendered as active review
- lifecycle-invalid trust export packages are blocked
- stale or mismatched sessions require reauthentication
- replayed or invalidated session continuity is blocked
- superseded, archived, invalidated, or reverification-required trust packages do not remain current active review

Legal review questions:

- How should RentChain describe lifecycle guarantees without implying legal validity?
- What partner-facing disclosure is required for expiration and revocation limits?
- What wording should explain that revocation cannot control screenshots, notes, memory, or external copies?
- What minimum audit retention is required for lifecycle events?

## Revocation And Expiration Summary

Current safe guarantee:

- Tenant revocation or expiration blocks future RentChain-hosted review and prevents active trust summary rendering in RentChain-controlled surfaces.

Current limitation:

- RentChain does not technically control information already observed, copied, screenshotted, remembered, or stored outside RentChain.

Counsel should review:

- partner revocation acknowledgement language
- external deletion/retention obligations
- secondary-use restrictions
- whether any partner categories require revocation notice receipts
- incident notification duties if revoked or expired access is attempted

## Metadata Handling Summary

### Institution-Visible Metadata

Institution-facing review should remain limited to safe, audience-scoped metadata such as:

- tenant-authorized review context
- audience
- purpose
- recipient role label
- tenant-provided organization label when present
- expiration timestamp
- revocation/lifecycle status
- policy-gated claim category labels
- claim lifecycle labels
- consent reference metadata
- redactions and disclaimers
- metadata-only review/session status
- safe included/excluded claim category reasons

This metadata is visible only through authenticated, tenant-authorized, non-public review flows.

### Excluded Metadata And Payloads

Institution review must never expose:

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

Counsel should review:

- whether the safe metadata list is appropriate for each pilot partner type
- whether any category requires additional consent or notice
- whether category labels could be interpreted as regulated decision support
- whether institution-visible excluded-claim reasons need further redaction

## Telemetry And Retention Summary

Current telemetry posture:

- security/session telemetry is classified as `security_session_internal`
- telemetry is internal-only, support-safe, non-portable, and non-exportable
- raw IP addresses are not broadly exposed in support summaries
- full user agents, precise geolocation, device fingerprinting, behavioral profiles, and risk scores are not part of the governed telemetry model
- telemetry must not appear in tenant views, recipient review payloads, institution review payloads, trust exports, portable attestations, public pages, or downloadable artifacts

Current retention posture:

- policy version: `security_telemetry_retention.v1`
- active retention: 180 days
- archive after: 180 days
- retention expiry: 365 days
- purge-pending grace: 30 days after retention expiry
- lifecycle states: active, archived, retention-expired, purge-pending, purged
- destructive purge job is not implemented

Counsel should review:

- whether retention windows are appropriate by jurisdiction and record type
- whether internal audit records require different retention from security telemetry
- whether destructive purge automation is required before pilots
- what partner-facing retention/disposal statement is acceptable
- whether any telemetry should be retained for incident or legal hold handling

## Supportability And Auditability Summary

Current supportability:

- support can diagnose authentication failures, wrong-recipient attempts, expired access, revoked access, policy-denied review, lifecycle invalidation, delivery failures, stale sessions, replay-blocked attempts, and redacted operational diagnostics
- support-safe diagnostics are metadata-only, redacted, and operationally scoped
- support must not browse or disclose raw trust payloads

Current auditability:

- tenant grant lifecycle events are tracked
- invite and delivery lifecycle events are tracked
- recipient review and session events are tracked
- institution review session lifecycle is represented
- trust export lifecycle and policy-denied states are visible operationally
- operator diagnostic access can be reconstructed
- security/access forensics summarize blocked, wrong-recipient, revoked, expired, replay, stale-session, and operator diagnostic patterns without raw payloads

Counsel should review:

- whether current auditability is sufficient for pilots
- whether partner-facing audit summaries are prohibited or require a separate process
- what incident escalation records must be retained
- whether support language should be approved before live partner support

## Existing Public Legal/Privacy Posture

Current public posture already states that RentChain:

- provides governed operational infrastructure for rental workflows
- does not operate as a consumer reporting agency or credit bureau
- does not act as a government authority, collections service, or legal decision-maker
- does not make rental decisions
- does not provide legal advice
- does not create automatic approvals, public scoring, public blacklists, or autonomous enforcement
- does not sell personal information
- shares tenant information only with authorization or valid legal basis
- does not provide unrestricted public-sector exports, unrestricted portfolio exposure, or uncontrolled external synchronization

Counsel should review:

- whether public privacy/terms language is sufficient for controlled institution review pilots
- whether pilot-specific partner terms, recipient notices, or tenant disclosures are required
- whether consumer reporting and screening language should be updated or segmented from institution review language

## Institution-Facing Semantics

Safe semantics for counsel review:

- tenant-authorized review
- tenant-mediated review
- authenticated recipient
- named recipient
- metadata-only review
- view-only review
- purpose-scoped
- audience-scoped
- time-bound access
- revocable access in RentChain-controlled surfaces
- lifecycle-governed review
- policy-gated summary
- non-public review
- not an approval or eligibility decision
- not a credit report
- not a public profile
- not an automated decision

Semantics intentionally avoided:

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

Counsel should review whether the safe terms remain safe for insurer, lender, subsidy, government, institutional landlord, nonprofit, and advocate/caseworker contexts.

## Pilot Operational Assumptions

The external legal review should assume initial pilots, if later approved, would be:

- small-scale
- manual and controlled
- RentChain-hosted
- tenant-mediated
- invitation-based
- named-recipient only
- authenticated by recipient email
- metadata-only and view-only
- non-downloadable
- non-public
- revocable and time-bound
- supportable through runbook-backed operational processes
- not API-based
- not automated decisioning
- not institution-controlled
- not a regulated adjudication workflow

Any departure from these assumptions should trigger new legal/compliance review.

## Unresolved Legal/Compliance Questions

Counsel should review and answer:

1. Does the controlled institution review workflow create consumer reporting exposure for any partner type?
2. Does lender-facing review require additional FCRA/consumer reporting or Canadian credit-reporting analysis?
3. Does insurer-facing review create underwriting, eligibility, or insurance regulatory exposure?
4. Do subsidy or government workflows require statutory notices, accessibility requirements, procurement/privacy review, or program-specific legal basis?
5. Is current tenant authorization sufficient for metadata-only institution review?
6. Is recipient acknowledgement sufficient, or are partner terms required before live pilots?
7. What partner retention, deletion, secondary-use, and onward-disclosure obligations are required?
8. What incident notification duties apply to wrong-recipient, replay, stale-session, revoked, or expired access events?
9. What public privacy/terms changes are needed before pilots?
10. What disclaimer language should be approved for institution-facing recipients?
11. What claims about revocation and expiration can be made safely?
12. What audit records must be retained, and for how long?
13. Are current security telemetry retention windows appropriate?
14. How should legal hold or dispute hold interact with telemetry purge-pending states?
15. What identity assurance level is required for each partner category?
16. What restrictions should apply if a partner uses AI-assisted review outside RentChain?
17. What accessibility/plain-language standards should apply to recipient onboarding and disclosures?
18. Are additional consent records needed for insurer, lender, subsidy, or government purposes?
19. What operational support obligations can RentChain promise without creating unacceptable liability?
20. What pilot exit criteria or suspension rights should be included in partner materials?

## Unresolved Operational Policy Questions

Before live pilots, RentChain should define:

- approved partner categories for first pilots
- partner contact and escalation requirements
- authorized recipient roster requirements
- expiration window policy by partner type
- revocation acknowledgement procedure
- partner retention/deletion acknowledgement procedure
- support hours and escalation levels
- incident severity definitions
- screenshot/copying policy language
- partner-side AI use restrictions
- audit request handling procedure
- legal hold process for telemetry and audit records
- approval process for any partner-facing copy changes
- pilot suspension and termination procedure

## External Legal Review Priorities

Priority 1: Platform role and non-decision posture

- confirm RentChain can describe itself as governed review infrastructure
- approve language that rejects approval, eligibility, credit, underwriting, subsidy, government, or automated decision claims

Priority 2: Consumer reporting and fair housing risk

- analyze lender and landlord interpretations
- confirm whether consumer reporting disclaimers and operating restrictions are sufficient
- review anti-discrimination/fair housing implications

Priority 3: Metadata, consent, and disclosure boundaries

- confirm safe institution-visible metadata
- review excluded data categories
- approve tenant consent and recipient acknowledgement language

Priority 4: Partner retention, deletion, and secondary use

- define partner obligations
- define external recall limitations
- define revocation and expiration disclosure language

Priority 5: Telemetry, retention, and audit records

- approve retention classes and windows
- define legal/dispute hold handling
- confirm internal-only telemetry positioning

Priority 6: Partner-type readiness

- classify institutional landlord, advocate/caseworker, nonprofit support, insurer, lender, subsidy, and government pilots
- identify partner types that are prohibited until further controls exist

## Counsel Review Materials To Prepare

The following materials should be packaged for counsel outside this mission:

- architecture summary of institution review flow
- data-flow diagram for tenant authorization, invite/delivery, recipient authentication, onboarding, review, support, audit, telemetry, and retention
- sample institution invite/delivery email copy
- sample recipient onboarding acknowledgement copy
- sample recipient review disclaimer copy
- support runbook excerpts for revoked, expired, wrong-recipient, replay/stale-session, and lifecycle-invalid access
- metadata field inventory for institution-visible review
- excluded-data inventory
- telemetry and retention policy summary
- partner-type classification table
- proposed pilot operating assumptions
- open legal question list

This mission creates the written preparation package, not the external counsel packet artifacts themselves.

## Readiness Decision

Readiness level: **ready for external legal/compliance review; not ready for live institution pilots requiring regulated reliance.**

RentChain can proceed to external legal review using this package as the preparation baseline.

RentChain should not proceed to live partner data review, institution APIs, downloadable exports, institution-controlled workflows, automated eligibility systems, or regulated adjudication operations until counsel-reviewed boundaries are complete.

## Recommended Next Mission

Recommended:

**Option D: External legal review execution first**

Suggested scope:

- compile counsel packet from this preparation package
- review privacy/terms posture
- review institution-facing disclaimers
- review tenant consent and recipient acknowledgement language
- review partner-type classifications
- review telemetry retention and audit retention questions
- produce counsel issue log and required product/documentation changes

Secondary mission after external review:

`strategy/institution-identity-assurance-readiness-v1`

Reason: current recipient identity is authenticated-email based and not organization-verified. External legal review should determine the level of organization identity assurance needed before building that layer.

## Regression Risks

No product behavior changed in this mission. Future work should guard against:

- presenting this package as legal advice
- launching live pilots before counsel-reviewed terms and disclaimers exist
- implying institution identity verification beyond email authentication
- allowing downloadable exports before partner retention/revocation terms exist
- exposing telemetry, forensics, support diagnostics, or internal audit details to institutions
- changing public copy into eligibility, approval, underwriting, credit, subsidy, government, or automated decision language
- treating lifecycle state as legal validity rather than review availability

## Acceptance Criteria Review

- External legal review preparation package completed.
- Platform and governance summaries documented.
- Lifecycle and support guarantees documented.
- Telemetry and retention posture documented.
- Unresolved legal/compliance questions documented.
- External legal review priorities documented.
- No product behavior changes introduced.
- No institution integrations introduced.
- Next recommended mission identified clearly.
