# Institution Review Invite Operational QA v1

Branch: `strategy/institution-review-invite-operational-qa-v1`
Scope: documentation-first operational QA and governance review, no feature expansion

## Executive Summary

RentChain's institution review invite workflow is operationally safe enough for the current narrow use case:

- tenant-created institution review invites
- explicit tenant consent
- recipient email, audience, purpose, and expiration capture
- access grant and institution review session linkage
- authenticated recipient review
- metadata-only, view-only trust summaries
- revocation-aware and expiration-aware recipient access checks
- tenant-visible invite and access activity
- support-safe operational diagnostics and operator audit timeline reconstruction

The workflow is not ready for institution APIs, automated institution delivery, downloadable institution exports, institution-controlled workflows, public links, public trust profiles, provider integrations, or automated eligibility decisions.

Recommended next mission:

`feat/institution-review-invite-session-hardening-v1`

Reason: the invite flow is safe for narrow tenant-mediated review, but the next risk boundary is tighter invite/session continuity. Before institution delivery or partner onboarding, RentChain should harden invite-open tracking, resend/replacement semantics, stale session behavior, and reauthentication expectations around institution review invites.

## QA And Review Plan

This mission is QA-first and documentation-first.

1. Review the tenant invite creation path, access grant linkage, recipient review route, session governance, lifecycle controls, tenant audit visibility, support diagnostics, operator timeline, and email copy.
2. Validate the required QA scenarios from implementation and test coverage.
3. Classify operational strengths, gaps, privacy risks, and institution semantics risks.
4. Document the next safe implementation path.
5. Do not add institution integrations, public URLs, downloads, provider integrations, blockchain/tokenization, automated institutional decisions, or product-scope widening.

## QA Scope Completed

Reviewed strategy and architecture:

- `docs/strategy/institution-interoperability-readiness-audit-v1.md`
- `docs/strategy/institution-access-operational-qa-v1.md`
- `docs/strategy/institution-access-support-admin-readiness-audit-v1.md`
- `docs/architecture/institutional-trust-export-framework-v1.md`
- `docs/architecture/portable-attestation-framework-v1.md`

Reviewed backend implementation:

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/institutionReviewSessions/deriveInstitutionReviewSession.ts`
- `rentchain-api/src/lib/institutionTrustExports/deriveInstitutionalTrustExportPackage.ts`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/supportConsole/operatorAuditTimeline.ts`

Reviewed frontend implementation:

- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.tsx`
- `rentchain-frontend/src/api/tenantInstitutionAccess.ts`
- `rentchain-frontend/src/api/recipientTrustReview.ts`

Reviewed regression coverage:

- `rentchain-api/src/routes/__tests__/tenantPortalRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/recipientTrustReviewRoutes.test.ts`
- `rentchain-api/src/lib/institutionReviewSessions/__tests__/deriveInstitutionReviewSession.test.ts`
- `rentchain-api/src/lib/institutionTrustExports/__tests__/deriveInstitutionalTrustExportPackage.test.ts`
- `rentchain-api/src/lib/portableAttestations/__tests__/attestationPolicyGate.test.ts`
- `rentchain-api/src/lib/supportConsole/__tests__/operatorAuditTimeline.test.ts`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.test.tsx`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.test.tsx`

## Workflow Map

1. Tenant prepares invite context

   The tenant workspace collects recipient email, optional organization label, audience, derived purpose, fixed expiration window, and explicit consent. Preview calls use the existing institution access preview path and policy-gated trust export package.

2. Tenant sends institution review invite

   `POST /tenant/institution-access/invites` requires authenticated tenant workspace context. The service requires consent, a normalized recipient email, an expiration, and a policy-ready package. It reuses an active compatible grant when available or creates a new tenant-mediated access grant.

3. Invite links into existing access stack

   The invite does not create a parallel access system. It links to the tenant institution access grant, recipient review context, and institution review session summary. Recipient access flags remain authenticated, session-bound, metadata-only, non-public, and download-disabled.

4. Recipient receives conservative email

   The invite email states that the recipient must sign in with the invited email before any review summary can be shown. It states the review is metadata-only, view-only, tenant-mediated, time-bound, and not an approval, eligibility decision, credit report, public profile, or automated decision.

5. Recipient review is authenticated and email-bound

   `/recipient/trust-reviews/:grantId` is protected by `requireAuth`. The service rejects missing authenticated email, wrong recipient email, revoked grants, expired grants, blocked grants, reverification-required grants, consent-missing grants, policy-denied packages, and unsafe payload indicators before returning a summary.

6. Lifecycle and session state are revalidated

   Recipient review reloads current grant state on each request. Revoked, expired, blocked, policy-denied, and unsafe states return no trust summary. Recipient review sessions are validated for recipient email, recipient user id, grant id, expiration, lifecycle, and session mismatch.

7. Tenant and operator visibility remains metadata-only

   Tenant workspace shows invite/access status, redacted recipient activity, opened/blocked counts, revoked/expired counts, and recent access events. Support diagnostics and operator audit timeline use metadata-only, support-safe projections and redacted identifiers.

## Operational Strengths

- Tenant agency is preserved. Institution review begins with tenant action and explicit consent.
- Recipient invite creation requires recipient email, audience, purpose, and expiration.
- Possession of an invite link is not sufficient authorization.
- Recipient review requires authenticated account/session context and matching email.
- Recipient review is view-only and download-disabled.
- Invite email avoids trust payloads, raw IDs, approval language, eligibility language, public profile language, and automated-decision language.
- Access grants are policy-gated through institutional trust export summaries.
- Institution review session modeling carries audience, purpose, role, lifecycle, access grant linkage, trust export linkage, and metadata-only payload safety.
- Revoked and expired grants block recipient review before summary generation.
- Policy-denied, unsafe, missing-consent, blocked, and reverification-required states block recipient review.
- Tenant audit visibility summarizes activity without showing raw trust payloads.
- Support diagnostics and operator audit timeline remain support-safe and metadata-only.
- Share-package behavior is not widened.
- No institution/provider API, downloadable institution export, public profile, public trust URL, or automated decision path is introduced.

## QA Scenario Findings

| Scenario | Current Behavior | QA Result |
| --- | --- | --- |
| Tenant creates valid institution invite | Requires tenant workspace auth, recipient email, audience, expiration, explicit consent, and policy-ready package | Pass |
| Recipient authenticates successfully | Authenticated matching recipient receives metadata-only, view-only summary | Pass |
| Wrong recipient rejected | Authenticated email mismatch returns blocked/not-found-style denial with no summary | Pass |
| Unauthenticated review rejected | `requireAuth` rejects missing authenticated context | Pass |
| Revoked invite/access | Tenant revocation marks grant revoked, clears consent, disables recipient access, and blocks review | Pass |
| Expired invite/access | Recipient review compares `expiresAt` to current time and blocks expired access | Pass |
| Blocked or policy-denied review | Non-ready package, empty summaries, or unsafe payload indicators block summary access | Pass |
| Revoked trust export during active review | Current recipient review reloads grant/package state per request, so subsequent review attempts are blocked if the grant/package is updated | Pass with limitation |
| Stale session continuity | Session validation blocks expired, revoked, mismatched, or stale recipient review sessions | Pass with limitation |
| Multi-device/session review attempts | Each request revalidates grant and session state; no public bearer path exists | Pass with limitation |
| Invite resend/replacement | Active compatible invite grants are reused; expired/revoked replacement behavior is deterministic through new grant creation but not yet supported by a dedicated resend UX | Pass with gap |
| Invite lifecycle after superseded exports | Institution review session and export lifecycle models represent superseded state; invite flow blocks non-ready packages | Pass with gap |

## Revocation And Expiration Findings

Revocation behavior is strong for RentChain-controlled surfaces:

- tenant revocation sets grant lifecycle to `revoked`
- tenant revocation records `tenant_institution_access_revoked` and `institution_review_invite_revoked`
- tenant revocation clears consent and disables recipient access flags
- recipient review checks grant lifecycle, `revokedAt`, and consent revocation
- revoked access returns no active trust summary
- revoked state propagates into institution review session lifecycle
- operator timeline can reconstruct revoked events without trust payloads

Expiration behavior is strong for current scope:

- invite/access creation requires expiration
- recipient review checks grant expiration on each request
- expired access returns no active trust summary
- expired recipient review sessions require reauthentication
- expired state propagates into institution review session lifecycle
- operator timeline can reconstruct expired events without trust payloads

Remaining gaps:

- the tenant UI currently presents a fixed 14-day expiration label for institution invites; future versions should support explicit tenant-visible expiration choice with safe bounds
- invite-open tracking is represented by event types but should be validated end-to-end when an invite landing/open flow is added
- resend and replacement semantics are not a dedicated first-class UX yet
- revocation cannot prevent screenshots, copied metadata, or email forwarding outside RentChain

## Auth And Session Findings

Current recipient authentication is sufficient for the narrow v1 workflow:

- recipient review route uses `requireAuth`
- service requires an authenticated recipient email
- authenticated email must match the grant recipient email
- recipient review sessions are metadata-only, view-only, download-disabled, and public-access-disabled
- expired or mismatched recipient sessions are rejected and marked inactive
- invite links are routing aids, not bearer authorization

Current constraints:

- recipient identity assurance is email-session based, not institution-verified
- recipient organization name is tenant-provided metadata and not verified authority
- no institution account, domain binding, SSO, recipient KYC, or organization-level authorization exists
- reauthentication behavior exists for expired/mismatched recipient review sessions, but invite-specific reauthentication UX is still basic
- multi-device behavior is safe by revalidation but not yet institution-grade device/session governance

These constraints are acceptable because the flow remains tenant-mediated, non-public, metadata-only, policy-gated, and view-only. They are not sufficient for institution delivery, insurer/lender production workflows, government workflows, or institution-controlled access.

## Metadata Minimization Findings

Institution-visible recipient review may include:

- audience
- purpose
- access lifecycle state
- expiration timestamp
- tenant-authorized review context
- claim category labels
- claim lifecycle labels
- redactions and disclaimers
- metadata-only review/session status

Institution-visible recipient review must never include:

- raw identity documents
- raw provider payloads
- raw property or registry payloads
- raw legal document payloads
- support-console notes
- internal governance notes
- internal confidence calculations
- policy decision internals
- hidden scoring or ranking metadata
- downloadable trust export files
- public trust URLs
- access tokens
- payment, banking, or screening-provider payloads
- unsupported approval, eligibility, credit, insurance, subsidy, or government verification claims

The current recipient review and invite email respect these boundaries.

## Institution Semantics Review

Safe semantics currently present:

- "tenant-authorized"
- "metadata-only"
- "view-only"
- "authenticated"
- "time-bound"
- "revocable"
- "non-public"
- "recipient downloads are disabled"
- "public profiles and public trust URLs are not created"
- "not an approval, eligibility, credit, insurance, subsidy, ownership, government, or automated decision"

Unsafe semantics not found in reviewed invite/review surfaces:

- "verified tenant"
- "approved"
- "eligible"
- "creditworthy"
- "insurable"
- "government verified"
- "provider verified"
- "risk score"
- "tenant score"
- "institution approved"
- "source of truth"
- "permanent credential"

The institution-facing semantics are conservative enough for v1 operational review.

## Governance And Privacy Findings

Governance posture is strong for current scope:

- access is tenant-mediated and consent-scoped
- recipient access is authenticated and email-bound
- trust packages are policy-gated and metadata-only
- lifecycle checks are performed before summary display
- public access, downloads, external submission, provider integrations, and automated decisions are explicitly disabled
- tenant access activity is summarized without trust payloads
- support/admin diagnostics are redacted and operationally scoped
- operator audit timeline preserves metadata-only reconstruction

Privacy risks are controlled but not eliminated:

- recipient email is visible to the tenant by design and appears in invite email copy by necessity
- recipient organization label is tenant-provided and may be inaccurate
- event history is stored on the access grant and summarized for tenant/support views; it is not a separate immutable institution-review ledger
- external recipient behavior after viewing cannot be controlled
- current session assurance is adequate for v1 but not sufficient for high-assurance institutional workflows

## Support And Operator Visibility Findings

Support-safe visibility is adequate for operational diagnosis:

- access lifecycle state
- revocation and expiration state
- audience and purpose
- blocked reason categories
- redacted recipient references
- metadata-only timelines
- institution review session summaries
- operator audit timeline reconstruction

Support/admin visibility should remain operational-only and must not become:

- broad trust browsing
- portable attestation content browsing
- raw trust payload inspection
- hidden risk scoring
- downloadable diagnostics
- institution-facing data export

## Operational Readiness Level

Readiness: **Ready for narrow tenant-mediated institution review invites; not ready for institution delivery.**

Safe today:

- tenant-created institution review invites
- authenticated matching-recipient review
- metadata-only trust summaries
- revocable and expiration-aware access
- policy-gated trust package preparation
- tenant-visible invite/access activity
- support-safe diagnostics
- operator audit timeline reconstruction

Not safe yet:

- institution APIs
- automated institution delivery
- downloadable institution exports
- public invite links
- signed-link-only access
- institution-controlled workflows
- public interoperability
- insurer/lender/subsidy/government production workflows
- automated institution decisions

## Recommended Next Mission

Recommended:

`feat/institution-review-invite-session-hardening-v1`

Rationale:

- The invite flow is operationally safe at v1 scope.
- The most important next risk boundary is invite/session continuity rather than institution delivery.
- Hardening should define first-class invite open/authenticated/revoked/expired session states, explicit resend/replacement behavior, reauthentication UX, and stale-session behavior.
- This path preserves tenant-mediated control and avoids premature institution APIs or downloadable exports.

Alternative later missions:

- `feat/tenant-mediated-institution-delivery-v1`: appropriate only after invite/session hardening and partner readiness boundaries are documented.
- `feat/institution-review-invite-reauthentication-v1`: appropriate if reauthentication UX is split from broader session hardening.
- Additional governance/lifecycle hardening first: appropriate if future QA finds supersession or export invalidation gaps in live data.
- Institution/provider partnership readiness first: appropriate before external pilots, but not before invite/session controls are tightened.

Do not proceed next with institution APIs, downloadable institution exports, automated institution delivery, public links, or institution-controlled workflows.

## Remaining Risks

- Browser/manual QA was not performed as part of this documentation mission.
- Recipient authentication remains email-session based, not institution-verified.
- Recipient organization labels are tenant-entered and not authoritative.
- Invite resend/replacement behavior is service-level reuse/new-grant behavior, not a dedicated tenant UX.
- Invite-open tracking should be validated once an explicit invite landing/open flow exists.
- Superseded export handling is modeled and blocked through package readiness, but future real-data workflows should test supersession after invite creation.
- Revocation is effective for RentChain-hosted review surfaces but cannot recall externally copied information.

## PR Readiness Summary

This mission is documentation-only and does not change product behavior.

It confirms the current institution review invite workflow is suitable for narrow, authenticated, tenant-mediated, metadata-only review. It also confirms RentChain should not advance to institution APIs, downloadable institution exports, automated institution delivery, public interoperability, or institution-controlled workflows until invite/session hardening is completed.
