# External Counsel Packet Materials v1

**Document type:** Documentation-only. No product or code changes.
**Scope:** Counsel preparation materials for the RentChain controlled pilot institution review workflow.
**Prepared:** 2026-05-11
**Status:** Draft — for external legal/compliance counsel review only.

## Non-Legal-Advice Notice

This document is a preparation package for qualified Canadian legal/compliance counsel. It is not legal advice, does not approve any pilot launch, does not constitute a legal opinion, and does not replace jurisdiction-specific review by qualified counsel. All legal-language drafts in this document are explicitly marked **[FOR COUNSEL REVIEW]** and must be reviewed and approved by qualified counsel before use.

---

## Contents

1. Data-Flow Diagram — Tenant-Mediated Institution Review
2. Institution-Visible Metadata Field Inventory
3. Excluded-Data Inventory
4. Screenshot and Demo Checklist
5. Sample Invite / Delivery Email Copy As Rendered
6. Sample Recipient Onboarding Acknowledgement As Rendered
7. Next Mission Recommendation

---

## 1. Data-Flow Diagram — Tenant-Mediated Institution Review

This is a textual representation of the institution review data flow as implemented. No visual screenshots are included; a visual diagram should be produced separately for the counsel packet.

### Source Files

- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`
- `rentchain-api/src/routes/recipientTrustReviewRoutes.ts`
- `rentchain-api/src/lib/institutionReviewSessions/deriveInstitutionReviewSession.ts`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/pages/RecipientTrustReviewPage.tsx`
- `rentchain-frontend/src/api/tenantInstitutionAccess.ts`

### Step-by-Step Data Flow

