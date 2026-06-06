PR: #1106
PR URL: https://github.com/rentchaincanada/rentchain/pull/1106
Branch: feat/contractor-portal-v1

# Implementation Summary

Implemented Contractor Portal v1 as an additive contractor-scoped operational workspace foundation.

## Confirmed Findings

- Added `requireContractor` middleware that reuses existing authenticated session handling and accepts only contractor/admin roles.
- Added contractor-scoped API routes under `/api/contractors/:contractorId/*` for assigned work orders, work-order detail, status updates, messages, and self-profile.
- Added explicit contractor work-order projection allowlists that omit tenant identifiers, tenant household data, raw property IDs, raw unit IDs, payment data, screening data, and landlord billing data.
- Added contractor status update handling with valid transition checks and append-safe `workOrderUpdates` event emission.
- Added work-order-scoped contractor-landlord messaging through `contractorMessages`, with landlord/work-order relationship validation and companion `workOrderUpdates` audit notes.
- Added contractor self-profile read/update through the scoped contractor route while keeping the existing profile page compatible with prior profile APIs.
- Added `VITE_CONTRACTOR_PORTAL_ENABLED` and `CONTRACTOR_PORTAL_ENABLED` env documentation.
- Added contractor portal governance/schema documentation in `.codex/docs/contractor-portal-v1.md` and `.codex/docs/database.md`.

## Files Changed

- `.codex/docs/contractor-portal-v1.md`
- `.codex/docs/database.md`
- `.env.example`
- `rentchain-api/.env.example`
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/middleware/requireContractor.ts`
- `rentchain-api/src/middleware/__tests__/requireContractor.test.ts`
- `rentchain-api/src/routes/contractorPortalRoutes.ts`
- `rentchain-api/src/routes/__tests__/contractorPortalRoutes.test.ts`
- `rentchain-api/src/services/contractorPortalService.ts`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/api/contractorPortalApi.ts`
- `rentchain-frontend/src/pages/contractor/ContractorProfilePage.tsx`
- `rentchain-frontend/src/pages/contractor/ContractorProfilePage.test.tsx`

## Validation

- `npm test --prefix rentchain-api -- src/middleware/__tests__/requireContractor.test.ts src/routes/__tests__/contractorPortalRoutes.test.ts`: PASS, 2 files / 7 tests.
- `npm run build --prefix rentchain-api`: PASS.
- `npm test --prefix rentchain-frontend -- ContractorJobsPage ContractorProfilePage`: PASS, 2 files / 8 tests.
- `npm run build --prefix rentchain-frontend`: PASS, with existing Vite chunk-size warning.
- `git diff --check --cached`: PASS.
- `npm test --prefix rentchain-frontend`: FAIL, 290 files / 1148 tests passed, 1 unrelated failure in `LandlordLeaseSummaryPage.test.tsx` expecting `.print-only-summary`.
- `npm test --prefix rentchain-api`: FAIL, 421 files / 2037 tests passed before known sandbox/pre-existing route-test `listen EPERM: operation not permitted 0.0.0.0` failures.

## Manual QA

Manual QA is required because this mission touches backend routes, auth flow, frontend routing, and user-visible contractor behavior.

Manual QA was not completed locally because no seeded contractor/landlord accounts, assigned work orders, or deployed preview session were available.

Recommended manual QA:
1. Log in as a contractor and confirm `/contractor` loads the dashboard.
2. Confirm contractor work-order list shows only assigned work.
3. Confirm URL manipulation to another contractor id returns 403 through `/api/contractors/:contractorId/work-orders`.
4. Open a work-order detail and confirm tenant names, tenant IDs, raw property IDs, raw unit IDs, rates, payments, screening, and billing data are absent.
5. Update status from assigned to accepted, in-progress, and completed where applicable; confirm status history records append.
6. Send a contractor-landlord message for an assigned work order; confirm unrelated landlord/work-order messages are denied.
7. Update contractor profile fields and confirm they persist.
8. Disable `VITE_CONTRACTOR_PORTAL_ENABLED` and confirm contractor routes show the coming-soon/fallback state.
9. Check mobile layout for dashboard, jobs, detail, and profile.

## Known Limitations

- The frontend contractor jobs page still uses the existing `/api/contractor/jobs` maintenance workflow API for rich job execution actions; the new `/api/contractors/:contractorId/*` routes provide the mission-required scoped compatibility/read-model surfaces and profile API.
- Backend route availability is documented with `CONTRACTOR_PORTAL_ENABLED`, but route mounting remains enabled; authorization remains the server-side safety boundary.
- Landlord-side display of contractor messages/status remains dependent on existing `workOrderUpdates` surfaces; no new landlord messaging UI was added.
- Full seeded end-to-end QA requires contractor accounts, landlord accounts, assigned work orders, and preview/staging configuration.
- Full backend suite retains known sandbox route-test failures around `listen EPERM`.
- Full frontend suite has an unrelated existing lease summary print-source test failure.

## Acceptance Criteria Status

- Contractor role middleware: PASS.
- Contractor work-order list and detail route: PASS.
- Contractor status update route with transition validation and append event: PASS.
- Contractor-landlord message routes with assigned-work authorization: PASS.
- Contractor self-profile routes: PASS.
- Projection safety for contractor work-order response: PASS by explicit route/service allowlist and focused tests.
- Contractor feature flag: PASS for frontend route gating.
- Documentation: PASS.
- Manual QA: NOT RUN, environment limitation.

## Recommended Next Mission

Contractor portal landlord-side activity visibility and seeded preview QA.
