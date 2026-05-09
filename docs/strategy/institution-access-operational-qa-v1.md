# Institution Access Operational QA v1

Branch: `strategy/institution-access-operational-qa-v1`
Scope: documentation-first operational QA and governance review, no feature expansion

## Executive Summary

RentChain's tenant-mediated institution access workflow is operationally safe enough for the current narrow use case:

- tenant-controlled trust export preparation
- tenant-mediated institution access grants
- authenticated recipient trust review
- revocation-aware and expiration-aware access checks
- metadata-only trust summaries
- non-public, view-only recipient review
- policy-gated export-safe summaries

The workflow is not ready for public links, downloadable recipient exports, institution APIs, provider integrations, automated institution delivery, or automated eligibility decisions.

Recommended next mission:

`feat/recipient-access-audit-dashboard-v1`

Reason: the platform now has working tenant-mediated grants and authenticated recipient review, but operational support and tenant agency would benefit most from a tenant-visible and operator-safe access audit surface before additional access mechanics are added.

## QA Scope Completed

Reviewed strategy and architecture:

- `docs/strategy/trust-export-adoption-readiness-audit-v1.md`
- `docs/strategy/trust-export-recipient-access-readiness-audit-v1.md`
- `docs/strategy/recipient-authenticated-access-readiness-audit-v1.md`
- `docs/architecture/institutional-trust-export-framework-v1.md`

Reviewed backend implementation:

- `rentchain-api/src/services/tenantPortal/tenantTrustExportService.ts`
- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/institutionTrustExports/deriveInstitutionalTrustExportPackage.ts`
- `rentchain-api/src/middleware/requireAuth.ts`

Reviewed frontend implementation:

- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.tsx`
- `rentchain-frontend/src/api/recipientTrustReview.ts`
- `rentchain-frontend/src/App.tsx`

Reviewed regression coverage:

- `rentchain-api/src/services/tenantPortal/__tests__/tenantInstitutionAccessService.test.ts`
- `rentchain-api/src/routes/__tests__/recipientTrustReviewRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/tenantPortalRoutes.test.ts`
- `rentchain-api/src/lib/portableAttestations/__tests__/attestationPolicyGate.test.ts`
- `rentchain-api/src/lib/institutionTrustExports/__tests__/deriveInstitutionalTrustExportPackage.test.ts`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.test.tsx`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.test.tsx`

## Workflow Map

1. Tenant trust export preparation

   Tenant trust exports are prepared through authenticated tenant workspace routes. The export package is consent-scoped, audience-scoped, purpose-scoped, metadata-only, policy-gated, non-public, and revocable in RentChain state.

2. Tenant-mediated institution access grant

   A tenant creates an access grant for a specific recipient email, audience, purpose, and expiration. The grant stores no public URL, no access token, no provider integration state, no external submission state, and no recipient download state.

3. Authenticated recipient review

   A recipient must authenticate through the existing account/session path and request `/api/recipient/trust-reviews/:grantId`. The service compares the authenticated email to the grant recipient email before returning any summary.

4. Per-request lifecycle validation

   Recipient review loads current grant state on each request. Revoked, expired, blocked, reverification-required, consent-missing, policy-denied, and unsafe-payload states are blocked before any trust summary is returned.

5. Metadata-only rendering

   The recipient UI renders a view-only metadata summary. It does not include recipient downloads, public profile controls, raw documents, raw provider payloads, support metadata, or automated decision language.

## Operational Strengths

- Tenant agency is preserved. Institution access begins with tenant action and explicit consent.
- Recipient review does not reuse public share-package bearer-token routes.
- Possession of a URL is not treated as authentication.
- Recipient mismatch is fail-closed and returns no trust summary.
- Revoked and expired grants return blocked decisions and no summary payload.
- Trust summaries are generated from policy-gated export-safe metadata.
- Recipient summaries exclude tenant id, attestation ids, policy decisions, internal support metadata, and raw payload indicators.
- The frontend copy avoids unsafe semantics such as "verified tenant", "approved", "eligible", "creditworthy", "insurable", "government verified", or "automated decision".
- Recipient review is view-only; no recipient export or download path exists.
- Share-package behavior is not widened.