```
STEP 1: TENANT CREATES INSTITUTION REVIEW INVITE
─────────────────────────────────────────────────
Actor:        Tenant (authenticated RentChain account)
Surface:      Tenant Workspace (TenantWorkspacePage.tsx)
API:          createInstitutionReviewInvite()
Data entered:
  - recipient email (required)
  - audience: one of { insurer | lender | institutional_landlord | auditor }
  - purpose:  one of { insurance_review | lender_review |
                       institutional_landlord_review | auditor_review }
  - optional: organizationName, expiresAt
Data created:
  - TenantInstitutionAccessGrant (stored in Firestore)
  - consent record (consentVersion: tenant_institution_access_consent.v1)
  - included/excluded claim categories (policy-gated)
  - grantId (internal canonical ID)
Data NOT created at this step:
  - No email sent yet
  - No recipient session yet
  - No trust payload exposed yet

STEP 2: TENANT TRIGGERS DELIVERY
────────────────────────────────
Actor:        Tenant (authenticated)
Surface:      Tenant Workspace
API:          resendInstitutionReviewDelivery()
Eligibility checks before delivery:
  ✓ recipient email present
  ✓ authenticationRequirement === "recipient_email_session_required"
  ✓ grant.lifecycle === "active"
  ✓ not revoked (grant.lifecycle, grant.revokedAt, consent.revokedAt)
  ✓ not expired (grant.lifecycle, grant.expiresAt vs now)
  ✓ consent.granted === true and consentId present
  ✓ trust export package status === "export_ready"
  ✓ no unsafe recipient payload
  ✓ policy-gated summary available
If any check fails: delivery is blocked; no email is sent.
Data sent in email (see Section 5 for full copy):
  - recipient email address
  - audience label (human-readable)
  - purpose label (human-readable)
  - expiration (human-readable)
  - review URL (entry point only — not authorization)
Data NOT sent in email:
  - No trust metadata
  - No raw claim data
  - No token that bypasses authentication
  - No tenant identity

STEP 3: RECIPIENT RECEIVES EMAIL AND NAVIGATES TO REVIEW URL
──────────────────────────────────────────────────────────────
Actor:        Recipient (external, unauthenticated at this point)
Surface:      Delivery email → review URL
Data at this step:
  - grantId (embedded in URL path)
  - No trust payload is accessible without authentication
Control:      URL possession alone does not grant access

STEP 4: RECIPIENT AUTHENTICATES
────────────────────────────────
Actor:        Recipient
Surface:      RentChain authentication gate
Mechanism:    Firebase Auth (email-based session)
Check:        recipient's authenticated email must match
              grant.recipient.email (normalized, hashed comparison)
Block states returned if check fails:
  - wrong_recipient
  - unauthenticated
  - session_expired
  - session_revoked
  - reauthentication_required
Data NOT visible at this step:
  - No trust metadata before authentication completes
  - No grant details before email match is confirmed

STEP 5: RECIPIENT SEES INSTITUTION REVIEW ONBOARDING
──────────────────────────────────────────────────────
Actor:        Recipient (authenticated, email-matched)
Surface:      RecipientTrustReviewPage.tsx — onboarding panel
Data shown:
  - onboarding.copy.title
  - onboarding.copy.intro
  - onboarding.copy.bullets (4 items — see Section 6)
  - onboarding.copy.acknowledgement checkbox
  - onboarding.copy.supportGuidance (3 items — see Section 6)
Behavior:
  - Metadata is NOT shown until acknowledgement checkbox is checked
    and "Continue to metadata review" button is clicked
  - Acknowledgement triggers API call with
    onboardingAcknowledged = true header
  - Acknowledgement event is recorded:
    institution_review_onboarding_acknowledged
Data NOT shown at this step:
  - No trust claim metadata
  - No included claim labels
  - No claim lifecycle states

STEP 6: RECIPIENT REVIEWS METADATA-ONLY SUMMARY
────────────────────────────────────────────────
Actor:        Recipient (authenticated, email-matched, onboarding acknowledged)
Surface:      RecipientTrustReviewPage.tsx — review scope + included metadata panels
Data shown:
  Review scope panel:
    - recipient email
    - audience (human-readable)
    - purpose (human-readable)
    - grant expiry timestamp
    - session expiry timestamp
  Included metadata panel:
    - claimLabel (human-readable label per claim)
    - claimCategory (machine category — see Field Inventory, Section 2)
    - lifecycleState (human-readable lifecycle label)
    - consentExpiresAt (timestamp)
  Excluded metadata panel:
    - redactions list (items excluded by policy — see Section 3)
    - "Recipient downloads are disabled."
    - "Public profiles and public trust URLs are not created."
  Disclaimers (always shown):
    - "This review is tenant-authorized, metadata-only, and view-only."
    - "This review is not a credit, insurance, subsidy, ownership,
       government, or automated eligibility decision."
    - "Raw identity documents, raw provider payloads,
       support/internal metadata, public profiles, and
       downloads are excluded."
    - Plus any grant-specific disclaimer entries
Data NOT shown:
  - See Section 3 (Excluded-Data Inventory) for full list

STEP 7: TENANT REVOKES OR ACCESS EXPIRES
─────────────────────────────────────────
Actor:        Tenant (revocation) or system (expiration)
Surface:      Tenant Workspace (revoke action) or lifecycle evaluation
Effect:
  - grant.lifecycle transitions to "revoked" or "expired"
  - Future recipient requests return blocked lifecycle state
  - Recipient sees "Review unavailable" with reason
  - Active review sessions become invalid
  - Re-authentication does not restore access
  - Only tenant re-authorization can restore access
Limitation (must be disclosed):
  - RentChain cannot control information the recipient has
    already viewed, noted, copied, or remembered

STEP 8: SUPPORT / OPERATOR DIAGNOSTIC ACCESS
─────────────────────────────────────────────
Actor:        RentChain support operator (internal only)
Surface:      Support console (SupportDebugConsolePage, operatorAuditTimeline,
              securityAccessForensics)
Data accessible:
  - Redacted lifecycle metadata
  - Grant lifecycle state
  - Delivery event history (prepared, sent, failed, blocked, resent, revoked)
  - Recipient authentication events (redacted — no raw PII)
  - Wrong-recipient, replay, stale-session, revoked, expired events
  - Onboarding lifecycle events
  - Policy-denial reasons
Data NOT accessible via support console:
  - Raw trust payloads
  - Raw provider payloads
  - Raw identity documents
  - Security telemetry raw payloads
  - Recipient-side notes or screenshots

STEP 9: SECURITY TELEMETRY (INTERNAL ONLY)
────────────────────────────────────────────
Classification:  security_session_internal
Retention:       Active 180 days → Archive → Retention expiry 365 days
                 → Purge-pending grace 30 days → Purged
Visible to:      Internal only (never tenant, never recipient, never institution)
Contains:        Hashed/redacted session references, lifecycle signals,
                 blocked-access signals, replay indicators
Does NOT contain: Raw IPs, full user agents, precise geolocation,
                  device fingerprints, behavioral profiles, trust payloads
Note:            Destructive purge job not yet implemented (pre-pilot gap)
```

