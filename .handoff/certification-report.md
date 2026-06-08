# Soft-Launch Certification Report

Certification result: PASS WITH CONDITIONS — Controlled pilot preparation only. Not public launch.

Date: 2026-06-07
Branch: audit/soft-launch-certification-v1

## Executive Summary

Soft launch is not certified. The codebase shows substantial readiness across tenant, landlord, contractor, lease signing, notice, billing, screening, and Firestore security foundations, and automated frontend validation is strong. However, the certification mission required seeded end-to-end workflow execution and a clear production Go/No-Go result. Seeded landlord, tenant, contractor, and admin accounts were not available in this environment, so the required browser/API workflow certification could not be completed.

The automated validation also does not meet a clean launch bar. Frontend build and tests passed, and backend build passed, but the full backend suite still has 8 failing files and 21 failing tests after rerunning outside the sandbox. Some failures are known from prior sessions, but the launch certification gate cannot treat a non-clean backend suite plus unexecuted seeded workflows as a pass.

Go/No-Go recommendation: PASS WITH CONDITIONS — Controlled pilot preparation only. Not public launch. Proceed only after seeded end-to-end certification is completed in a controlled preview/staging environment, backend suite failures are either fixed or formally waived with owner sign-off, and the listed security findings are resolved or accepted by a human release owner.

## Updated Certification Status — PR #1113

- Previous result: FAIL / NO-GO
- Updated result: PASS WITH CONDITIONS
- Date of update: 2026-06-07
- Evidence: 60 focused backend tests passing (leaseRoutes 30, contractorPortalRoutes 5, propertiesRoutes 25)
- Manual auth boundary: 401 confirmed on all fixed routes

Conditions documented by operator review:
1. Controlled pilot preparation only; not public launch.
2. PR #1113 blocker fixes must remain present on `origin/main`.
3. Focused backend coverage for the three fixed areas must remain passing.
4. Manual auth boundary checks must remain confirmed on all fixed routes.
5. Seeded preview/staging end-to-end QA remains required before public launch certification.
6. Broader launch blockers and known backend suite failures remain outside this conditional pass and must be fixed, waived, or accepted by release ownership before public availability.

## Validation Commands

- `npm --prefix rentchain-api run build`: PASS
- `npm --prefix rentchain-frontend run build`: PASS
- `npm --prefix rentchain-frontend run test -- --run`: PASS, 293 files and 1153 tests
- `npm --prefix rentchain-api run test -- --run`: FAIL after sandbox escalation, 453 files passed, 8 failed; 2213 tests passed, 21 failed
- `git diff --check`: PASS

Backend failing areas:
- `leaseDraftRoutes.test.ts`: lease draft activation/document attachment expectations
- `propertiesRoutes.test.ts`: stale registry retry expected rejection
- `recipientTrustReviewRoutes.test.ts`: recipient trust review session/status expectations
- `supportConsoleRoutes.test.ts`: support-safe institution access status expectation
- `deriveDecisionExecutionMappings.test.ts`: lease-renewal execution input expectation
- `landlordAnalyticsSnapshot.test.ts`: lease-renewal execution input expectation

## Seeded Test Account Section

Seeded account status: NOT COMPLETED

No landlord, tenant, contractor, or admin account credentials were created or recorded during this audit. The local environment did not provide safe seeded credentials, Firebase Auth setup, production-like storage configuration, Stripe test configuration, or provider test accounts required to execute the manual workflow checklist.

Future certification must store account credentials only in an approved secure channel, not in repository files. This report intentionally contains no passwords, tokens, raw account identifiers, or secrets.

## Workflow Results

### 1. Landlord Workflow

Status: NOT CERTIFIED

Evidence reviewed:
- `rentchain-api/src/routes/propertiesRoutes.ts`
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/PropertiesPage.tsx`

Findings:
- Landlord lease draft, generate, activate, signing, document URL, notes, archive, restore, and payment rail endpoints generally use `requireLandlord`.
- Some generic lease create/update/end and lease ledger endpoints rely on global auth decoding plus capability checks instead of explicit landlord middleware. No direct unauthenticated success was proven, but explicit role enforcement should be added or verified by tests before launch.
- Landlord frontend pages and tests exist, and frontend suite passed.

Certification outcome:
- End-to-end landlord workflow was not executed with a seeded account.
- Result: FAIL for certification, not enough runtime evidence.

### 2. Tenant Workflow

Status: NOT CERTIFIED

Evidence reviewed:
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/services/tenantPortal/tenantProjectionService.ts`
- `rentchain-api/src/services/tenantPortal/tenantSafeProjectionContract.ts`
- `rentchain-frontend/src/pages/tenant/TenantDashboardPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantLeasePage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantPaymentsPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantDocumentsPage.tsx`

Findings:
- Tenant portal routes require tenant role and tenant context through route-local tenant guard logic.
- Tenant projections use tenant-safe projection metadata and explicit excluded field groups for provider payloads, storage paths, payment tokens, internal ledger IDs, and unrelated tenant records.
- Tenant lease signing route exists and uses tenant relationship checks before projecting lease data.

