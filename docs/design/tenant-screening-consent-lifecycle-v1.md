# Tenant Screening Consent Lifecycle v1

## 1. Executive Summary

Tenant screening consent is already explicit and auditable in RentChain, but the product does not yet define what happens if a tenant later wants to withdraw that consent. That gap matters because withdrawal may be operationally possible before screening is submitted to a provider, but not after provider-side processing has already started.

This design proposes a cautious lifecycle model that distinguishes:

- withdrawal before provider submission
- post-submission concerns that can be recorded but must not be presented as guaranteed cancellation

This document does **not** implement revocation, UI, API changes, or provider behavior changes. It defines the recommended state model, wording, audit expectations, and future implementation sequencing.

## 2. Current State Summary

### Implemented behavior

- Tenant consent is captured through `POST /tenant/screening/:requestId/consent` in [tenantPortalRoutes.ts](/Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts:3848).
- Consent is stored in `screening_consents` with fields including:
  - `requestId`
  - `tenantId`
  - `applicantId`
  - `rentalApplicationId`
  - `landlordId`
  - `propertyId`
  - `providerKey`
  - `providerLabel`
  - `consentVersion`
  - `consentTextSummary`
  - `viewedAt`
  - `acceptedAt`
  - `acceptedBy`
  - `providerDisclosure`
- Screening requests are updated with consent-linked state in `screening_requests`, including `latestConsentId`, `status`, `consentedAt`, and `nextAction`.
- Tenant consent emits:
  - `consent_viewed` and `consent_accepted` into `screening_audit_log`
  - canonical `screening_consent_confirmed` through `writeCanonicalEvent(...)` in [tenantPortalRoutes.ts](/Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts:1088)
- Tenants can view screening requests in the dedicated inbox at `/tenant/screening` through [TenantScreeningInboxPage.tsx](/Users/rentchain/dev/rentchain/rentchain-frontend/src/pages/tenant/TenantScreeningInboxPage.tsx:1).
- Screening start is fail-closed on consent. `createScreeningSessionSafely(...)` requires an accepted consent record before screening can begin.

### Inferred behavior

- The current operational boundary for “submitted to provider” is effectively reached once provider session creation and/or provider handoff begins.
- `provider_session_created`, `screening_started`, redirect preparation, and callback events together form the practical boundary between “can still withdraw before submission” and “provider workflow has begun.”

### Open questions

- Whether provider submission should be defined at `screening_started`, `provider_session_created`, redirect preparation, or a stricter downstream event for each provider.
- Whether consent should expire if it is accepted but not used.
- Whether re-consent should be required per application only, or per provider submission attempt.

## 3. Proposed Consent States

### 1. `not_requested`

- Description: no screening request exists yet
- Allowed transitions: `requested`
- Tenant-facing label: No screening requested
- Landlord-facing label: No screening requested
- Tenant action allowed: none
- Landlord action allowed: create screening request

### 2. `requested`

- Description: landlord has requested screening but tenant has not consented
- Allowed transitions: `consented`, `expired`
- Tenant-facing label: Consent required
- Landlord-facing label: Tenant consent pending
- Tenant action allowed: authorize screening
- Landlord action allowed: remind / re-request, but not override

### 3. `consented`

- Description: tenant explicitly authorized screening, but provider submission has not yet occurred
- Allowed transitions: `withdrawn_before_submission`, `submitted_to_provider`, `expired`, `superseded`
- Tenant-facing label: Consent confirmed
- Landlord-facing label: Tenant consent confirmed
- Tenant action allowed: withdraw consent before submission
- Landlord action allowed: initiate screening submission if other gates pass

### 4. `withdrawn_before_submission`

- Description: tenant withdrew consent before screening was submitted to a provider
- Allowed transitions: `requested`, `consented`
- Tenant-facing label: Consent withdrawn before submission
- Landlord-facing label: Tenant withdrew consent before submission
- Tenant action allowed: optionally re-consent later
- Landlord action allowed: request new consent again, but not override withdrawal

### 5. `submitted_to_provider`

- Description: screening has been submitted or initiated with the provider
- Allowed transitions: `completed`, `locked_after_submission`
- Tenant-facing label: Screening submitted
- Landlord-facing label: Screening submitted to provider
- Tenant action allowed: view status, optionally raise post-submission concern in a future flow
- Landlord action allowed: monitor workflow, not request fresh submission without new consent flow

### 6. `completed`

- Description: screening workflow completed
- Allowed transitions: none, except future archival/supersession logic if a new screening cycle is created
- Tenant-facing label: Screening workflow completed
- Landlord-facing label: Screening workflow completed
- Tenant action allowed: view consent history
- Landlord action allowed: review audit history

### 7. `locked_after_submission`