### Tenant Authorization — Consent Record Structure

At Step 1, the following consent record is created and stored:

```
consentVersion:    tenant_institution_access_consent.v1
granted:           true (boolean)
consentId:         [platform-generated UUID]
grantedAt:         [ISO timestamp]
expiresAt:         [ISO timestamp — set by tenant or policy default]
revokedAt:         null until revocation
audience:          one of { insurer | lender | institutional_landlord | auditor }
purpose:           one of { insurance_review | lender_review |
                            institutional_landlord_review | auditor_review }
recipientEmail:    [tenant-provided recipient email]
claimCategories:   [array of claim category strings — policy-gated]
summary:           [human-readable consent summary string]
```

**[FOR COUNSEL REVIEW]** Confirm whether this consent record structure satisfies PIPEDA meaningful consent requirements for each audience/purpose combination. Confirm whether additional fields are required (e.g., explicit purposes statement per PIPEDA Schedule 1 Clause 4.3).

---

## 2. Institution-Visible Metadata Field Inventory

This inventory lists every field or data element that may be visible to an authenticated, authorized institution recipient during a metadata-only review. Sources: `portableAttestationTypes.ts`, `tenantInstitutionAccessService.ts`, `RecipientTrustReviewPage.tsx`.

### 2a. Review Scope Fields (Always Visible After Authentication)

| Field | Source | Value Type | Notes |
|---|---|---|---|
| `recipient.email` | grant record | string | The authorized recipient email address |
| `audience` | grant record | enum (see 2c) | Human-readable audience label |
| `purpose` | grant record | enum (see 2d) | Human-readable purpose label |
| `expiresAt` | grant record | ISO timestamp | Grant expiration — shown as localized datetime |
| `session.expiresAt` | session record | ISO timestamp | Current review session expiration |

### 2b. Per-Claim Metadata Fields (Visible After Onboarding Acknowledged)

For each claim included in the tenant-authorized review, the following fields are shown:

| Field | Source | Value Type | Notes |
|---|---|---|---|
| `claimLabel` | claim record | string | Human-readable label for the claim type |
| `claimCategory` | claim record | enum (see 2e) | Machine-readable category identifier |
| `lifecycleState` | derived | enum | Current lifecycle state of the claim (see 2f) |
| `consentExpiresAt` | claim record | ISO timestamp | When the underlying consent for this claim expires |

### 2c. Audience Enum Values (as implemented)

| Value | Human-readable label |
|---|---|
| `insurer` | Insurer |
| `lender` | Lender |
| `institutional_landlord` | Institutional landlord |
| `auditor` | Auditor |

**[FOR COUNSEL REVIEW]** Confirm whether any of these audience types creates regulatory exposure (insurance regulation, credit reporting, financial services regulation) before those audience types are enabled in pilot grants.

### 2d. Purpose Enum Values (as implemented)

| Value | Human-readable label |
|---|---|
| `insurance_review` | Insurance review |
| `lender_review` | Lender review |
| `institutional_landlord_review` | Institutional landlord review |
| `auditor_review` | Auditor review |

**[FOR COUNSEL REVIEW]** Confirm whether `insurance_review` and `lender_review` purposes create any regulatory classification risk even when the review is metadata-only.

### 2e. Claim Category Enum Values (as implemented in portableAttestationTypes.ts)

These are the machine-readable category identifiers that may appear in the `claimCategory` field. The human-readable `claimLabel` is set per-claim at grant creation. The categories a given recipient sees depend on which claims were included by the tenant's policy-gated grant.

| Category Value | Likely Human-Readable Meaning |
|---|---|
| `account_control` | Account / platform access control status |
| `identity_assurance` | Identity verification / assurance status |
| `business_legitimacy` | Business/organizational legitimacy context |
| `property_registry_linkage` | Property title or registry association |
| `property_authority` | Authority over a specific property |
| `operator_authority` | Operational authority or role |
| `lease_participation` | Lease participation status |
| `document_provenance` | Document origin / chain of custody status |
| `tenant_portability` | Tenant portability record status |
| `payment_readiness` | Payment readiness / financial workflow status |
| `institution_review` | Institution review workflow status |

