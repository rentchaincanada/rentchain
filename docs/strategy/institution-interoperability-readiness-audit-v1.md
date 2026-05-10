# Institution Interoperability Readiness Audit v1

Branch: `strategy/institution-interoperability-readiness-audit-v1`
Scope: documentation-first interoperability readiness audit, no institution integration

## Executive Summary

RentChain is approaching readiness for future institution interoperability, but only through a narrow, tenant-mediated, authenticated, metadata-only review model.

The current architecture has strong prerequisites:

- tenant-mediated institution access grants
- recipient-authenticated, session-bound trust review
- institution review session summaries
- portable attestation policy gates
- institutional trust export package composition
- trust export lifecycle controls
- support-safe diagnostics
- operator audit timeline reconstruction
- governance and redaction utilities
- non-public, view-only recipient surfaces

The platform is not ready for live institution APIs, provider integrations, public trust URLs, downloadable institution exports, automated eligibility workflows, or institution-controlled trust ownership.

Recommended next mission:

`feat/institution-review-invite-flow-v1`

Reason: the safest next interoperability step is not an API. It is a controlled invite workflow that binds a tenant-approved access grant to an authenticated recipient review session with clear institution audience, purpose, expiration, revocation, and audit semantics. This preserves the current governance model while making future insurer, lender, subsidy, government, and institutional landlord workflows easier to operationalize.

## Audit Plan

This audit followed the required documentation-first guardrails:

1. Review current institution review, tenant-mediated access, recipient review, export, lifecycle, audit, and governance systems.
2. Identify interoperability strengths and gaps without modifying product behavior.
3. Classify institution workflow readiness by risk.
4. Define lifecycle, session, revocation, reverification, audit, and metadata boundaries.
5. Recommend the next implementation path.

No institution/provider integration, public trust exposure, share-package widening, downloadable institution export, blockchain/tokenization, or automated decisioning was implemented.

## Audit Scope Completed

Reviewed strategy and architecture:

- `docs/architecture/portable-attestation-framework-v1.md`
- `docs/architecture/institutional-trust-export-framework-v1.md`
- `docs/architecture/institution-onboarding-readiness-v1.md`
- `docs/architecture/interoperability-adapter-layer-v1.md`
- `docs/architecture/operator-review-session-v1.md`
- `docs/strategy/trust-export-recipient-access-readiness-audit-v1.md`
- `docs/strategy/recipient-authenticated-access-readiness-audit-v1.md`
- `docs/strategy/institution-access-operational-qa-v1.md`
- `docs/strategy/institution-access-support-admin-readiness-audit-v1.md`

Reviewed implementation surfaces:

