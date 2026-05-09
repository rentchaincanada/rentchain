# Institution Access Support Admin Readiness Audit v1

Branch: `strategy/institution-access-support-admin-readiness-audit-v1`
Scope: documentation-only support/admin readiness audit, no support-console implementation

## Executive Summary

RentChain is ready to plan a narrow support-safe institution access diagnostics layer, but it is not ready for broad operator browsing of trust systems.

The current institution access workflow has the right safety foundations:

- tenant-mediated institution access grants
- explicit consent, audience, purpose, expiration, and revocation state
- authenticated recipient trust review
- metadata-only recipient summaries
- policy-gated institutional trust export packages
- tenant-visible recipient access audit summaries
- governance helpers for metadata-only diagnostics and identifier redaction
- support-console access logging for existing supported resources

The operational gap is that support/admin operators do not yet have a purpose-built way to diagnose institution-access workflows. Current support-console tooling supports applications, maintenance, and leases, not tenant-mediated trust access grants. The next implementation should therefore be a support-safe diagnostics surface that shows only operational metadata, redacted identifiers, lifecycle state, and reason categories.

Recommended next mission:

`feat/support-safe-institution-access-diagnostics-v1`

Do not proceed with broad trust browsing, portable attestation payload inspection, public trust visibility, institution integrations, or automated decisions.

## Audit Scope Completed

Reviewed strategy and architecture:

- `docs/strategy/institution-access-operational-qa-v1.md`
- `docs/strategy/recipient-authenticated-access-readiness-audit-v1.md`
- `docs/strategy/trust-export-recipient-access-readiness-audit-v1.md`
- `docs/strategy/trust-export-adoption-readiness-audit-v1.md`
- `docs/architecture/portable-attestation-framework-v1.md`
- `docs/architecture/institutional-trust-export-framework-v1.md`

Reviewed backend implementation:

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/portableAttestations/attestationPolicyGate.ts`
- `rentchain-api/src/lib/institutionTrustExports/deriveInstitutionalTrustExportPackage.ts`
- `rentchain-api/src/lib/governance/platformGovernance.ts`
- `rentchain-api/src/lib/supportConsole/buildSupportConsoleResource.ts`
- `rentchain-api/src/lib/supportConsole/supportConsoleTypes.ts`
- `rentchain-api/src/routes/supportConsoleRoutes.ts`
- `rentchain-api/src/services/admin/adminAuditView.ts`
- `rentchain-api/src/routes/adminAuditRoutes.ts`
- `rentchain-api/src/lib/events/buildEvent.ts`
- `rentchain-api/src/lib/supportOperations/deriveSupportOperationsProfile.ts`

Reviewed frontend implementation:

- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.tsx`
- `rentchain-frontend/src/api/tenantInstitutionAccess.ts`

Reviewed regression coverage:

- `rentchain-api/src/services/tenantPortal/__tests__/tenantInstitutionAccessService.test.ts`
- `rentchain-api/src/routes/__tests__/recipientTrustReviewRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/tenantPortalRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/supportConsoleRoutes.test.ts`
- `rentchain-api/src/lib/portableAttestations/__tests__/attestationPolicyGate.test.ts`
- `rentchain-api/src/lib/institutionTrustExports/__tests__/deriveInstitutionalTrustExportPackage.test.ts`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.test.tsx`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.test.tsx`

## Current Workflow Map

1. Tenant prepares trust export metadata

   Tenant workspace routes prepare consent-scoped, audience-scoped, purpose-scoped, policy-gated trust export packages. The package is metadata-only and non-public.

2. Tenant creates institution access grant

   A grant stores recipient email, optional display and organization labels, audience, purpose, expiration, consent, lifecycle, package metadata, included/excluded claim summaries, redactions, disclaimers, and event history.

3. Recipient authenticates and reviews

   Recipient review requires the existing authenticated session. The service compares the authenticated email to the grant recipient email and blocks mismatches.

4. Service revalidates grant state on each review

   Revoked, expired, blocked, reverification-required, consent-missing, policy-denied, unsafe-payload, and recipient-mismatch states return no active trust summary.

5. Tenant sees safe audit activity

   The tenant workspace now receives `recipient_access_audit.v1` summaries and timelines derived from grant events. It shows counts, last activity, last reason, redacted recipient reference, and recent access events.