**[FOR COUNSEL REVIEW]** Review each category label for:
- Whether any category encodes or enables inference about a protected characteristic under the Ontario Human Rights Code or Nova Scotia Human Rights Act (particularly: source of income, family status, disability, national origin).
- Whether `payment_readiness` metadata could be characterized as financial or creditworthiness information.
- Whether `identity_assurance` metadata constitutes a consumer report under Ontario's Consumer Reporting Act.
- Whether any category should be restricted or relabeled before institution pilots.

### 2f. Lifecycle State Enum Values (as implemented)

Claim lifecycle states visible in institution review:

| State | Meaning |
|---|---|
| `draft` | Claim exists but is not yet export-ready |
| `consent_required` | Claim requires additional tenant consent |
| `export_ready` | Claim is current and available for authorized review |
| `expired` | Claim's consent or validity period has lapsed |
| `revoked` | Claim has been explicitly revoked |
| `superseded` | A newer version of this claim exists |
| `reverification_required` | Claim requires re-verification before it remains current |
| `blocked` | Claim is blocked from display by policy |

**[FOR COUNSEL REVIEW]** Confirm that lifecycle state labels, particularly `export_ready` and `reverification_required`, do not imply a legal certification, regulatory approval, or institution-reliance guarantee.

### 2g. Static Disclaimers (Always Appended to Every Review)

The following disclaimers are always included in the institution review response payload and must be rendered:

```
1. "This review is tenant-authorized, metadata-only, and view-only."
2. "This review is not a credit, insurance, subsidy, ownership, government,
   or automated eligibility decision."
3. "Raw identity documents, raw provider payloads, support/internal metadata,
   public profiles, and downloads are excluded."
[plus any grant-specific disclaimers appended at grant creation]
```

**[FOR COUNSEL REVIEW]** Confirm that disclaimer language is legally sufficient for each audience type and does not create any unintended contractual representation.

### 2h. Review Scope — Counsel Summary

The full set of data institution recipients may see is bounded to:
- The review scope fields listed in 2a
- Per-claim metadata fields listed in 2b
- Claim categories listed in 2e (only those included in the specific grant)
- Lifecycle state labels listed in 2f
- Static disclaimers listed in 2g
- Policy-gated redactions and exclusion reasons (where shown)

No raw documents, no financial payloads, no biometric data, no screening reports, no credit bureau data, no internal notes, no telemetry, and no downloadable exports are included.

---

## 3. Excluded-Data Inventory

This section documents all data categories that are explicitly excluded from institution review. These exclusions are enforced at the service layer and must not appear in any institution review payload.

### 3a. Excluded Raw Payloads

| Category | Notes |
|---|---|
| Raw government ID images | Identity documents are never passed to institution review |
| Biometric data / liveness payloads | Not collected or exposed in this workflow |
| SIN / SSN or equivalent | Not stored or exposed in institution review |
| Raw screening reports | Screening provider outputs are not included |
| Raw credit bureau payloads | Credit bureau data is not passed to institution review |
| Raw open-banking / banking payloads | Financial source data is not included |
| Raw title / registry / property-provider payloads | Property source data is not included |
| Raw identity document files | Document files are not accessible in institution review |
| Raw property document files | Property files are not accessible in institution review |
| Raw internal trust package payloads | Internal composite records are not exposed |
| Raw provider payloads of any kind | Provider-supplied raw data is excluded |

### 3b. Excluded Internal / Support Data

| Category | Notes |
|---|---|
| Support console notes | Internal support notes are never shown |
| Operator private notes | Operator-entered notes are excluded |
| Internal governance notes | Governance process notes are excluded |
| Internal policy internals | Beyond safe blocked-category labels, policy internals are excluded |
| Hidden confidence calculations | No internal scoring or confidence values are shown |
| Tenant scoring outputs | No tenant score, trust score, or risk score is shown |
| Risk scoring outputs | Not part of the institution review model |
| Audit log detail | Internal audit timeline is support-safe, not institution-visible |

