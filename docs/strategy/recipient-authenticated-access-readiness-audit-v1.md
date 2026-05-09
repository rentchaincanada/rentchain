# Recipient Authenticated Access Readiness Audit v1

Branch: `strategy/recipient-authenticated-access-readiness-audit-v1`
Scope: documentation-only recipient-authenticated-access readiness audit, no recipient access implementation

## Executive Summary

RentChain is approaching readiness for a narrow recipient-authenticated trust review implementation, but it is not ready for broad recipient-controlled trust access, public links, institution APIs, or downloadable recipient exports.

PR #850 established tenant-mediated institution access grants. Those grants are the right prerequisite layer:

- tenant-controlled
- consent-scoped
- audience-scoped
- purpose-scoped
- expiring
- revocable
- metadata-only
- policy-gated
- non-public

The current grant model deliberately stops before recipient access. `recipientAccess.enabled` remains `false`, no access URL is created, no token is issued, and recipient authentication is marked as required.

The safest next implementation path is:

`feat/recipient-authenticated-trust-review-v1`

That mission should remain narrow: authenticated, session-bound, tenant-mediated, revocation-aware review of metadata-only trust summaries. It should not add public trust links, institution APIs, provider integrations, downloadable recipient exports, automated decisions, or public profiles.

## Audit Scope Completed

Reviewed strategy and architecture:

- `docs/strategy/trust-export-recipient-access-readiness-audit-v1.md`
- `docs/architecture/portable-attestation-framework-v1.md`
- `docs/architecture/institutional-trust-export-framework-v1.md`