- `rentchain-api/src/lib/institutionReviewSessions/*`
- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/institutionTrustExports/*`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/governance/platformGovernance.ts`
- `rentchain-api/src/lib/institutionOnboarding/*`
- `rentchain-api/src/services/institutional/*`

## Current Interoperability Strengths

RentChain already has the right internal shape for controlled future interoperability.

### Tenant-Mediated Control

Institution access starts from a tenant-controlled access grant. Grants are scoped to recipient email, audience, purpose, expiration, consent, and policy-gated trust package metadata.

This is the correct foundation. Future institutions should not initiate trust access independently of tenant authorization.

### Recipient Authentication

Recipient trust review uses authenticated recipient context and compares the authenticated email to the tenant-approved recipient email. Possession of a URL is not treated as authentication.

Current review remains view-only and metadata-only.

### Session Governance

Recipient review sessions are modeled separately from access grants. Sessions are time-bound, authenticated, view-only, non-public, and download-disabled. Active sessions are invalidated when grants are revoked, expired, or blocked.

This provides a base for future institution review sessions, but it does not yet verify institution organization identity.

### Institution Review Session Model

`institutionReviewSessions` adds audience, purpose, recipient role, lifecycle state, access grant linkage, trust export linkage, recipient session linkage, and metadata-only event summaries.

The model supports insurers, lenders, institutional landlords, subsidy programs, government review, advocate/caseworker review, and auditors without creating institution accounts or integrations.

### Policy-Gated Trust Packages

Portable attestations and institutional trust export packages enforce:

- consent scope
- audience scope
- purpose scope
- expiration
- revocation
- supersession
- reverification requirements
- retention class
- raw payload exclusion
- support/internal metadata exclusion
- public exposure blocking
- external submission blocking

This is a strong prerequisite for institution-readable interoperability.

### Support And Operator Safety

Support diagnostics and audit timeline patterns are metadata-only, redacted, operationally scoped, and separate from portable trust payloads. Operator review sessions and audit events are additive and do not mutate source trust records.

This reduces the risk that institution interoperability becomes broad internal trust browsing.

## Current Interoperability Gaps

### No Institution Identity Model

Recipient identity is currently an authenticated email session. There is no verified institution account, institution domain binding, organization authorization, role claim, or partnership registry.

This is acceptable for narrow tenant-mediated review, but not enough for lender, subsidy, or government workflows.

### No Institution Invite Flow

The current model can create tenant-mediated access grants and recipient sessions, but it does not yet provide a first-class invite process for institution reviewers.

Missing pieces:

- invite issuance and acceptance semantics
- invite expiration and resend behavior
- recipient organization label confirmation
- review-session bootstrapping
- tenant-visible invite status
- support-safe invite diagnostics

### No Institution-Specific Schema Contract

Institutional trust export packages are institution-readable in a generic way. They are not yet packaged into insurer, lender, subsidy, government, or institutional landlord review schemas with field-level audience policies.

This should remain future work until institution partners and compliance expectations are clearer.

### No External Revocation Notification

Revocation is enforceable inside RentChain-controlled views. It does not notify external institutions because no external delivery exists.

This is correct today. Future integrations must define revocation notifications before any automated external delivery.

### No Recipient Download Governance

Recipient review is view-only. Downloadable institution exports remain intentionally absent.

Download governance would require export receipts, legal copy, explicit recipient retention policy, tenant acknowledgement that external copies cannot be recalled, and institution terms.

### Limited Institution Workflow Semantics

The platform carefully avoids approval, eligibility, creditworthiness, insurability, ownership, and government verification language. Future workflows will need audience-specific copy and legal review to preserve this boundary.

## Institution Workflow Readiness Ranking

| Workflow | Readiness | Risk | Finding |
| --- | --- | --- | --- |
| Institutional landlord review | Safest first adopter | Moderate | Similar to existing recipient review. Needs invite flow, organization/domain labeling, and conservative copy. |
| Advocate/caseworker-assisted review | Safe with constraints | Moderate | Tenant-mediated assistance fits the model, but recipient role and consent copy must make agency boundaries clear. |
| Insurer review | Approaching readiness | Moderate | Metadata-only review is plausible, but no insurer API, underwriting claim, or automated eligibility language should be introduced. |
| Auditor review | Approaching readiness | Moderate | Strong fit for metadata-only audit packages, but needs purpose-scoped evidence and operator auditability. |
| Lender review | Not first | High | High risk of creditworthiness or underwriting interpretation. Needs legal/compliance review and stronger institution identity. |
| Subsidy program review | Not first | High | Program eligibility semantics are sensitive. Needs program-specific consent, retention, revocation, and legal review. |
| Government housing review | Premature | High | Requires stronger recipient/institution verification, statutory purpose mapping, retention policy, and partnership readiness. |
| Institution-safe trust package review | Safe internal foundation | Moderate | Existing packages are useful for review, but should not become downloadable or API-delivered yet. |

## Safe Institution Semantics

Safe language:

- tenant-authorized review
- metadata-only trust summary
- audience-scoped
- purpose-scoped
- time-bound
- revocable in RentChain-controlled surfaces
- policy-gated
- view-only
- not a decision
- not a credit report
- not a verification authority

Unsafe or misleading language:

- approved tenant
- eligible tenant
- creditworthy tenant
- insured/insurable tenant
- government verified
- lender approved
- subsidy eligible
- owner verified
- KYC approved
- institution certified
- guaranteed property or tenancy
- source of truth

## Metadata Safe For Institution Review

Safe metadata should remain minimal and audience-scoped:

- access grant id
- audience
- purpose
- recipient role
- tenant-authorized consent state
- expiration and revocation state
- review session lifecycle
- policy-gated claim category labels
- claim lifecycle state
- consent expiry
- redaction and disclaimer list
- audit-safe opened, blocked, revoked, expired, or session events
- export package schema version
- policy gate version where available

This metadata should be visible only through authenticated, non-public, tenant-authorized workflows.

## Metadata That Should Never Become Institution-Visible

Institution recipients should never receive:

- raw government ID scans
- biometric or liveness payloads
- SIN/SSN equivalents
- raw provider payloads
- raw screening reports or bureau payloads
- banking credentials or open-banking payloads
- raw title or registry payloads
- support-console notes
- operator private notes
- unpublished governance metadata
- internal scoring internals
- hidden confidence calculations
- access token hashes
- tenant internal ids when not required for the review
- raw document URLs outside explicitly consented document workflows
- public trust profile controls
- automated approval, eligibility, credit, insurance, subsidy, or government decision outputs

## Lifecycle Expectations

Future interoperability must enforce lifecycle checks on every institution-visible view:

- active grants may show metadata-only summaries
- expired grants must show no active trust data
- revoked grants must show no active trust data
- blocked grants must show no active trust data
- superseded packages must not be treated as current
- archived packages must remain audit-visible only
- reverification-required trust must block active institution review
- updated source trust should require fresh package evaluation

The lifecycle source of truth should remain RentChain-controlled grant, session, export, and attestation state. Institutions should not own or override lifecycle state.

## Revocation And Reverification Expectations

Revocation should propagate inside RentChain-controlled surfaces by:

- invalidating active recipient sessions
- blocking active grant review
- preventing trust summary rendering
- recording metadata-only audit events
- showing tenant-visible and support-safe status

Reverification should:

- block export-ready summaries
- invalidate institution review continuity
- require tenant-visible explanation
- preserve historical audit metadata without exposing stale trust as current

Future external delivery must not proceed until revocation notification, delivery receipts, and institution retention rules exist.

## Session And Access Expectations

Safe institution review sessions should be:

- tenant-mediated
- recipient-authenticated
- grant-bound
- audience-bound
- purpose-bound
- time-bound
- revalidated on every view
- revocation-aware
- expiration-aware
- view-only by default
- download-disabled by default
- non-public
- audit-logged

Signed links without recipient authentication should not become the primary institution access model.

## Institution-Facing Auditability

Minimum auditability required before broader interoperability:

- tenant grant created
- recipient invite created or sent
- recipient authenticated
- review session started
- review session opened
- review session expired
- review session revoked
- review blocked with machine-readable reason
- package lifecycle evaluated
- package superseded or invalidated
- support/admin diagnostic access opened
- operator review opened or closed

Audit events must remain metadata-only and must not log raw trust payloads.

## Operator Workflow Requirements

Operators need diagnostic visibility into:

- grant lifecycle
- recipient review status
- session lifecycle
- audience and purpose
- blocked reason categories
- revocation and expiration state
- policy-denied categories
- timeline reconstruction

Operators should not browse portable attestation contents, raw trust payloads, raw provider payloads, private tenant documents, or hidden institution scoring outputs.

## Future Interoperability Model Options

### Option A: Tenant-Mediated Institution Delivery

Risk: moderate.

This would allow a tenant to authorize a controlled institution review package and deliver an invite or notification to a recipient. It should remain metadata-only, authenticated, view-only, revocable, and non-public.

This is viable after an invite-flow foundation exists.

### Option B: Institution Review Invite Flow

Risk: lowest next step.

This would formalize invite lifecycle without creating institution APIs. It can bind tenant grants to recipient sessions, support resend/expiry/revocation, and keep all access inside RentChain-controlled views.

This is the recommended next mission.

### Option C: Recipient Authenticated Review Sessions v2

Risk: moderate.

Useful if the current session model needs stronger reauthentication, session receipts, or per-review state before invites. It should not introduce downloads or integrations.

### Option D: Additional Governance/Lifecycle Hardening

Risk: low.

Appropriate if future QA finds lifecycle gaps, audit event gaps, or support redaction gaps. Current foundations are strong enough to proceed to invite modeling.

### Option E: Institution/Provider Partnership Readiness

Risk: high.

Needed before APIs or automated delivery, but premature before institution invite and review operations are mature.

## Recommended Next Mission

Recommended:

`feat/institution-review-invite-flow-v1`

Suggested scope:

- tenant-mediated invite creation for institution review recipients
- recipient email and organization label
- audience and purpose binding
- expiration and resend behavior
- revocation-aware invite lifecycle
- recipient-authenticated acceptance
- no public trust URL
- no institution API
- no downloads
- no provider integration
- metadata-only audit events
- tenant-visible invite status
- support-safe invite diagnostics

This path improves operational interoperability while preserving RentChain's core governance model.

## Is RentChain Ready For Future Institution Interoperability?

RentChain is ready for the next internal interoperability foundation: a tenant-mediated institution review invite flow.

RentChain is not ready for:

- live institution integrations
- institution APIs
- insurer/lender/subsidy/government delivery
- downloadable institution trust exports
- institution-controlled workflows
- automated eligibility or approval decisions
- public trust exposure

Readiness level: **approaching readiness for controlled institution review operations, not ready for external integration.**

## Remaining Risks

- Institution recipient identity is still email-session based and not organization-verified.
- Lender, subsidy, and government workflows carry higher legal and semantic risk than insurer or institutional landlord review.
- External revocation cannot be enforced for downloaded or externally copied data.
- Institution-specific schemas and retention policies are not yet defined.
- Future UI copy must continue avoiding approval, eligibility, creditworthiness, insurability, ownership, and government-verification semantics.
- Support/operator tools must remain diagnostics-only and must not evolve into broad trust browsing.

## Acceptance Criteria Review

- Interoperability readiness audit completed.
- Institution-facing workflow risks documented.
- Lifecycle and session expectations documented.
- Governance and privacy risks documented.
- Safest interoperability pattern identified.
- No product behavior changes introduced.
- No institution interoperability implementation introduced.
- Next recommended mission identified clearly.