Certification outcome:
- Tenant receive/view/sign/retrieve flow was not executed with a seeded tenant account.
- Cross-tenant direct access was not manually tested.
- Result: FAIL for certification, not enough runtime evidence.

### 3. Contractor Workflow

Status: NOT CERTIFIED

Evidence reviewed:
- `rentchain-api/src/middleware/requireContractor.ts`
- `rentchain-api/src/routes/contractorPortalRoutes.ts`
- `rentchain-api/src/services/contractorPortalService.ts`
- `rentchain-frontend/src/pages/contractor/ContractorDashboardPage.tsx`
- `rentchain-frontend/src/pages/contractor/ContractorJobsPage.tsx`
- `rentchain-frontend/src/pages/contractor/ContractorProfilePage.tsx`

Findings:
- Contractor portal routes enforce contractor/admin role and self-scope through `requireContractor` and `ensureSelf`.
- Work order reads are limited to assigned contractor records.
- Contractor status updates append work order update records with `rawIdsIncluded: false` and `payloadIncluded: false`.
- Contractor message projection currently returns `landlordId` in message rows. This should be changed to a safe reference or removed from contractor-facing output before public launch.

Certification outcome:
- Contractor assigned work order, status update, and isolation workflows were not executed with a seeded contractor account.
- Result: FAIL for certification, with a medium projection finding.

### 4. Lease Execution Workflow

Status: NOT CERTIFIED