## QA Scenario Findings

| Scenario | Current Behavior | QA Result |
| --- | --- | --- |
| Tenant creates valid access grant | Requires tenant workspace auth, recipient email, consent, expiration, policy-ready package | Pass |
| Tenant revokes active grant | Sets lifecycle to `revoked`, clears consent, disables recipient access flags | Pass |
| Expired grant access | Recipient review returns blocked/expired response with no summary | Pass |
| Revoked grant access | Recipient review returns blocked/revoked response with no summary | Pass |
| Wrong recipient access | Authenticated email mismatch returns not found-style denial with no summary | Pass |
| Unauthenticated recipient access | Backend `requireAuth` rejects missing bearer auth; frontend route uses `RequireAuth` | Pass |
| Blocked or policy-denied package | Recipient review returns blocked decision and no summary | Pass |
| Missing consent | Recipient review blocks before returning summary | Pass |
| Unsupported public exposure flags | Unsafe payload detector blocks public, external submission, access token, download, raw, or support metadata flags | Pass |
| Share package isolation | Tenant share packages remain separate and are not created by institution access grants | Pass |
| Recipient download | No download endpoint, no UI download control, summary reports downloads disabled | Pass |
| Multi-device review attempts | Each request re-loads current grant state, so lifecycle changes propagate to later views | Pass with limitation |

The multi-device/session limitation is that RentChain does not yet maintain a dedicated recipient session ledger. Current safety comes from per-request grant validation plus normal authenticated session behavior, not from first-class recipient review sessions.

## Revocation And Expiration Findings

Revocation behavior is strong for RentChain-controlled surfaces:

- tenant revocation changes grant lifecycle to `revoked`
- tenant revocation marks consent as no longer granted
- tenant revocation disables recipient access flags
- recipient review checks `lifecycle`, `revokedAt`, and `consent.revokedAt`
- revoked access returns no active trust summary
- recipient review records a metadata-only revoked event

Expiration behavior is also strong for current scope:

- access grants require expiration
- expiration is capped by service rules
- recipient review compares `expiresAt` against current time
- expired access returns no active trust summary
- recipient review records a metadata-only expired event

Remaining operational gaps:

- tenants do not yet have a dedicated view of recipient review attempts
- support/admin does not yet have a purpose-built, redacted recipient access audit dashboard
- existing recipient view events are stored in grant event history, but there is no separate recipient-session collection or per-session lifecycle object
- recipients do not receive a distinct expired/revoked page beyond the current blocked-state message

## Auth And Session Findings

The current recipient review path uses existing authenticated account sessions:

- backend route is protected by `requireAuth`
- frontend route is protected by `RequireAuth`
- service requires authenticated recipient email
- grant recipient email must match authenticated email

This is sufficient for a narrow v1 authenticated review, but it is not institution-grade identity assurance.

Current constraints:

- recipient identity is email-session based
- recipient organization is informational and not verified
- no institution-domain binding exists
- no recipient-specific session object binds grant id, audience, purpose, and expiration
- no one-time invite or challenge flow exists

These constraints are acceptable because the workflow is non-public, metadata-only, tenant-mediated, and view-only. They should be addressed before insurer, lender, subsidy, government, or institution-account workflows.

## Metadata Minimization Findings

Recipient-visible summaries include:

- grant id
- audience
- purpose
- lifecycle
- recipient email/display/organization metadata
- consent version and timestamps
- generated/reviewed/expires timestamps
- claim category labels and lifecycle states
- redactions and disclaimers

Recipient-visible summaries exclude:

- tenant id
- attestation ids
- policy decision internals
- support-console metadata
- raw provider payloads
- raw evidence
- raw identity documents
- banking/payment credentials
- raw screening reports
- document URLs
- public trust URLs
- access tokens
- downloadable export files
- automated decision outputs

This is adequate for the current operational scope.

## Institution Semantics Review

Safe semantics currently present:

- "metadata-only"
- "tenant-authorized"
- "authenticated"
- "audience-scoped"
- "purpose-scoped"
- "view-only"
- "recipient downloads are disabled"
- "public profiles and public trust URLs are not created"
- "not an approval, eligibility, credit, insurance, subsidy, ownership, government, or automated decision"

Unsafe semantics not found:

- "verified tenant"
- "approved"
- "eligible"
- "creditworthy"
- "insurable"
- "government verified"
- "owner verified"
- "KYC approved"
- "source of truth"
- "reputation score"

The institution-facing semantics are conservative enough for v1.

## Governance And Privacy Findings

Governance posture is strong for current scope:

- the workflow is deny-by-default through the policy gate
- export packages are non-public and manual-only
- recipient review revalidates state before display
- support/internal metadata remains separated from portable summaries
- trust review does not create institution submission records
- no provider or institution integration is introduced
- audit events are metadata-only

Privacy risks are currently controlled but not eliminated:

- recipient email appears in tenant-facing and recipient-facing summaries by design
- recipient access events are stored on the grant, not in a dedicated audit ledger
- email-based recipient authentication is weaker than institution-recipient assurance
- tenant workspace still offers downloadable tenant trust export JSON; this remains separate from recipient review but has known external-recall limitations

## Operational Readiness Level

Readiness: **Ready for narrow authenticated recipient review; not ready for expanded institution workflows.**

Safe today:

- tenant-controlled export preparation
- tenant-mediated institution access grants
- authenticated recipient review by matching email
- view-only metadata summaries
- revocation and expiration enforcement
- conservative institution-facing copy

Not safe yet:

- public trust URLs
- signed-link-only access
- downloadable recipient exports
- institution APIs
- insurer/lender/subsidy/government delivery
- automated institutional decisions
- institution-triggered workflows
- organization-verified recipient accounts

## Recommended Next Mission

Recommended:

`feat/recipient-access-audit-dashboard-v1`

Rationale:

- The core access and review path is now functioning.
- The highest operational gap is visibility into recipient review attempts, blocked attempts, revoked access attempts, and expiration behavior.
- A redacted tenant/operator audit surface would improve supportability without widening access.
- It should remain metadata-only and must not expose raw trust payloads or support-only internals to recipients.

Alternative later missions:

- `feat/expiring-recipient-review-sessions-v1`: useful after audit visibility exists, to replace implicit session-bound semantics with explicit review-session records.
- `feat/institution-review-invite-flow-v1`: useful after session and audit hardening, to support controlled invitation mechanics without public links.
- Institution/provider readiness planning: appropriate only after audit visibility and explicit session semantics are stable.

Do not proceed next with public links, recipient downloads, institution APIs, or automated review workflows.

## Remaining Risks

- Email-session recipient matching is acceptable for narrow v1 but insufficient for lender, subsidy, government, or high-assurance institution workflows.
- Recipient organization is tenant-provided metadata, not verified authority.
- Revocation propagates to RentChain-controlled views, but cannot control screenshots or externally copied information.
- Tenant trust export downloads remain a separate portability mechanism with external-recall limits.
- Recipient review events are metadata-only but not yet exposed in a dedicated operational audit dashboard.
- There is no dedicated recipient-session object with per-session expiration, invalidation, device metadata, or institution role.

## PR Readiness Summary

This mission is documentation-only and does not change product behavior.

It confirms the current tenant-mediated institution access workflow is suitable for narrow, authenticated, metadata-only recipient review. It also confirms the architecture should not advance to public links, recipient downloads, institution APIs, provider integrations, or automated institutional decisions until recipient-access auditability and explicit session controls are hardened.