6. Operators lack a dedicated diagnostics view

   Existing support-console resources do not include tenant institution access grants. Support/admin can inspect general application, maintenance, and lease resources, but cannot safely diagnose grant lifecycle or recipient review failures without ad hoc database access.

## Current Operator Visibility Gaps

Operators currently lack a safe, purpose-built answer to:

- Does the access grant exist?
- Which tenant owns it?
- Is the grant active, expired, revoked, blocked, or reverification-required?
- What audience and purpose were selected?
- Was consent present when the grant was created?
- When does the grant expire?
- Was the access grant revoked?
- Did a recipient successfully open the review?
- Were review attempts blocked?
- Did failures come from recipient mismatch, expiration, revocation, policy denial, consent missing, or unsafe payload flags?
- Is the recipient identifier safe to display?
- Did the operator access this diagnostic view, and was that access logged?

These are operational support questions. They do not require raw trust payloads, raw portable attestations, raw provider payloads, raw identity data, or complete recipient exports.

## Current Support/Admin Redaction Patterns

Existing support-console behavior provides useful patterns:

- `/support-console/resource` requires authenticated `system.admin` permission.
- Support-console access writes a canonical event with `metadataOnly: true`, `redactionApplied: true`, and `retentionCategory: support_diagnostics`.
- `buildSupportConsoleResource` returns `governance.sensitivity = restricted`, `metadataOnly = true`, and `redactionApplied = true`.
- `redactIdentifierMap` redacts sensitive identifiers and support debug identifiers such as checkout session, quote, and screening order ids.
- Support operations profiles explicitly exclude sensitive tenant and landlord profile fields, raw screening payloads, payment details, provider credentials, admin-only payloads, impersonation, overrides, and autonomous execution.

These patterns should be reused for institution access diagnostics.

Current limitation: existing support-console resources are resource-type bounded to `application`, `maintenance`, and `lease`. Tenant institution access grants are not supported resources yet.

## Safe Operator Metadata

The following metadata is safe for support/admin diagnostics when permission-scoped, redacted, audit-logged, and non-exportable:

| Field | Support/Admin Visibility | Notes |
| --- | --- | --- |
| Grant id | Visible | Operational lookup key; avoid exposing in portable exports unless already tenant-facing. |
| Tenant id | Redacted or internal-link only | Needed for support ownership resolution; should not be copied into recipient or portable views. |
| Lifecycle | Visible | `active`, `revoked`, `expired`, `blocked`, `reverification_required`. |
| Audience | Visible | Operationally needed to diagnose audience mismatch. |
| Purpose | Visible | Operationally needed to diagnose purpose mismatch. |
| Created/updated timestamps | Visible | Operational timeline. |
| Expires/revoked timestamps | Visible | Required for expiration and revocation diagnosis. |
| Consent state | Visible as status only | Show granted/revoked/expired/missing; do not expose full consent artifact payload. |
| Recipient email | Redacted by default | Show masked email and exact email only behind a higher diagnostic reason if needed later. |
| Recipient organization label | Visible if tenant-provided | Treat as self-asserted label, not verified organization identity. |
| Opened review count | Visible | Safe audit aggregate. |
| Blocked attempt count | Visible | Safe audit aggregate. |
| Last opened/blocked timestamp | Visible | Operational support metadata. |
| Reason category | Visible | Use machine-readable codes with safe descriptions. |
| Event type and actor type | Visible | Tenant/system/recipient only; no raw actor payload. |
| Metadata-only flags | Visible | Confirms diagnostics exclude trust payloads. |
| Public/download flags | Visible as booleans | Helpful to prove public access and downloads are disabled. |

## Tenant-Only Metadata

The following should remain tenant-controlled or tenant-visible, not broadly operator-owned:

- full tenant-facing included/excluded metadata preview narrative
- tenant consent copy and tenant-facing consent acknowledgements
- tenant workspace display of grant history and agency controls
- revoke action controls
- tenant-created recipient label context beyond what is needed for support diagnosis
- future tenant notes explaining why the tenant shared with a recipient

Operators may see whether consent exists and whether revocation occurred, but support diagnostics should not become a shadow tenant consent workspace.

## Recipient-Only Metadata

The following should remain recipient-view scoped:

- recipient-facing review page context and explanatory copy
- recipient-visible included metadata labels for an active grant
- authenticated recipient review result
- recipient session state if future review sessions exist