Evidence reviewed:
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/services/signing/leaseSigningService.ts`
- `rentchain-api/src/services/signing/providers/mockSigningProvider.ts`
- `rentchain-api/src/services/__tests__/leaseSigningService.test.ts`
- `rentchain-api/src/services/signing/providers/__tests__/mockSigningProvider.test.ts`

Findings:
- Landlord signing endpoints exist for send, status, signed download, and cancellation.
- Tenant signing routes exist in tenant portal and call signing snapshot helpers.
- Signing service tests cover pending request creation, raw provider reference minimization, and terminal states from appended webhook events.
- Full provider-backed send/sign/retrieve flow was not executed in this environment.

Certification outcome:
- Not certified because no seeded lease execution workflow was run.

### 5. Notice Automation Workflow

Status: NOT CERTIFIED

Evidence reviewed:
- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- `rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts`
- `rentchain-api/src/services/__tests__/noticeValidationRules.test.ts`
- `rentchain-frontend/src/pages/tenant/TenantLeaseNoticesPage.tsx`

Findings:
- Landlord notice preview/send endpoints are gated by landlord auth and feature gating.
- Notice validation tests cover supported jurisdictions, blocked lease states, missing tenant/landlord/property/unit/rent context, and required deadlines.
- Tenant notice response routes exist.

Certification outcome:
- Notice generation/delivery/history was not manually executed with seeded data.
- Result: FAIL for certification, not enough runtime evidence.

### 6. Subscription Billing Workflow

Status: NOT CERTIFIED

Evidence reviewed:
- `rentchain-api/src/routes/billingRoutes.ts`
- `rentchain-frontend/src/pages/BillingPage.tsx`
- `rentchain-frontend/src/pages/BillingPage.test.tsx`
- `rentchain-frontend/src/api/billingApi.test.ts`

Findings:
- Subscription status endpoint is landlord-gated.
- Pricing endpoint is public and returns safe plan/pricing structures.
- Checkout route uses Stripe configuration and redacts sensitive transport details in helper code.
- Full Stripe test-mode checkout and failure handling were not executed.

Certification outcome:
- Billing cannot be certified without Stripe test configuration and seeded landlord account.
- Result: FAIL for certification, not enough runtime evidence.

### 7. Production Security Validation

Status: PARTIAL

Evidence reviewed:
- `firestore.rules`
- `rentchain-api/src/middleware/requireAuth.ts`
- `rentchain-api/src/middleware/authMiddleware.ts`
- `rentchain-api/src/middleware/requireLandlord.ts`
- `rentchain-api/src/middleware/requireContractor.ts`
- `rentchain-api/src/middleware/errorHandler.ts`
- `rentchain-api/src/lib/logging/safeLogger.ts`
- tenant and contractor projection services

Findings:
- Root Firestore rules now fail closed by default and include role-scoped rules for landlord, tenant, admin/support/operator, and append-only audit/event collections.
- Server-side auth middleware verifies bearer tokens and builds canonical session context.
- Tenant projections explicitly exclude raw provider payloads, raw screening reports, storage paths, provider delivery payloads, internal ledger IDs, payment tokens, and unrelated tenant data.
- Some logs still include broad error metadata in server-side output; API responses generally use safe error codes but runtime log review was not performed in a production-like environment.
- Contractor message projection returns `landlordId`; this is inconsistent with no raw landlord identifier exposure expectations.
- Generic lease create/update/end and lease ledger routes should be hardened with explicit landlord middleware or tests proving role denial for tenant/contractor callers.

Certification outcome:
- Security posture is improved but not certified for launch because runtime cross-user tests were not executed and two access/projection findings remain.

### 8. Screening Workflow

Status: PARTIAL

Evidence reviewed:
- `rentchain-api/src/routes/providerNeutralScreeningRoutes.ts`
- `rentchain-api/src/services/screening/providerNeutralWorkflowService.ts`
- `rentchain-api/src/services/screening/providers/manualAdapter.ts`
- `rentchain-frontend/src/components/screening/ScreeningWorkflowPanel.tsx`
- `rentchain-frontend/src/pages/screening/ManualScreeningPage.tsx`

Findings:
- Provider-neutral consent, request, result, decision, manual report, and webhook paths exist.
- Tenant consent routes require auth and tenant scope.
- Landlord request/result/decision/manual report routes require landlord auth.
- Webhooks fail closed when provider is not configured.
- Manual fallback exists through manual report workflow.
- Raw provider payload exposure was not observed in reviewed projection paths, but frontend/manual report E2E was not executed.

Certification outcome:
- Workflow exists, but certification is incomplete without seeded manual/provider fallback execution.

### 9. Infrastructure And Test Readiness

Status: PARTIAL

Evidence reviewed:
- `docs/execution/CLOUD_RUN_DEPLOYMENT_CHECKLIST.md`
- `docs/execution/QA_PLAYWRIGHT_PROTOCOL.md`
- `docs/execution/BRANCH_PROTECTION_CHECKLIST.md`
- package scripts for backend and frontend

Findings:
- Frontend build and full frontend test suite pass.
- Backend build passes.
- Backend full test suite is not clean.
- Cloud Run checklist and QA protocol docs exist, but Cloud Run freshness was not verified in this audit.

Certification outcome:
- Infrastructure readiness is partial and not enough for public launch certification.

## Security Findings

### Critical

None proven by runtime testing in this audit.

### High

1. Seeded end-to-end certification was not executed.
   - Impact: cannot prove landlord, tenant, contractor, billing, screening, notice, and signing workflows are safe under real auth/session conditions.
   - Required action: run the full seeded manual QA checklist in preview/staging with distinct accounts and record evidence.

2. Backend full suite is not clean.
   - Impact: launch certification cannot rely on a suite with 8 failing files and 21 failing tests unless a release owner signs an explicit waiver.
   - Required action: fix or formally waive each failing file with owner, scope, and launch-impact rationale.

### Medium

1. Contractor message projection includes `landlordId`.
   - Impact: contractor-facing output may expose a raw landlord identifier.
   - Required action: replace with a safe landlord reference or remove from contractor-facing message output.

2. Some lease mutation/ledger routes do not explicitly use landlord middleware.
   - Impact: role boundary depends on global auth decoding, `req.user` presence, and capability checks rather than explicit role middleware.
   - Required action: add explicit role enforcement or tests proving tenant/contractor denial for generic lease create/update/end and ledger routes.

3. Firestore rules are not covered by rules-unit tests.
   - Impact: syntax and code review passed in prior mission, but automated role/path rule assertions are not present.
   - Required action: add Firestore rules test coverage for landlord, tenant, admin, contractor, anonymous, and audit immutability paths.

### Low

1. Frontend build still emits a large-chunk warning.
   - Impact: not launch-blocking, but should be addressed for performance.
   - Required action: code splitting or bundle tuning in a future frontend performance mission.

## External Provider Status

Signing:
- Mock signing provider tests exist.
- Provider-backed completion was not executed.
- Dropbox Sign or equivalent production contract/configuration was not verified.

Screening:
- Provider-neutral and manual fallback workflows exist.
- Provider contract/configuration was not verified.
- Manual report fallback path exists but was not executed with seeded data.

Billing:
- Stripe checkout/status code exists.
- Stripe test-mode end-to-end checkout and error handling were not executed.

Email/storage:
- Email delivery and storage-backed document retrieval require configured environment and seeded records.
- These were not verified in this audit.

## Go/No-Go Decision

Decision: NO-GO

Public soft launch should not proceed from this audit alone. The platform has strong implementation foundations, but the certification gate remains unmet because seeded runtime workflows were not executed, backend tests are not fully passing, and at least two access/projection hardening items should be resolved before public availability.

## Conditional Acceptance Criteria For Re-Audit

To move from FAIL to PASS WITH CONDITIONS:
- Seeded landlord, tenant, contractor, and admin accounts exist in a controlled preview/staging environment.
- Landlord lease create/send/status/retrieve flow completes.
- Tenant lease receive/view/sign/retrieve flow completes without term mutation or cross-tenant access.
- Contractor assigned work order/status/message flow completes without tenant PII, lease, or financial exposure.
- Notice preview/send/respond/history flow completes and remains append-safe.
- Billing status and Stripe test checkout/failure handling are verified without payment instrument exposure.
- Screening provider or manual fallback workflow completes with landlord-only result access.
- Firestore rule checks or emulator tests verify critical role paths.
- Backend suite failures are fixed or formally waived with release-owner approval.
- Contractor message output no longer exposes raw landlord identifiers.
- Generic lease mutation and ledger routes have explicit role enforcement or negative-role tests.

## Reproducibility Notes

The detailed operator checklist is in `.handoff/certification-reproduction-checklist.md`.

This report contains no credentials, secrets, raw tokens, or seeded account identifiers.
