# Institution Partner Readiness v1

Branch: `strategy/institution-partner-readiness-v1`
Scope: documentation-first institution partner readiness audit, no partner integration

## Executive Summary

RentChain is approaching readiness for controlled pilot institution review operations, but only under the current governed model:

- tenant-mediated institution access
- explicit consent
- authenticated recipient review
- audience and purpose scope
- revocable and expiration-aware access
- lifecycle-governed trust export packages
- metadata-only, view-only review
- controlled tenant-authorized delivery
- support-safe diagnostics
- operator audit timeline reconstruction

RentChain is not ready for institution APIs, provider integrations, downloadable institution exports, automated institution delivery, institution-controlled workflows, public trust profiles, public interoperability, or automated eligibility decisions.

Recommended next mission:

`feat/pilot-institution-review-operations-v1`

Reason: the core review, lifecycle, delivery, session, support, and audit foundations are strong enough to define a tightly controlled pilot operating model. The next step should not be an API or a broad partner rollout. It should define pilot partner eligibility, operating procedures, support obligations, legal/compliance prerequisites, review copy, tenant consent expectations, and operational exit criteria while preserving the existing tenant-mediated review stack.

## Audit Plan

This mission is documentation-first and governance-first.

1. Review institution review invite, delivery, session, lifecycle, support, audit, portable attestation, and institutional trust export foundations.
2. Identify current institution-ready capabilities and operational gaps.
3. Classify realistic near-term partner types, moderate-risk partner types, and premature/high-risk partner types.
4. Define safe institution-facing semantics, prohibited semantics, lifecycle guarantees, support expectations, and metadata boundaries.
5. Recommend the next implementation path without adding integrations, APIs, public exposure, downloads, blockchain/tokenization, automated decisions, or product-scope widening.

## Audit Scope Completed

Reviewed strategy and architecture:

- `docs/strategy/institution-interoperability-readiness-audit-v1.md`
- `docs/strategy/institution-review-invite-operational-qa-v1.md`
- `docs/strategy/institution-access-operational-qa-v1.md`
- `docs/strategy/institution-access-support-admin-readiness-audit-v1.md`
- `docs/architecture/portable-attestation-framework-v1.md`
- `docs/architecture/institutional-trust-export-framework-v1.md`