### 3c. Excluded Security / Telemetry Data

| Category | Notes |
|---|---|
| Access token hashes | Session tokens are internal only |
| Session fingerprints | Internal session tracking is not exposed |
| Raw IP addresses | Not shown in institution review or telemetry summaries |
| Full user agents | Browser/device strings are not shown |
| Precise geolocation | Not collected or exposed |
| Device fingerprints | Not part of the platform model |
| Behavioral profiles | Not modeled or exposed |
| Security telemetry events | Internal only — never shown to institutions or tenants |
| Access forensics / security forensics | Internal only |
| Telemetry retention internals | Internal governance only |

### 3d. Excluded Conclusions / Decisions

| Category | Notes |
|---|---|
| Approval decisions | RentChain does not produce approvals |
| Eligibility determinations | RentChain does not produce eligibility determinations |
| Credit assessments | RentChain does not produce credit assessments |
| Insurance eligibility | RentChain does not produce insurance eligibility outputs |
| Subsidy eligibility | RentChain does not determine subsidy eligibility |
| Government verification conclusions | Not part of the RentChain model |
| Underwriting conclusions | Not part of the RentChain model |
| Automated decision outputs | Automated decisions are not made by RentChain |

### 3e. Excluded Download / Export Formats

| Category | Notes |
|---|---|
| Downloadable institution trust exports | Downloads are disabled in institution review |
| PDF or file exports of review summary | Not available |
| Portable attestation packages (downloadable) | Not available in institution review |
| Public trust profile URLs | Not created |
| Public trust profile pages | Not created |
| Institution API access to tenant records | Not available |

**[FOR COUNSEL REVIEW]** Confirm that the excluded-data categories in 3a–3e are sufficient for each pilot partner type, and that no included category label in Section 2e could create an implicit disclosure of an excluded category through inference.

---

## 4. Screenshot and Demo Checklist

Screenshots and demo recordings cannot be generated from static source files. The following is the checklist of visual artifacts that should be captured from the live environment before the counsel packet is finalized.

### Required Screenshots

| # | Surface | What to Capture | File Suggested |
|---|---|---|---|
| 1 | Tenant Workspace — Institution Review section | Full invite creation form showing: recipient email field, audience dropdown (values: insurer, lender, institutional_landlord, auditor), purpose dropdown, organization name field, expiration field, consent checkbox, create button | `screenshot-01-tenant-invite-creation-form.png` |
| 2 | Tenant Workspace — Active grants list | Active grant card showing: recipient email (redacted), audience, purpose, lifecycle badge (active), expiration, revoke button, resend delivery button | `screenshot-02-tenant-active-grant-card.png` |
| 3 | Tenant Workspace — Revoked grant state | Grant card after revocation showing: lifecycle badge (revoked), revoked-at timestamp, no resend available | `screenshot-03-tenant-revoked-grant-state.png` |
| 4 | Tenant Workspace — Expired grant state | Grant card after expiration showing: lifecycle badge (expired) | `screenshot-04-tenant-expired-grant-state.png` |
| 5 | Tenant Workspace — Consent confirmation | Any consent confirmation or acknowledgement modal shown before invite creation | `screenshot-05-tenant-consent-confirmation.png` |
| 6 | Recipient review — Unauthenticated / redirect | What recipient sees before signing in (should show no trust data, only authentication prompt) | `screenshot-06-recipient-unauthenticated-redirect.png` |
| 7 | Recipient review — Onboarding panel | Full onboarding panel showing: title, intro, 4 bullet points, acknowledgement checkbox, "Continue to metadata review" button, support guidance text | `screenshot-07-recipient-onboarding-panel.png` |
| 8 | Recipient review — Review scope panel | Review scope panel after acknowledgement showing: recipient email, audience, purpose, expires, session expires | `screenshot-08-recipient-review-scope-panel.png` |
| 9 | Recipient review — Included metadata panel | Included metadata panel showing: claim labels, claim categories, lifecycle states, consent expiry timestamps (use demo/test data only — no real tenant data) | `screenshot-09-recipient-included-metadata-panel.png` |
| 10 | Recipient review — Excluded metadata panel | Excluded metadata panel showing: redaction list items, "downloads are disabled" note, "public profiles not created" note | `screenshot-10-recipient-excluded-metadata-panel.png` |
| 11 | Recipient review — Full page with disclaimers | Full page scroll showing header disclaimer copy: "This view is authenticated, tenant-mediated, audience-scoped, purpose-scoped, and view-only. It is not an approval, eligibility, credit, insurance, subsidy, ownership, government, or automated decision." | `screenshot-11-recipient-page-header-disclaimer.png` |
| 12 | Recipient review — Wrong recipient blocked | What a non-matching recipient sees: "Review unavailable" with blocked reason | `screenshot-12-recipient-wrong-recipient-blocked.png` |
| 13 | Recipient review — Revoked access state | What recipient sees when grant has been revoked: "Review unavailable" with revocation message | `screenshot-13-recipient-revoked-access-state.png` |
| 14 | Recipient review — Expired access state | What recipient sees when grant has expired: "Review unavailable" with expiration message | `screenshot-14-recipient-expired-access-state.png` |
| 15 | Recipient review — Reauthentication required | Stale/mismatched session requiring sign-in again | `screenshot-15-recipient-reauthentication-required.png` |