- Description: consent remains auditable but cannot be operationally withdrawn through RentChain because provider submission already occurred
- Allowed transitions: `completed`
- Tenant-facing label: Consent history locked after submission
- Landlord-facing label: Consent locked for audit after provider submission
- Tenant action allowed: view consent history, possibly submit a post-submission concern in a later mission
- Landlord action allowed: continue monitoring, view audit trail

### 8. `expired` (future optional)

- Description: consent expired before use
- Allowed transitions: `requested`, `consented`
- Tenant-facing label: Consent expired
- Landlord-facing label: Consent expired
- Tenant action allowed: re-consent
- Landlord action allowed: request consent again

### 9. `superseded` (future optional)

- Description: a newer consent version replaced the previous version
- Allowed transitions: none for the old record; new record becomes active
- Tenant-facing label: Consent superseded
- Landlord-facing label: Consent superseded by newer version
- Tenant action allowed: none on the superseded record
- Landlord action allowed: use only the active consent version

## 4. Withdrawal Rules

### Withdrawal allowed

Withdrawal should be allowed only before provider submission, specifically when consent exists but the workflow has not crossed the provider submission boundary.

Recommended operational rule:

- withdrawal allowed while lifecycle state is `requested` or `consented`
- withdrawal blocked once the system records provider submission / provider session creation / provider handoff start

### Withdrawal not operationally allowed

Withdrawal should not be presented as operationally available when:

- screening has been submitted to a provider
- provider session has been created and handoff has begun
- workflow is completed
- provider-side processing is already underway

### Wording rules

- Do not say “delete screening”
- Do not say “erase report”
- Do not imply provider cancellation
- Use: “withdraw consent before screening is submitted”
- After submission, use: “RentChain can record your request or concern, but may not be able to undo provider-side processing already initiated.”

### Design options

#### Option A — Strict model

- Withdrawal control appears only before submission
- After submission, show explanation only

#### Option B — Request-to-review model

- Tenant can submit a post-submission withdrawal concern/request
- RentChain records it and notifies landlord/admin
- UI must not imply provider cancellation

### Recommendation

Recommend **Option A first**.

Reason:

- smallest risk of misleading tenants
- cleanest operational boundary
- easiest to make truthful in product copy
- avoids implying provider-side reversibility that may not exist

Option B can be considered later only as a carefully worded “request for review” flow, not a revocation promise.

## 5. Tenant-Facing UX Copy

### `requested`

“The landlord has requested screening for this rental application. Your authorization is required before screening can proceed.”

### `consented`

“Your screening consent has been recorded. Screening has not yet been submitted.”

### `withdrawn_before_submission`

“You withdrew screening consent before screening was submitted. The landlord has been notified.”

### `submitted_to_provider`

“Screening has already been submitted to the screening provider. RentChain records your consent history, but provider-side processing may already be underway.”

### `completed`

“Screening workflow completed.”

### `locked_after_submission`

“Consent history is locked for audit because screening was already submitted.”

### Button labels

- Authorize screening
- Withdraw consent
- View consent history
- Contact landlord

### Wording to avoid

- “revoke and delete”
- “cancel credit report”
- “guaranteed no impact”
- “approved”
- “denied”

## 6. Landlord-Facing Status / Notifications

### Suggested landlord-visible lifecycle labels

- Tenant consent pending
- Tenant consent confirmed
- Tenant withdrew consent before submission
- Screening submitted; consent locked for audit
- Tenant submitted post-submission concern (future optional)

### Notifications

Notify landlord when:

- tenant withdraws before submission
- consent is locked after provider submission
- tenant submits a post-submission concern in a future workflow

### Landlord actions

- request consent again if tenant withdrew before submission
- continue only if consent is active
- view audit trail
- may not override tenant withdrawal

## 7. Backend Data Model Implications

Recommended consent record fields:

### `consentStatus`

- `requested`
- `consented`
- `withdrawn_before_submission`
- `submitted_to_provider`
- `completed`
- `locked_after_submission`
- `expired`
- `superseded`

### timestamps

- `requestedAt`
- `consentedAt`
- `withdrawnAt`
- `submittedToProviderAt`
- `completedAt`
- `lockedAt`
- `expiresAt`

### actor metadata

- `consentedBy`
- `withdrawnBy`
- `submittedBy`
- `lockedBy`

### versioning

- `consentVersion`
- `consentTextSnapshot`
- `providerDisclosureSnapshot`

### provider

- `providerKey`
- `providerLabel`

### references

- `screeningRequestId`
- `rentalApplicationId`
- `landlordId`
- `tenantId`
- `applicantId`
- `propertyId`

### withdrawal metadata

- `withdrawalReason?`
- `withdrawalNote?`
- `withdrawalRequestedAfterSubmissionAt?`
- `withdrawalReviewStatus?: "not_applicable" | "pending" | "reviewed"`

Do **not** store raw credit report contents in consent records.

## 8. Audit / Canonical Events

### Proposed events