Reviewed implementation surfaces:

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-frontend/src/api/tenantInstitutionAccess.ts`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/institutionTrustExports/deriveInstitutionalTrustExportPackage.ts`
- `rentchain-api/src/services/tenantPortal/tenantTrustExportService.ts`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/routes/publicTenantShareRoutes.ts`
- `rentchain-api/src/middleware/authMiddleware.ts`

## Current Access Model

Tenant-mediated institution access currently uses authenticated tenant workspace routes:

- `GET /tenant/institution-access/grants`
- `POST /tenant/institution-access/preview`
- `POST /tenant/institution-access/grants`
- `POST /tenant/institution-access/grants/:id/revoke`

The model stores tenant-owned records in `tenantInstitutionAccessGrants`.

Each grant carries:

- recipient email and optional organization name
- audience
- purpose
- consent state
- expiration
- revocation state
- policy-gated institutional trust export package
- included and excluded claim summaries
- metadata-only redactions and disclaimers

The recipient access fields are intentionally inert:

- `recipientAccess.enabled: false`
- `accessUrl: null`
- `accessTokenIssued: false`
- `recipientAuthenticationRequired: true`
- `sessionBound: true`
- `downloadEnabled: false`

This means the platform has an access-grant foundation, not recipient-facing access.

## Current Access Limitations

The current framework cannot yet:

- authenticate a recipient
- create a recipient review session
- bind a session to a recipient email or organization
- invalidate active recipient sessions on revocation
- audit recipient views
- enforce recipient download restrictions
- re-check policy gates on each recipient view
- display revoked or expired state to recipients without trust payload exposure
- distinguish a legitimate invited reviewer from a forwarded bearer token holder
- support institution-specific recipient controls

These gaps are acceptable for the current non-public grant foundation. They must be closed before recipient-authenticated trust review goes live.

## Recipient Authentication Findings

Recipient access should require authentication. A bare signed or expiring link is not sufficient as the primary control for trust metadata because it can be forwarded and does not prove recipient identity.

Safe initial authentication should be modest but explicit:

- recipient email must match the tenant-approved grant recipient
- access must require a one-time challenge or authenticated session
- session must be bound to the grant, recipient email, audience, purpose, and expiration
- session must be revalidated against grant lifecycle on every view
- recipient access should be read-only and metadata-only

Higher-risk audiences require stronger future controls:

| Audience | Initial control | Future control |
| --- | --- | --- |
| Institutional landlord | Recipient email session, tenant-approved grant, short expiry | Organization-domain or workspace verification |
| Insurer | Recipient email session, tenant approval, purpose binding | Institution account or partnership-backed access |
| Lender | Stronger recipient and organization binding before live use | Legal/compliance-reviewed institution access |
| Subsidy reviewer | Not ready for implementation | Program-specific authorization and identity assurance |
| Government reviewer | Not ready for implementation | Program-specific access governance and legal/privacy review |
| Auditor | Recipient email session for narrow metadata review | Audit-scope controls and immutable access logs |

Email-only challenge flows may be a reasonable first step for low-risk review, but they should not be framed as institution verification.

## Session Model Findings

Recipient sessions should be separate from tenant sessions and public share tokens.

A safe future recipient session should bind:

- access grant id
- tenant subject id
- recipient email
- recipient organization name if supplied
- intended audience
- intended purpose
- consent id and consent version
- package schema version
- policy gate version
- session issued timestamp
- session expiry timestamp
- last policy evaluation timestamp
- view-only flag
- download disabled flag

Recipient sessions should fail closed when:

- grant is missing
- recipient email does not match
- consent is missing or revoked
- grant is expired
- grant is revoked
- grant is blocked
- package is no longer policy-allowed
- reverification is required
- session is expired
- audience or purpose cannot be resolved

## Revocation And Expiration Findings

Revocation must invalidate recipient access in RentChain-controlled surfaces immediately.

Future recipient-access reads must:

- load the current grant state
- reject revoked grants
- reject expired grants
- reject blocked grants
- reject reverification-required grants
- re-run or verify the policy-gated package status before showing trust summaries
- show only lifecycle status when active trust data is unavailable

Recipients should not see stale trust payloads after revocation, expiration, supersession, or reverification requirement.

Tenants should see:

- active sessions where possible
- recipient view timestamps
- grant status
- revocation timestamp
- expiration timestamp
- recipient email
- audience and purpose

The current grant event list has tenant grant and revoke events. Recipient-authenticated access needs per-view or per-session metadata events before live use.

## Download Findings

Recipient downloads should not be part of the first recipient-authenticated access implementation.

Reasons:

- downloaded files cannot be technically recalled
- downloads weaken revocation propagation
- downloads weaken recipient identity binding
- downloaded JSON can be forwarded beyond the intended audience
- institutions may over-read portable summaries as authoritative decisions

The safest initial model is view-only recipient review. Downloadable exports may be considered later only after recipient sessions, revocation semantics, institution terms, and download-specific audit receipts exist.

## Access Model Ranking

| Model | Ranking | Readiness | Findings |
| --- | --- | --- | --- |
| Tenant-mediated authenticated review session | Safest next path | Approaching ready | Builds on PR #850 grants while preserving tenant control, revocation, expiration, and metadata-only policy gates. |
| One-time invite code plus recipient email session | Safe initial mechanism | Approaching ready | Good first authentication layer if codes are short-lived, single-purpose, and not treated as public URLs. |
| Signed expiring links without recipient authentication | Moderate risk | Not recommended as primary control | Expiry helps, but forwarding risk remains and recipient identity is not proven. |
| Institution-scoped accounts | Later-stage safe pattern | Not ready | Requires institution onboarding, role expectations, contracts, and governance. |
| Tenant-mediated approval plus institution account | Later-stage strong pattern | Not ready | Strong fit for insurers, lenders, subsidy, and government after institution readiness work. |
| Downloadable recipient export | High risk initially | Not ready | Weakens revocation and access auditability. |
| Public trust URLs | Prohibited | Not ready | Conflicts with non-public trust orchestration. |
| Public trust profiles | Prohibited | Not ready | Creates reputation-network drift. |
| Blockchain/verifiable credential publishing | Prohibited | Not ready | Outside scope and incompatible with current revocation/privacy requirements. |

## Secure Recipient Access Options

### Option A: Invite Code + Recipient Email Session

This is the safest initial implementation shape.

The tenant creates a grant, RentChain issues a short-lived invite challenge, and the recipient must prove control of the tenant-approved email before a view-only session is established.

Required safeguards:

- invite code must not be the sole authorization check
- invite code must expire
- recipient email must match the grant
- session must be scoped to one grant
- grant lifecycle must be checked on every view
- no downloads in v1

### Option B: Signed Expiring Link

This is acceptable only as a transport or initiation mechanism, not as the sole access control.

If used later, the signed link should lead to a recipient authentication step. It should not directly reveal trust metadata.

### Option C: Recipient-Authenticated Portal

This is the safest long-term model.

It supports:

- stronger recipient identity
- access logs
- revocation propagation
- institution-specific visibility
- session controls
- future organization-level authorization

It is too broad for the next mission unless constrained to tenant-mediated grants and simple recipient email sessions.

### Option D: Institution-Scoped Accounts

This should wait.

It requires:

- institution onboarding
- role models
- legal/privacy review
- institution retention expectations
- abuse handling
- support operations

### Option E: Public Or Bearer Trust Links

This should not proceed.

Bearer links are not appropriate for institution-facing trust metadata because they do not provide recipient identity, organization context, or strong forwarding resistance.

## Governance And Privacy Findings

Recipient-authenticated access must preserve:

- tenant control
- explicit consent
- audience scope
- purpose scope
- expiration
- revocation
- metadata minimization
- policy-gated package derivation
- support/internal separation
- non-public access

Recipient access must not expose:

- raw government ID images or document numbers
- biometric, selfie, or liveness payloads
- SIN/SSN equivalents
- raw identity provider payloads
- raw screening provider payloads
- raw credit bureau data
- banking credentials, card data, or payment processor payloads
- raw title, registry, business, or property provider payloads
- support-console notes
- internal governance notes
- raw policy decision internals not intended for recipient interpretation
- confidence internals not already export-safe
- token hashes, access secrets, or session identifiers
- private tenant documents not explicitly selected and policy-approved
- automated eligibility, approval, insurability, creditworthiness, subsidy, identity, or ownership conclusions

## Safe Recipient Semantics

Safe recipient-facing language:

- "Tenant-authorized trust review"
- "Metadata-only summary"
- "Audience-scoped"
- "Purpose-scoped"
- "Expires on"
- "Revoked on"
- "Reverification required"
- "View-only"
- "Not an eligibility decision"
- "Not a credit, insurance, subsidy, ownership, or government decision"

Unsafe recipient-facing language:

- "Verified tenant"
- "Approved tenant"
- "Creditworthy"
- "Insurable"
- "Subsidy eligible"
- "Government verified"
- "KYC approved"
- "Identity proven by RentChain"
- "Source of truth"
- "Permanent credential"
- "Public trust score"

## Institution Readiness Findings

Institutional landlord review is the safest early recipient category because it can remain tenant-mediated, metadata-only, and narrowly scoped.

Insurer review is plausible after recipient sessions exist, but should avoid insurance eligibility or underwriting semantics.

Lender review is higher risk because trust metadata may be interpreted as creditworthiness or underwriting support. It should wait for stronger recipient organization controls and legal/compliance review.

Subsidy and government review are not ready. They require program-specific schemas, stronger identity assurance, government/program authorization, retention rules, and legal/privacy review.

Auditor review is plausible as view-only metadata access if support/internal metadata remains excluded and access logging is mature.

## Answers To Primary Questions

1. The safest initial recipient access model is tenant-mediated authenticated review sessions.
2. Recipient access should require authentication.
3. The initial proof should be control of the tenant-approved recipient email. Higher-risk audiences require organization or institution assurance later.
4. Recipients may receive invite codes or links only as initiation mechanisms; trust payload access should require an authenticated session.
5. Access should be short-lived. The current grant cap of 30 days is a maximum; recipient sessions should be much shorter and revalidated.
6. Revocation should immediately invalidate all recipient views and sessions for that grant.
7. Expiration should automatically stop active payload access and show only expired status.
8. Recipients should not be allowed to download trust exports in the first implementation.
9. Initial access should be view-only.
10. Raw provider, raw identity, raw screening, raw banking, support/internal, and unsupported confidence metadata must remain inaccessible.
11. Support/internal metadata must never leave RentChain through recipient access.
12. Safe institution semantics are descriptive, scoped, non-authoritative, and metadata-only.
13. Unsafe semantics imply approval, creditworthiness, insurability, subsidy eligibility, government verification, ownership, or source-of-truth authority.
14. Safest access patterns are: institutional landlords through email-session review first; insurers later with purpose-bound sessions; lenders only after stronger organization controls; subsidy/government only after program-specific governance; auditors through narrow view-only sessions.
15. RentChain is ready for a narrow recipient-authenticated trust review mission, not broad recipient access or institution integrations.

## Recommended Next Mission

Proceed next with:

`feat/recipient-authenticated-trust-review-v1`

Required scope:

- tenant-mediated access grants only
- recipient email-session authentication
- short-lived recipient sessions
- grant lifecycle revalidation on every view
- revoked, expired, blocked, and reverification-required access blocking
- metadata-only, view-only recipient summaries
- access viewed events
- tenant-visible access history
- no downloads
- no public profiles
- no institution/provider APIs
- no automated decisions
- no share-package widening

Do not proceed next with:

- `feat/expiring-institution-access-links-v1` as a bearer-link-only project
- broad institution account systems
- public trust URLs
- downloadable recipient exports
- insurer, lender, subsidy, or government integrations

## Regression Risks

Future implementation risks:

- treating signed links as authentication
- reusing public share-package routes for trust exports
- issuing permanent or long-lived access grants
- failing to re-check grant revocation on each view
- allowing downloads before recipient policy matures
- exposing internal support metadata through recipient summaries
- exposing policy internals or confidence fields that are not export-safe
- using broad "verified" language
- treating email control as institution verification
- allowing recipient access after consent revocation
- mutating old packages silently instead of deriving fresh policy-gated summaries

## Verification

This audit is documentation-only. It does not add:

- recipient access routes
- public trust URLs
- recipient sessions
- invite codes
- institution integrations
- provider integrations
- share-package behavior changes
- export API changes
- blockchain, verifiable credential, or tokenization behavior
- automated decisioning