### Screenshot Preparation Notes

- Use demo / test tenant accounts only. Do not capture real personal information.
- Redact recipient email addresses in screenshots before including in counsel packet.
- Capture screenshots at a standard desktop viewport (1280×800 or similar).
- Annotate screenshots with numbered callouts identifying the key disclosure elements if possible.
- Screenshots should be stored in `docs/compliance/screenshots/` when captured.
- Screenshots are not present in this document. This checklist is the guide for capturing them.

**[FOR COUNSEL REVIEW]** Counsel should review screenshots 7, 8, 9, 10, and 11 specifically for adequacy of disclosure language and accessibility/plain-language standards.

---

## 5. Sample Invite / Delivery Email Copy As Rendered

The following is the exact email copy as constructed by `sendInstitutionReviewInviteEmail()` in `tenantInstitutionAccessService.ts`. Placeholder values are in `[brackets]`. No production data is included.

### Subject

```
RentChain tenant-authorized trust review invitation
```

### Preheader (email preview text)

```
A tenant has authorized a limited metadata-only RentChain trust review.
```

### Body — Plain Text Version

```
A RentChain tenant has authorized a limited institution trust review
[for {organizationName}]. You must sign in with {recipientEmail} before
any review summary can be shown.

• Audience: {audienceLabel}
• Purpose: {purposeLabel}
• Expires: {expiresAt or "Time-bound access"}
• The review is metadata-only, view-only, and tenant-mediated.
• This is not an approval, eligibility decision, credit report,
  public profile, or automated decision.
• Raw identity documents, provider payloads, support/internal notes,
  and downloads are not included.

[Sign in to review]
{reviewUrl}

This invitation does not grant access by itself. Recipient
authentication and tenant authorization are required before review.
```

### Body — HTML Version (structural summary)

```
Title:    Tenant-authorized trust review

Body:
  A RentChain tenant has authorized a limited institution trust review
  [for {organizationName}]. You must sign in with {recipientEmail}
  before any review summary can be shown.

  Bullet list:
  • Audience: {audienceLabel}
  • Purpose: {purposeLabel}
  • Expires: {expiresAt or "Time-bound access"}
  • The review is metadata-only, view-only, and tenant-mediated.
  • This is not an approval, eligibility decision, credit report,
    public profile, or automated decision.
  • Raw identity documents, provider payloads, support/internal notes,
    and downloads are not included.

CTA button: "Sign in to review"
  URL: {reviewUrl}

Footer:
  This invitation does not grant access by itself. Recipient
  authentication and tenant authorization are required before review.
```

### Sample Rendered Email With Demo Values

The following uses demo/placeholder values only. No real tenant or recipient data.