- `screening_consent_requested`
- `screening_consent_confirmed`
- `screening_consent_withdrawn_before_submission`
- `screening_consent_locked_after_provider_submission`
- `screening_consent_withdrawal_requested_after_submission`
- `screening_consent_superseded`
- `screening_consent_expired`

### Event expectations

#### `screening_consent_requested`

- Trigger: screening request reaches tenant consent-required state
- Actor: system or landlord-triggered workflow
- Metadata:
  - `screeningRequestId`
  - `rentalApplicationId`
  - `landlordId`
  - `tenantId` / `applicantId`
  - `providerKey`
  - `consentVersion`

#### `screening_consent_confirmed`

- Trigger: tenant explicitly accepts consent
- Actor: tenant
- Status: already implemented canonically today

#### `screening_consent_withdrawn_before_submission`

- Trigger: tenant withdraws before provider submission
- Actor: tenant

#### `screening_consent_locked_after_provider_submission`

- Trigger: provider submission boundary is crossed
- Actor: system

#### `screening_consent_withdrawal_requested_after_submission`

- Trigger: tenant raises a post-submission concern in a future design
- Actor: tenant

#### `screening_consent_superseded`

- Trigger: new consent version replaces old active consent
- Actor: system or tenant workflow

#### `screening_consent_expired`

- Trigger: consent expires before use
- Actor: system

### Sensitive exclusions

- no raw credit report contents
- no provider credentials
- no tenant SIN/SSN or similarly sensitive identifiers
- no provider session secrets

## 9. Screening Execution Gating

Recommended gating rules:

- screening can proceed only when `consentStatus = consented`
- screening blocked when `consentStatus = requested`
- screening blocked when `consentStatus = withdrawn_before_submission`
- workflow may continue for status tracking after `submitted_to_provider`, but that does not authorize a new submission
- re-screening after withdrawal requires new consent

### Structured blocked reasons

- `missing_tenant_consent`
- `consent_withdrawn`
- `consent_expired`
- `consent_version_outdated`
- `provider_already_submitted`

## 10. Provider Boundary / TransUnion-Specific Caution

RentChain controls workflow state, consent capture, and auditability. It does **not** control provider-side processing once submission has already occurred.

For TransUnion specifically:

- do not imply RentChain can cancel or erase provider-side processing unless contract/API behavior explicitly supports it
- do not equate “withdrawal request” with “provider cancellation”
- require legal/provider review before final production wording about post-submission limitations

## 11. Legal / Compliance Review Questions

1. Can a tenant withdraw consent after screening submission?
2. What exact wording should be used before provider submission?
3. What wording is safe after provider submission?
4. Is consent expiration required after a certain time?
5. Are separate consents required per application, per landlord, or per provider request?
6. What retention period applies to consent records?
7. What deletion/access rights must be reflected in the Privacy Policy?
8. What provider-specific disclosure language is required for TransUnion?

## 12. Future Implementation Missions

### Mission A — Tenant Consent Withdrawal Before Submission v1

- Objective: allow withdrawal only before provider submission
- Branch suggestion: `feat/tenant-consent-withdrawal-before-submission`
- Core scope:
  - tenant inbox withdrawal control
  - update consent status before submission
  - notify landlord
  - block screening execution after withdrawal
  - emit audit/canonical withdrawal event
- Non-goals:
  - no post-submission cancellation flow
  - no provider cancellation logic

### Mission B — Consent Locking After Provider Submission v1

- Objective: lock consent record for audit once provider submission occurs
- Branch suggestion: `harden/tenant-consent-lock-after-submission`
- Core scope:
  - set `submitted_to_provider` / `locked_after_submission`
  - show tenant-safe explanation after submission
  - emit lock event
- Non-goals:
  - no withdrawal button after submission
  - no provider-side cancellation promise

### Mission C — Consent Versioning + Expiry v1

- Objective: support version enforcement and optional expiration
- Branch suggestion: `feat/tenant-consent-versioning-expiry`
- Core scope:
  - enforce `consentVersion`
  - expire stale consent where policy requires it
  - require re-consent when needed
- Non-goals:
  - no provider behavior changes

### Mission D — Landlord Consent Lifecycle Visibility v1

- Objective: surface consent lifecycle to landlords
- Branch suggestion: `feat/landlord-screening-consent-lifecycle-visibility`
- Core scope:
  - landlord timeline/status updates
  - withdrawal notifications
  - audit trail display
- Non-goals:
  - no tenant revocation logic changes

## 13. Recommendation

Recommended path:

- implement withdrawal **before provider submission** first
- do **not** implement post-submission revocation as a simple cancel button
- add legal review before production wording
- preserve audit history and consent snapshots
- keep provider-specific cancellation out of scope unless contract/API behavior explicitly supports it

This sequence is the most defensible because it keeps tenant copy truthful, preserves auditability, and avoids overpromising provider-side reversibility.

