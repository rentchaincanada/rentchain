PR: #1107
PR URL: https://github.com/rentchaincanada/rentchain/pull/1107
Branch: fix/notice-automation-validation-v1

# Implementation Summary

Mission: Notice Automation Validation and Rule Enforcement

Implemented deterministic notice automation validation for the existing lease notice workflow. The implementation stays inside the current notice service and landlord route surfaces, preserving the existing feature flag, landlord authorization middleware, tenant route protections, notice templates, delivery provider behavior, Firestore rules, billing, screening, and infrastructure.

## Confirmed Findings

- Current notice automation uses `leaseNoticeWorkflowService.ts`, `leaseNoticeLandlordRoutes.ts`, and `tenantLeaseNoticeRoutes.ts`; the older mission names `noticeService.ts` and `noticeRoutes.ts` are not present in the current source tree.
- Landlord notice routes remain behind `requireLandlord` and the lease notice feature flag.
- Tenant notice routes remain behind authenticated tenant role checks.
- Existing policy evaluation remains in place for preview/send actions.
- Existing tenant notice projections already redact landlord-only notes, internal workflow state, and provider delivery payloads.

## Changes Made

- Added pure notice validation rules in `rentchain-api/src/services/noticeValidationRules.ts`.
- Added validation checks for lease state, tenant context, landlord context, property/unit context, rent terms, supported jurisdiction, allowed notice type, term dates, and response deadline.
- Added compatibility wrappers for eviction, cure, and termination notice validation paths.
- Updated `buildPreview` to fail closed with `LEASE_NOTICE_VALIDATION_FAILED` and safe `failedRules` before preview generation succeeds.
- Updated send flow to reject invalid prerequisites before notice document creation.
- Moved tenant delivery contact resolution ahead of notice creation so a missing or invalid tenant delivery contact does not create a pending notice.
- Added append-safe validation audit events through `leaseWorkflowEvents` for validation failures and included validation context in notice creation audit data.
- Updated landlord preview route to return safe validation failure payloads and append validation audit events when preview validation fails.
- Added unit coverage for notice validation rules and service validation gating.

## Files Changed

- `rentchain-api/src/services/noticeValidationRules.ts`
- `rentchain-api/src/services/leaseNoticeWorkflowService.ts`
- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- `rentchain-api/src/services/__tests__/noticeValidationRules.test.ts`
- `rentchain-api/src/services/__tests__/leaseNoticeWorkflowService.test.ts`
- `.handoff/impl-summary.md`

## Validation

- `cd rentchain-api && source ~/.nvm/nvm.sh && nvm use 20 && npm run test:single -- src/services/__tests__/noticeValidationRules.test.ts src/services/__tests__/leaseNoticeWorkflowService.test.ts src/routes/__tests__/leaseNoticeLandlordRoutes.test.ts src/routes/__tests__/tenantLeaseNoticeRoutes.test.ts`
  - PASS: 4 test files, 21 tests
- `cd rentchain-api && source ~/.nvm/nvm.sh && nvm use 20 && npm run build`
  - PASS
- `git diff --check`
  - PASS
- `cd rentchain-api && source ~/.nvm/nvm.sh && nvm use 20 && npm run test`
  - FAIL: full backend suite hit unrelated sandbox/pre-existing `listen EPERM: operation not permitted 0.0.0.0` failures in route tests outside the notice workflow. Targeted notice suites passed.

## Manual QA

Manual QA is required because this mission changes backend route behavior and user-visible API validation responses.

Manual QA not completed in this local environment. Required preview QA:

1. No auth on landlord notice preview/send endpoints returns 401.
2. Landlord cannot preview/send notice for another landlord's lease; response is 403.
3. Valid active lease with tenant contact, landlord context, property/unit context, rent terms, supported jurisdiction, term dates, and response deadline can generate a notice.
4. Lease missing tenant context or tenant delivery contact fails with 400 and `LEASE_NOTICE_VALIDATION_FAILED`.
5. Lease missing rent terms fails with 400 and safe `failedRules`.
6. Unsupported jurisdiction or disallowed notice type fails with 400 and safe `failedRules`.
7. Validation failures create append-safe `leaseWorkflowEvents` entries without creating notice documents.
8. Tenant notice list/detail projections still exclude landlord-only notes, provider payloads, and internal workflow state.

## Protected Areas

- No billing changes.
- No auth core changes.
- No screening provider changes.
- No pricing or entitlement changes.
- No CI/CD, deployment, Firestore rules, Terraform, or migration changes.
- No frontend, templates, notice delivery routing, SMS, or external legal service changes.

## Known Limitations

- Validation treats canonical tenant/landlord context plus resolved tenant delivery email as the available contact boundary; deeper contact profile validation remains future work.
- Full manual E2E requires seeded landlord/tenant leases and a configured preview email environment.
- Full backend suite remains blocked locally by unrelated `listen EPERM` route-test failures.

## Acceptance Criteria Status

- Pure deterministic validation helpers: completed.
- Validation gate before notice generation: completed.
- Safe validation error payloads: completed.
- Append-safe validation audit context: completed.
- Authorization boundaries preserved: completed by existing route middleware and tests.
- Projection safety preserved: completed by existing tenant projection tests.
- No protected areas modified: completed.
- Manual QA: pending preview environment.

## Recommended Next Mission

Run manual preview QA for notice validation with seeded lease fixtures, then continue to Phase E billing checkout alignment if Gate 2 approves this mission.