Reviewed implementation surfaces:

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/institutionReviewSessions/*`
- `rentchain-api/src/lib/institutionTrustExports/*`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/supportConsole/operatorAuditTimeline.ts`
- `rentchain-api/src/lib/supportConsole/buildSupportConsoleResource.ts`
- `rentchain-api/src/routes/supportConsoleRoutes.ts`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.tsx`

## Current Institution-Ready Capabilities

### Tenant-Mediated Access

Institution review begins with tenant action. Access grants require tenant context, recipient email, audience, purpose, expiration, and explicit consent. This is the right foundation for future partner relationships because institutions do not initiate or own trust access.

### Controlled Institution Delivery

The current delivery layer supports tenant-authorized delivery and resend attempts through the existing invite/access stack. Delivery status is tracked as metadata-only state:

- prepared
- sent
- failed
- blocked
- resent
- revoked
- expired

Delivery is blocked when access is revoked, expired, policy-denied, lifecycle-invalid, missing consent, missing recipient email, or not recipient-authenticated. Delivery email remains conservative and does not include trust payloads, raw IDs, downloads, public profile language, approval claims, eligibility claims, or bearer-token authorization.

### Authenticated Recipient Review

Recipient review requires an authenticated recipient context and matching invited email. Possession of a link is not sufficient authorization. Review remains metadata-only, view-only, non-public, and download-disabled.

### Session And Continuity Governance

Recipient review sessions are grant-bound, audience-bound, purpose-bound, recipient-bound, and time-bound. Sessions carry continuity fingerprints that invalidate stale or replayed contexts when grant, consent, package, invite, or delivery lifecycle state changes. Stale sessions require reauthentication. Revoked, expired, or blocked access invalidates active review continuity.

### Trust Export Lifecycle Controls

Institution-visible review depends on lifecycle-governed trust export packages. Active summaries are blocked when source data or package state becomes expired, revoked, superseded, archived, invalidated, blocked, or reverification-required.

### Policy-Gated Metadata Summaries

Portable attestations are exported only through the attestation policy gate. The gate blocks missing consent, audience mismatch, purpose mismatch, expired or revoked consent, revoked source attestations, expired attestations, supersession, reverification requirements, unsupported claims, raw payload flags, support metadata, public exposure, external submission, unsafe evidence, and source mismatch.

### Support-Safe Diagnostics

Support/admin diagnostics are operationally scoped, redacted, metadata-only, and separate from portable trust visibility. They can show lifecycle state, audience, purpose, blocked reason categories, redacted recipient references, and support-safe event timelines without exposing trust payloads.

### Operator Audit Timeline

The operator timeline can reconstruct access grant lifecycle, recipient review lifecycle, recipient session lifecycle, institution review session events, trust export lifecycle, policy-denied states, and operator diagnostic access. Timeline events are metadata-only and do not include trust payloads, provider payloads, raw identity documents, raw property payloads, or downloadable artifacts.

## Operational Gaps Before Real Partnerships

### No Institution Identity Registry

Recipient identity is currently an authenticated email session. RentChain does not yet verify institution organization identity, domains, authorized reviewer rosters, institutional roles, delegated authority, partner contracts, or SSO/organization membership.

This is acceptable for narrow pilots with explicit manual partner operations, but not for production lender, subsidy, government, or automated institution workflows.

### No Partner Onboarding Contract

There is no formal partner onboarding model defining:

- permitted partner type
- permitted use case
- recipient role expectations
- retention expectations
- support contacts
- incident response expectations
- revocation acknowledgement expectations
- data handling terms
- legal/compliance review status
- pilot exit criteria

This must exist before live partnerships.

### No Institution-Specific Schema Contract

Institutional trust packages are generic and institution-readable. They are not yet partner-specific schemas for insurers, lenders, subsidy programs, government programs, or institutional landlords.

This is intentional. Partner-specific schemas should not be introduced until legal/compliance expectations, consent copy, field policy, retention terms, and institution semantics are defined.

### No External Revocation Notification

Revocation and expiration are enforced inside RentChain-controlled surfaces. RentChain does not yet send external revocation notices to partners or require partners to acknowledge revocation.

That is acceptable while review remains RentChain-hosted, view-only, and non-downloadable. It is not enough for downloadable exports, institution APIs, or external storage.

### Limited Institution Support Operations

Support-safe diagnostics exist, but a partner support runbook does not yet define:

- support escalation categories
- operator review permissions
- partner-facing support language
- recipient identity mismatch handling
- delivery failure handling
- audit request handling
- incident logging expectations

### No Institution Legal/Compliance Posture

The current architecture avoids credit, insurance eligibility, subsidy eligibility, government verification, or automated approval semantics. Before partnerships, RentChain still needs legal review around consumer reporting, privacy, consent retention, institutional reliance, anti-discrimination risk, fair housing implications, data retention, and partner terms.

## Lifecycle Guarantees RentChain Can Safely Make Today

RentChain can safely state that, inside RentChain-controlled review surfaces:

- institution review is tenant-mediated
- access requires explicit tenant consent
- recipient review requires authenticated recipient context
- recipient email must match the tenant-authorized recipient
- access is audience-scoped and purpose-scoped
- access has an expiration
- tenant revocation blocks future review
- expired access blocks future review
- policy-denied packages do not render active trust summaries
- lifecycle-invalid trust exports do not render active trust summaries
- review is metadata-only and view-only
- recipient downloads are disabled
- public profiles and public trust URLs are not created
- support/operator views are redacted and metadata-only
- operator diagnostic access is auditable

RentChain should not claim:

- external copies can be recalled after copying or screenshots
- institution recipients are organization-verified
- partner retention is technically enforced outside RentChain
- institutions have acknowledged revocation
- trust metadata is a legal verification result
- trust metadata determines eligibility, approval, underwriting, creditworthiness, subsidy eligibility, or government status

## Revocation And Expiration Guarantees

Current safe guarantees:

- revoked grants stop active recipient review
- expired grants stop active recipient review
- revoked delivery cannot be resent without new tenant-mediated authorization
- expired/revoked invites block review
- lifecycle-inactive packages block review
- stale sessions require reauthentication
- replayed or mismatched session continuity is blocked
- audit events record revoked, expired, blocked, and delivery states without payload contents

Current limitations:

- revocation cannot prevent screenshots, memory, copied text, or external note-taking
- revocation does not notify a partner through an external integration
- partner retention obligations are not yet modeled
- recipient organization identity is not verified beyond authenticated email matching

## Auditability Guarantees

Current auditability is strong enough for narrow pilots:

- tenant access grant events
- invite created, sent, authenticated, revoked, expired, and blocked events
- delivery prepared, sent, failed, blocked, resent, revoked, and expired events
- recipient review opened, blocked, expired, and revoked events
- recipient session started, expired, revoked, blocked, and reauthenticated events
- institution review session lifecycle events
- trust export lifecycle evaluation
- support diagnostics access events
- operator audit timeline reconstruction

Audit data remains metadata-only and operational. It does not become a hidden trust scoring system or a portable trust payload.

Remaining audit gaps before broader partnerships:

- no partner acknowledgement receipts
- no partner organization verification events
- no partner retention acknowledgements
- no partner incident/escalation workflow
- no partner contract status in audit timeline
- no partner-facing audit export policy

## Safe Institution-Facing Semantics

Safe terms:

- tenant-authorized review
- metadata-only review
- view-only review
- institution review session
- audience-scoped
- purpose-scoped
- time-bound
- revocable in RentChain-controlled surfaces
- policy-gated
- lifecycle-governed
- non-public
- not an approval or eligibility decision
- not a credit report
- not a public profile
- not an automated decision

Unsafe terms:

- approved tenant
- eligible tenant
- creditworthy tenant
- insurable tenant
- subsidy eligible
- government verified
- lender approved
- institution certified
- guaranteed tenant
- risk score
- tenant score
- verified tenant
- source of truth
- permanent credential
- public credential
- automated approval

## Metadata Safe For Institution Review

Safe institution-visible metadata is limited to:

- audience
- purpose
- tenant-authorized review context
- expiration timestamp
- revocation status
- lifecycle state
- recipient role label
- organization label when tenant-provided
- claim category labels
- claim lifecycle labels
- consent reference metadata
- redactions and disclaimers
- included/excluded claim categories and safe reasons
- non-authority disclaimers
- metadata-only session status

This metadata should remain visible only through authenticated, tenant-authorized, non-public review flows.

## Metadata Institutions Should Never Receive

Institution recipients should never receive:

- raw government ID images
- biometric or liveness payloads
- SIN/SSN equivalents
- raw provider payloads
- raw screening reports
- bureau payloads
- raw banking or open-banking payloads
- raw title, registry, or property-provider payloads
- raw legal document files unless a separate explicit document workflow exists
- support-console notes
- operator private notes
- internal governance notes
- internal policy decision internals beyond safe blocked categories
- hidden confidence calculations
- tenant scoring or risk scoring outputs
- access token hashes
- session fingerprints
- raw internal trust package payloads
- downloadable institution trust exports
- automated eligibility, credit, insurance, subsidy, government, or approval conclusions

## Partner Type Readiness

| Partner Type | Classification | Finding |
| --- | --- | --- |
| Institutional landlords | Realistic near-term | Best fit for controlled pilots because the use case resembles existing rental review. Still requires partner terms, conservative copy, and no automated decisions. |
| Advocate/caseworker-assisted organizations | Realistic near-term with constraints | Good fit when the tenant wants help navigating housing workflows. Must clarify that the recipient is assisting the tenant, not independently controlling trust metadata. |
| Nonprofit housing support organizations | Realistic near-term with constraints | Similar to advocate/caseworker use. Needs consent clarity, retention boundaries, and careful support procedures. |
| Insurers | Moderate risk | Metadata-only review may be useful, but insurance semantics can imply eligibility or underwriting. Requires legal/compliance review and partner terms before pilots. |
| Lenders | Premature/high risk | Lending can trigger creditworthiness and underwriting interpretations. Requires stronger legal review, institution identity, data retention policy, and consumer-reporting guardrails. |
| Subsidy programs | Premature/high risk | Program eligibility semantics are sensitive. Requires program-specific consent, statutory purpose mapping, retention terms, and compliance review. |
| Government housing programs | Premature/high risk | Needs verified organization identity, role authorization, legal basis, retention rules, audit obligations, and revocation acknowledgement expectations. |

## Institution Onboarding Expectations

Near-term pilot partners should expect:

- manual onboarding
- no API access
- no downloadable trust package
- no automated institution delivery
- no institution-initiated access
- no partner-managed tenant profiles
- tenant-mediated invite/delivery only
- authenticated recipient review by invited email
- view-only metadata review
- time-bound access
- revocation-aware access inside RentChain
- conservative non-decision language
- support through RentChain operational channels

Partners should not expect:

- eligibility determinations
- underwriting support
- automated decisions
- bulk export
- public verification pages
- permanent credentials
- integration credentials
- data warehouse access
- raw document or provider payloads
- institution-owned identity graphs

## Operational Support Expectations

Before live pilots, RentChain should define support runbooks for:

- tenant consent questions
- wrong recipient email
- recipient authentication failures
- delivery failure
- expired access
- revoked access
- policy-denied summary
- stale or replay-blocked session
- recipient organization label disputes
- partner data-retention questions
- audit trail review
- incident reporting

Support tooling should remain:

- metadata-only
- redacted
- non-exportable by default
- operator-attributed
- operationally scoped
- separate from portable trust visibility

## Legal And Compliance Concerns

Open concerns before partnerships:

- whether any partner use case approaches consumer reporting or credit decisioning
- whether insurance review language could be treated as underwriting support
- whether subsidy or government workflows require statutory notices
- consent retention periods
- partner data retention and deletion obligations
- anti-discrimination and fair housing risk
- recipient authority and role validation
- audit log retention and disclosure policy
- incident notification obligations
- AI-assisted review constraints if institutions use automated tooling outside RentChain

These concerns do not block internal controlled review foundations. They do block broad partnership rollout, institution APIs, downloadable exports, and automated workflows.

## Interoperability Expectations

Realistic near-term interoperability:

- tenant-mediated email delivery to a named recipient
- authenticated RentChain-hosted review
- metadata-only review summary
- lifecycle-aware blocking
- support-safe diagnostics
- operator audit timeline
- manual partner operations

Not realistic yet:

- institution APIs
- partner SSO
- verified institution accounts
- external revocation webhooks
- downloadable partner export packets
- partner-managed access grants
- institution-triggered workflows
- automated underwriting, eligibility, subsidy, government, or approval workflows

## Future AI-Assisted Institution Workflows

If future institutions use AI-assisted review, RentChain should require:

- no model receives raw provider payloads from RentChain
- no model receives support/internal metadata
- no automated approval or rejection based on RentChain trust summaries
- tenant consent language discloses the partner review context
- partner terms restrict retention and secondary use
- outputs remain institution-side and are not represented as RentChain decisions
- audit records distinguish RentChain-hosted review from partner-side analysis

RentChain should not build AI-assisted institution decisioning inside this trust review stack without a separate governance mission.

## Partnership Readiness Path

### Option A: Pilot Institution Review Operations

Recommended next.

Scope should define pilot procedures, partner eligibility, supported partner types, support runbooks, legal/compliance prerequisites, consent copy boundaries, issue escalation, and exit criteria. It should not add APIs, downloads, automated decisions, or partner-controlled workflows.

### Option B: Institution Review Session Observability

Useful after or alongside pilot planning if operators need stronger dashboards for session continuity, delivery success, stale sessions, and recipient authentication outcomes.

### Option C: Security Session Telemetry Foundations

Useful if pilots require stronger anomaly detection for repeated mismatches, stale sessions, replay-blocked attempts, or suspicious delivery patterns. Must remain metadata-only.

### Option D: Additional Governance/Support Hardening

Appropriate if pilot planning identifies gaps in support runbooks, redaction, operator permissions, retention, or incident handling.

### Option E: Future Institution API Readiness Planning

Premature for implementation. Suitable only as a later strategy audit after controlled pilot operations produce enough operational evidence.

## Is RentChain Ready For Controlled Pilot Partnerships?

Readiness level: **approaching readiness for controlled pilot institution review operations.**

RentChain is ready to plan pilots for:

- institutional landlord review
- advocate/caseworker-assisted review
- nonprofit housing support review

RentChain may be ready to explore insurer pilots after legal/compliance review and partner terms.

RentChain is not ready for lender, subsidy, or government production partnerships.

RentChain is not ready for:

- institution APIs
- automated institution delivery
- downloadable institution exports
- institution-controlled workflows
- automated eligibility systems
- public trust publishing

## Permanent Boundaries

Institution partnerships must remain:

- tenant-mediated
- consent-scoped
- audience-scoped
- purpose-scoped
- revocable
- expiration-aware
- lifecycle-governed
- policy-gated
- metadata-only by default
- non-public
- support-safe
- auditable

Institution partnerships must not become:

- institution-controlled trust ownership
- automated eligibility infrastructure
- downloadable permanent credential distribution
- public trust sharing
- hidden tenant scoring
- a credit bureau
- a public trust network
- a decentralized identity marketplace

## Recommended Next Mission

Recommended:

`feat/pilot-institution-review-operations-v1`

Suggested scope:

- define pilot partner eligibility
- define allowed partner types and prohibited partner types
- define manual onboarding checklist
- define support runbooks
- define legal/compliance prerequisites
- define tenant and recipient copy constraints
- define partner data handling expectations
- define audit and incident procedures
- define readiness gates for any future institution API planning

Do not proceed next with institution APIs, provider integrations, downloadable institution exports, public profiles, automated decisions, or partner-controlled workflows.

## Remaining Risks

- Browser/manual QA was not performed as part of this documentation mission.
- Recipient identity remains authenticated-email based, not institution-verified.
- Recipient organization labels remain tenant-provided and not authoritative.
- Legal/compliance review for insurer, lender, subsidy, and government workflows is unresolved.
- External recipient behavior after viewing cannot be technically controlled.
- Partner data retention and deletion terms are not yet modeled.
- External revocation notification and acknowledgement do not exist.
- Institution-specific schemas are not yet defined.

## PR Readiness Summary

This mission is documentation-only and does not change product behavior.

It confirms RentChain is approaching readiness for controlled pilot institution review operations while remaining not ready for institution APIs, provider integrations, downloadable exports, automated delivery, public trust sharing, institution-controlled workflows, or automated eligibility decisions.