```
Subject: RentChain tenant-authorized trust review invitation

Preheader: A tenant has authorized a limited metadata-only RentChain trust review.

────────────────────────────────────────────────────────────────

  Tenant-authorized trust review

  A RentChain tenant has authorized a limited institution trust review
  for Demo Housing Partners Ltd. You must sign in with
  reviewer@demohousing.example before any review summary can be shown.

  • Audience: Institutional landlord
  • Purpose: Institutional landlord review
  • Expires: 2026-06-15 at 11:59 PM
  • The review is metadata-only, view-only, and tenant-mediated.
  • This is not an approval, eligibility decision, credit report,
    public profile, or automated decision.
  • Raw identity documents, provider payloads, support/internal notes,
    and downloads are not included.

  [ Sign in to review ]
    → https://app.rentchain.ai/institution-review/[GRANT-ID-REDACTED]

  This invitation does not grant access by itself. Recipient
  authentication and tenant authorization are required before review.

────────────────────────────────────────────────────────────────
```

**[FOR COUNSEL REVIEW]** Review this email copy for:
- Whether delivery of this email to a named recipient constitutes a regulated disclosure under any provincial or federal statute.
- Whether the disclaimers in the bullet list are adequate for each audience type.
- Whether the footer notice is sufficient to prevent reliance on the link as authorization.
- Whether the email copy constitutes a consumer report or any component thereof.
- Whether the email subject line requires modification for any regulated partner category.
- Whether any additional statutory notice is required before this email is sent for insurer, lender, subsidy, or government audience types.

---

## 6. Sample Recipient Acknowledgement Text As Rendered

The following is the exact onboarding copy as implemented in `tenantInstitutionAccessService.ts` (`buildRecipientReviewSummary`, onboarding copy block, lines ~2391–2408). This is the copy displayed on the onboarding panel before any trust metadata is shown. No product changes are made by including this copy here.

### Onboarding Panel Title

```
Institution review orientation
```

### Onboarding Panel Intro Paragraph

```
A tenant authorized this limited RentChain review for the invited
recipient, audience, and purpose shown here.
```

### Onboarding Panel Bullet Points (4 items)

```
• You must remain signed in with the invited recipient email before
  review metadata can be shown.

• The review is metadata-only and view-only; raw trust payloads,
  provider payloads, identity documents, support/internal notes,
  public profiles, and downloads are excluded.

• Access is time-bound, policy-gated, lifecycle-governed, and may be
  revoked by the tenant.

• RentChain is not making an approval, eligibility, credit, insurance,
  subsidy, government, or automated decision.
```

### Acknowledgement Checkbox Label

```
I understand this is a tenant-authorized, metadata-only, revocable,
time-bound review and not an approval or eligibility decision.
```

### Acknowledgement Button Label

```
Continue to metadata review
```

### Support Guidance Lines (shown below the checkbox, before proceeding)

```
If you are not the intended recipient, ask the tenant to send a new
invitation to the correct email.

If access is expired or revoked, the tenant must re-authorize review
before metadata can be shown again.

If authentication fails, sign in with the invited recipient email
before retrying.
```

### Page Header Disclaimer (always visible, above onboarding and review)

This disclaimer appears in the page header above all other content:

```
[Label: Tenant-authorized trust review]

Metadata-only recipient review

This view is authenticated, tenant-mediated, audience-scoped,
purpose-scoped, and view-only. It is not an approval, eligibility,
credit, insurance, subsidy, ownership, government, or automated
decision.
```

### Review Panel Disclaimers (always shown in review payload)

```
• This review is tenant-authorized, metadata-only, and view-only.
• This review is not a credit, insurance, subsidy, ownership,
  government, or automated eligibility decision.
• Raw identity documents, raw provider payloads, support/internal
  metadata, public profiles, and downloads are excluded.
[plus any grant-specific disclaimer entries]
```

### Full Rendered Onboarding Screen (Demo)

```
────────────────────────────────────────────────────────────────

[Label: Tenant-authorized trust review]
Metadata-only recipient review

This view is authenticated, tenant-mediated, audience-scoped,
purpose-scoped, and view-only. It is not an approval, eligibility,
credit, insurance, subsidy, ownership, government, or automated
decision.

────────────────────────────────────────────────────────────────

  Institution review orientation

  A tenant authorized this limited RentChain review for the invited
  recipient, audience, and purpose shown here.

  • You must remain signed in with the invited recipient email before
    review metadata can be shown.

  • The review is metadata-only and view-only; raw trust payloads,
    provider payloads, identity documents, support/internal notes,
    public profiles, and downloads are excluded.

  • Access is time-bound, policy-gated, lifecycle-governed, and may
    be revoked by the tenant.

  • RentChain is not making an approval, eligibility, credit,
    insurance, subsidy, government, or automated decision.

  ☐ I understand this is a tenant-authorized, metadata-only,
    revocable, time-bound review and not an approval or eligibility
    decision.

  [ Continue to metadata review ]   ← disabled until checkbox checked

  If you are not the intended recipient, ask the tenant to send a
  new invitation to the correct email.

  If access is expired or revoked, the tenant must re-authorize
  review before metadata can be shown again.

  If authentication fails, sign in with the invited recipient email
  before retrying.

────────────────────────────────────────────────────────────────
```

