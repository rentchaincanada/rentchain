PR: #1113
PR URL: https://github.com/rentchaincanada/rentchain/pull/1113
Branch: fix/soft-launch-blockers-v1

# Implementation Summary

Date completed: 2026-06-07

Mission: Fix soft launch blockers (security, projection safety, governance)

## Scope Completed

Resolved the three soft launch blockers named in the mission:

- Added explicit landlord authorization middleware to generic lease and ledger route handlers in `rentchain-api/src/routes/leaseRoutes.ts`.
- Removed raw landlord identifier exposure from contractor-facing message response projections in `rentchain-api/src/services/contractorPortalService.ts`.
- Updated registry filing retry behavior in `rentchain-api/src/services/registry/registrySubmissionLayerV3.ts` so stale ready-package state is refreshed once before retry creation, with fail-closed readiness validation.

No frontend, billing, auth core, screening adapter, pricing, CI/CD, Firestore rules, Terraform, dependency, or migration files were changed.

## Files And Functions Changed

Lease authorization:
- `rentchain-api/src/routes/leaseRoutes.ts`
  - `GET /`
  - `POST /`
  - `PUT /:id`
  - `POST /:id/end`
  - `GET /:leaseId/ledger`
  - `POST /:leaseId/ledger/charge`
  - `POST /:leaseId/ledger/payment`
  - `GET /:leaseId/ledger/export.csv`
  - `GET /:leaseId/ledger/export.pdf`
- `rentchain-api/src/routes/__tests__/leaseRoutes.active.test.ts`
  - Added negative-role coverage proving tenant-role requests are rejected before generic lease and ledger handlers execute.

Contractor message projection:
- `rentchain-api/src/services/contractorPortalService.ts`
  - Added `projectContractorMessage`.
  - Applied the projection to work-order embedded messages, list responses, and create responses.
  - Preserved stored internal scope metadata for server-side authorization while removing raw landlord identifiers from contractor-facing output.
- `rentchain-api/src/routes/__tests__/contractorPortalRoutes.test.ts`
  - Added assertions that work-order and contractor message responses do not expose raw landlord identifiers.

Properties registry retry:
- `rentchain-api/src/services/registry/registrySubmissionLayerV3.ts`
  - Updated `retryRegistryFilingAttempt` to refresh stale ready-package state once through `createRegistryFilingReadyPackage`.
  - Added readiness validation after refresh so retry creation remains deterministic and fail-closed.
- `rentchain-api/src/routes/__tests__/propertiesRoutes.test.ts`
  - Updated stale ready-package retry coverage to confirm a refreshed ready package creates attempt 2 successfully.

## Validation Results

Passed:
- `npm run test -- src/routes/__tests__/leaseRoutes.active.test.ts` in `rentchain-api` using Node 20.20.2
- `npm run test -- src/routes/__tests__/contractorPortalRoutes.test.ts` in `rentchain-api` using Node 20.20.2
- `npm run test -- src/routes/__tests__/propertiesRoutes.test.ts` in `rentchain-api` using Node 20.20.2
- `npm run build` in `rentchain-api` using Node 20.20.2
- `git diff --check`

Full backend suite:
- `npm run test` in `rentchain-api` using Node 20.20.2 was run.
- Result: 454 passed test files, 7 failed test files; 2215 passed tests, 20 failed tests.
- The failed files are the existing unrelated areas already identified by the soft launch certification audit: `leaseDraftRoutes`, `recipientTrustReviewRoutes`, `supportConsoleRoutes`, `deriveDecisionExecutionMappings`, and `landlordAnalyticsSnapshot`.

Initial local test attempts under Node 25 failed repo preflight, then were rerun under Node 20.20.2. The properties route suite needed elevated local-server execution because the sandbox blocked Supertest from binding an ephemeral local port.

## Manual QA

Manual preview/staging QA was not completed in this local environment. The mission-specific manual QA still requires a deployed preview/staging backend with seeded landlord, tenant, contractor, and admin accounts.

Recommended manual QA before merge:
1. Confirm unauthorized lease generic and ledger routes reject tenant/non-landlord roles.
2. Confirm contractor message list, create, and work-order detail responses do not expose raw landlord identifiers.
3. Confirm registry filing retry succeeds after a stale ready package refresh and remains bounded to a single refresh.

## Acceptance Criteria Status

- Lease route authorization blocker: resolved with explicit `requireLandlord` guards and focused negative-role tests.
- Contractor raw identifier projection blocker: resolved with a shared contractor message projection and focused response-shape tests.
- Properties retry blocker: resolved with single-refresh stale ready-package retry behavior and focused route test coverage.
- Full backend test suite: still not clean because of unrelated pre-existing failures.
- Diff scope: limited to the three named blocker areas and tests.

## Known Limitations

- Full seeded preview/staging QA remains required before soft launch re-certification.
- Full backend test suite remains blocked by unrelated pre-existing failures outside this mission scope.
- Registry stale retry refresh is intentionally bounded to one ready-package regeneration and remains fail-closed if the refreshed package is not ready to file.

## Recommended Next Phase

After Gate 1 review and PR checks, run preview/staging manual QA for the three blocker fixes, then proceed to a dedicated seeded soft launch re-certification mission.