Operators may diagnose that a recipient review was opened or blocked, but should not browse the full recipient review payload as if they were the recipient.

## Prohibited Operator Metadata

The following should never become operator-visible through support/admin institution-access diagnostics:

- raw identity documents
- raw government IDs, passport, license, biometric, selfie, liveness, SIN, SSN, or equivalent identifiers
- raw provider responses or provider verification payloads
- raw property registry or title-system payloads
- raw business registry payloads
- raw screening provider payloads or credit bureau payloads
- raw banking, payment, card, account, or routing details
- portable attestation raw source references
- raw evidence document URLs
- access tokens, token hashes, one-time codes, bearer links, or session secrets
- private support notes unrelated to the institution access diagnostic question
- internal fraud rules, confidence internals, hidden scoring, or risk model internals
- complete institutional trust export payloads
- downloadable recipient exports
- public trust profile data
- AI reasoning traces or automated decision outputs

Support/admin diagnostics must remain operational metadata, not a trust payload viewer.

## Audit Visibility Versus Portable Trust Visibility

Support/admin audit visibility and portable trust visibility must remain separate systems.

Support/admin audit visibility is:

- internal
- permission-scoped
- operational-only
- redacted
- audit-logged
- non-exportable
- allowed to include diagnostic reason codes
- allowed to link to internal resource ids where necessary

Portable trust visibility is:

- tenant-mediated
- consent-scoped
- audience-scoped
- purpose-scoped
- recipient-visible only when authenticated
- metadata-minimized
- institution-readable
- non-public
- not allowed to expose support/internal metadata

The support/admin view may explain why a grant is blocked. It must not expose the underlying portable attestation contents directly.

## Support-Console Risks

The main risks for a future support/admin implementation are:

1. Trust payload creep

   If diagnostics reuse `package.exportSummaries`, `includedClaims`, or `excludedClaims` wholesale, the support-console can become a trust payload browser.

2. Recipient privacy overexposure

   Exact recipient email, organization labels, and mismatch attempts can reveal institution relationships. Default display should be redacted.

3. Tenant agency erosion

   Operators should diagnose and explain workflow state. They should not create, revoke, resend, or override tenant access grants in v1 diagnostics.

4. Confusing operational status with verification authority

   Support/admin labels must not imply "verified tenant", "approved", "eligible", "creditworthy", "insurable", or "government verified".

5. Audit bypass

   Every support/admin view of institution access diagnostics should write an operator access event, similar to existing support-console access logging.

6. Public or portable leakage

   Support diagnostics must never be exported to recipients, institutions, tenant share packages, or public links.

## Operator Accountability Requirements

Future support/admin diagnostics should log at least:

- operator id
- operator role
- route or diagnostic surface accessed
- grant id
- resource type `tenant_institution_access_grant`
- tenant id as redacted or internal reference
- reason category, if supplied
- timestamp
- metadata-only flag
- redaction-applied flag
- retention category `support_diagnostics`
- action type such as `institution_access_diagnostics_viewed`

Optional later actions, if ever introduced, should require separate audit events:

- support note added
- tenant contacted
- recipient issue marked resolved
- escalation created
- manual review requested

No v1 support/admin diagnostics mission should introduce operator mutation controls.

## Recommended Support/Admin Visibility Model

The safest future model is a new support-safe diagnostic read model, not a raw grant dump.

Suggested shape:

- `SupportInstitutionAccessDiagnosticSummary`
- `SupportInstitutionAccessAuditEvent`
- `SupportInstitutionAccessVisibility`
- `SupportInstitutionAccessDiagnosticReason`

The summary should include:

- grant id
- lifecycle
- audience
- purpose
- status category
- created/updated/expires/revoked timestamps
- consent status category
- redacted tenant reference
- redacted recipient reference
- recipient organization label, if present
- opened review count
- blocked attempt count
- revoked/expired event count
- last activity timestamp
- last safe reason code
- public access disabled flag
- recipient download disabled flag
- support/internal payload excluded flag
- trust payload excluded flag

The diagnostic timeline should include:

- event type
- occurred timestamp
- actor type
- outcome
- status
- reason code
- metadata-only flag

It should not include:

- trust package payload
- included or excluded claim contents
- portable attestation export summaries
- policy decision arrays
- raw provider payload flags beyond safe boolean guardrail summaries
- raw recipient review summaries
- session secrets or tokens

## Safe Reason Visibility

Safe for operators:

- `access_granted`
- `access_revoked`
- `access_expired`
- `grant_expired`
- `grant_revoked`
- `grant_blocked`
- `tenant_consent_missing`
- `recipient_email_mismatch`
- `trust_reverification_required`
- `policy_gated_summary_unavailable`
- `recipient_authentication_required`
- `review_available`

Use plain-language descriptions carefully:

- "Recipient did not match the tenant-authorized recipient."
- "Grant was revoked by tenant."
- "Grant expired."
- "Policy gate did not produce an export-safe summary."
- "Consent was missing or no longer active."

Avoid descriptions that reveal:

- exact policy internals
- fraud signals
- identity provider details
- property authority internals
- screening/credit provider state
- internal risk scoring

## Institution Semantics

Safe operational language:

- "tenant-mediated access grant"
- "metadata-only trust review"
- "authenticated recipient review"
- "access lifecycle"
- "policy-gated summary"
- "grant revoked"
- "grant expired"
- "blocked reason category"
- "support-safe diagnostic metadata"

Unsafe operational language:

- "verified tenant"
- "approved tenant"
- "eligible tenant"
- "creditworthy"
- "insurable"
- "KYC approved"
- "government verified"
- "institution approved"
- "trusted score"
- "fraud cleared"
- "source of truth"

Support/admin tooling should describe operational state, not institutional conclusions.

## Readiness Assessment

Readiness: **Ready for a narrow support-safe diagnostics implementation.**

Ready because:

- tenant access grants have deterministic lifecycle and event history
- recipient review writes metadata-only opened/blocked/revoked/expired events
- tenant audit summaries already derive safe redacted views
- support-console patterns already require admin permission and access logging
- governance utilities already support redaction and support diagnostics retention
- institutional trust export packages already separate support/internal metadata from export-safe summaries

Not ready for:

- broad trust browsing
- support-visible raw portable attestation contents
- operator mutation or override controls
- institution-facing support dashboards
- external provider or institution integrations
- recipient download support
- public trust exposure
- automated decisions

## Recommended Next Mission

Recommended:

`feat/support-safe-institution-access-diagnostics-v1`

Scope should be:

- additive support/admin read-only diagnostics
- permission-scoped to `system.admin`
- metadata-only and redacted
- audit-logged on every diagnostic access
- derived from tenant institution access grant event history
- no trust payloads
- no portable attestation contents
- no recipient downloads
- no tenant or recipient visibility changes
- no operator mutation controls

Do not select:

- `feat/operator-audit-timeline-v1` as the immediate next mission unless it is constrained to institution-access diagnostic access logging. A broad operator timeline would be useful later, but the immediate support gap is workflow-specific diagnostics.
- Additional governance/redaction hardening first. Existing governance helpers are sufficient for a narrow implementation if reused conservatively.
- Tenant/recipient UX hardening first. Current operational risk is supportability, not tenant/recipient comprehension.
- Institution/provider readiness planning first. Institution access should not expand until support diagnostics are mature.

## Regression Risks For Future Implementation

- accidentally returning `package.exportSummaries`, `includedClaims`, or `excludedClaims` in support diagnostics
- exposing exact recipient email where redacted email is sufficient
- failing to log operator diagnostic access
- allowing support/admin diagnostics to become exportable
- adding mutation controls such as revoke, resend, override, or impersonation
- reusing tenant-facing copy that implies trust conclusions
- showing policy reasons too granularly and exposing internal risk logic
- treating support-visible diagnostics as portable trust metadata

## Acceptance Criteria Mapping

- Support/admin readiness audit completed: yes
- Operator visibility boundaries documented: yes
- Redaction requirements documented: yes
- Governance/privacy risks documented: yes
- Auditability requirements documented: yes
- Safest operational visibility model identified: yes
- Product behavior changes introduced: no
- Support/admin implementation introduced: no
- Next recommended mission identified: `feat/support-safe-institution-access-diagnostics-v1`

## Verification Plan

This mission is documentation-only.

Required verification:

- `git diff --check`
- confirm only documentation changed
- confirm no lockfile or production code drift

No `npm run test` or `npm run build` is required because no code-adjacent files are changed.