**[FOR COUNSEL REVIEW]** Review this onboarding copy for:
- Whether the acknowledgement checkbox and button constitute a binding acknowledgement by the recipient's organization, or only the individual.
- Whether organizational-level acknowledgement (signed terms, not just UI checkbox) is required before any live pilot.
- Whether the title "Institution review orientation" creates any implication of regulatory certification or institutional vetting.
- Whether the acknowledgement language is sufficient as a reliance disclaimer under applicable Canadian law.
- Whether any bullet point creates an unintended representation (e.g., "policy-gated" implying a regulatory approval gate).
- Whether AODA or plain-language accessibility standards require modifications to this copy.
- Whether the support guidance creates any support obligation or SLA representation.
- Whether any additional bullet points are required for specific audience types (insurer, lender, subsidy, government) before those audiences are enabled.

---

## 7. Next Mission Recommendation

**[INTERNAL — NOT FOR COUNSEL PACKET]**

Based on the legal/compliance panel review findings and the materials assembled in this document, the recommended next mission is:

---

### Option A: `strategy/legal-review-findings-and-action-plan-v1`

**Purpose:** Convert the panel review findings and external counsel responses (once received) into a prioritized action log, tracking each finding against a resolution status (open / in review / resolved / accepted risk). Documentation-only mission.

**Best suited when:** External legal/compliance counsel review has been completed or is in progress, and RentChain needs a formal issue tracking document to close gaps before pilots.

**Risk if skipped:** Legal/compliance gaps remain untracked and pilot authorization cannot be demonstrated.

---

### Option B: `feat/legal-and-operational-disclosure-hardening-v1`

**Purpose:** Implement the product and documentation changes identified as required before pilots — specifically: Privacy Policy institution review section, Terms governing law clause and institution recipient obligations, tenant consent UI improvements, revocation limitation disclosure, institution-facing onboarding acknowledgement improvements, and destructive purge job implementation.

**Best suited when:** Counsel has completed review and approved the specific changes to make. Premature without counsel sign-off because the exact text of Privacy Policy changes, consent language, and disclaimer language must be counsel-reviewed before implementation.

**Risk if done first:** Implementing disclosure language before counsel review may require re-implementing after review identifies changes. Also risks shipping materially incorrect legal language to production.

---

### Recommendation

**Proceed with Option A first (`strategy/legal-review-findings-and-action-plan-v1`).**

Reason: This counsel packet should be sent to qualified Canadian counsel before any implementation work begins. The action plan mission converts counsel's responses into a prioritized change log that can then drive the Option B implementation mission. Implementing disclosures before counsel review inverts the correct order of operations.

Option B (`feat/legal-and-operational-disclosure-hardening-v1`) should follow after:
1. External counsel has reviewed the panel findings and this counsel packet.
2. Counsel has approved or modified the specific language for Privacy Policy, Terms, consent UI, and onboarding disclosures.
3. The action plan from Option A identifies exactly which changes are required and what approved language to use.

**Exception:** The destructive purge job implementation (identified as a pre-pilot gap in telemetry retention) can proceed as a standalone technical mission independent of counsel review, since it does not touch disclosure language.

---

## Document Control

| Field | Value |
|---|---|
| Version | v1 |
| Status | Draft — for external counsel preparation only |
| Prepared | 2026-05-11 |
| Author | RentChain internal (simulated panel review output) |
| Legal review | Not yet completed — this document IS the pre-counsel preparation |
| Next step | Send to qualified Canadian privacy/regulatory/PropTech counsel |
| Do not use for | Pilot launch authorization, legal compliance clearance, marketing claims |
| Classification | Internal / counsel-preparation only |
