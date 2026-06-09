PR: #1130
PR URL: https://github.com/rentchaincanada/rentchain/pull/1130
Branch: feat/unified-inbox-navigation-v1

# Implementation Summary

## Mission
Implemented unified inbox navigation and read-only list UI for tenant, landlord, and contractor workspaces.

## Scope
- Added read-only shared backend endpoint `GET /api/inbox`.
- Added backend orchestration service for tenant, landlord, and contractor unified inbox projections.
- Added frontend unified inbox API helper.
- Added shared unified inbox page and list/detail component.
- Added landlord navigation link at `/landlord/unified-inbox`.
- Added tenant navigation link at `/tenant/inbox`.
- Added contractor navigation link at `/contractor/inbox`.
- Added focused backend service/route tests and frontend component/page tests.

## Confirmed Findings
- Existing role-specific endpoints remain intact: `/api/tenant/inbox`, `/api/landlord/inbox`, and `/api/contractor/inbox`.
- New `/api/inbox` dispatches by authenticated role and fails closed for unsupported roles or missing role context.
- Tenant, landlord, and contractor records are filtered by raw scope before unified inbox derivation.
- Frontend renders only projected records matching the current role and safety flags.
- UI does not display raw `sourceId`, `sourceRef`, audience scope keys, tokens, storage paths, provider payloads, or private notes.
- No writes, mutations, real-time listeners, external integrations, Firestore rules, billing, pricing, screening, deployment, or dependency changes were added.
- Existing data-layer adapters and derivation functions were consumed without mutation.

## Files Changed
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/routes/unifiedInboxRoutes.ts`
- `rentchain-api/src/services/unifiedInbox/index.ts`
- `rentchain-api/src/services/unifiedInbox/unifiedInboxService.ts`
- `rentchain-api/src/tests/unifiedInbox/unifiedInboxRoute.test.ts`
- `rentchain-api/src/tests/unifiedInbox/unifiedInboxService.test.ts`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/api/unifiedInboxApi.ts`
- `rentchain-frontend/src/components/UnifiedInbox/UnifiedInboxList.tsx`
- `rentchain-frontend/src/components/layout/ContractorNav.tsx`
- `rentchain-frontend/src/components/layout/TenantNav.tsx`
- `rentchain-frontend/src/components/layout/navConfig.ts`
- `rentchain-frontend/src/pages/UnifiedInboxPage.tsx`
- `rentchain-frontend/src/pages/UnifiedInboxPage.test.tsx`

## Validation
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/unifiedInboxService.test.ts`: PASS, 3 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/unifiedInboxRoute.test.ts`: PASS, 4 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/unifiedInboxService.test.ts src/tests/unifiedInbox/unifiedInboxRoute.test.ts`: PASS, 7 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/`: PASS, 7 files, 34 tests.
- `npm --prefix rentchain-api run build`: PASS.
- `npm --prefix rentchain-frontend test -- src/pages/UnifiedInboxPage.test.tsx`: PASS, 3 tests.
- `npm --prefix rentchain-frontend test`: PASS, 299 files, 1175 tests.
- `npm --prefix rentchain-frontend run build`: PASS.
- `git diff --check`: PASS.

## Manual QA
- Manual browser QA required because this mission adds user-visible navigation and UI routes.
- Local dev server started successfully at `http://127.0.0.1:5174/`.
- In-session browser smoke check could not complete because the browser surface was unavailable.
- Local dev server was stopped after the failed browser connection attempt.
- Manual preview QA remains required on the PR preview.

## Known Limitations
- The backend reads representative existing collections and relies on existing document shape conventions from prior route/service patterns.
- Records with missing role scope identifiers are rejected by pre-derivation filtering or ignored by adapters.
- No pagination UI, search, archive/read mutations, real-time subscriptions, or bulk workflows were added.
- The existing landlord application inbox remains separate from the new unified inbox route.

## Acceptance Criteria Status
- Unified inbox backend route added: PASS.
- Unified inbox service added: PASS.
- Tenant, landlord, and contractor UI routes added: PASS.
- Navigation links added: PASS.
- Role-safe frontend rendering added: PASS.
- Backend tests added and passing: PASS.
- Frontend tests added and passing: PASS.
- Build validation passing: PASS.
- Manual browser QA: PENDING on preview due local browser surface unavailability.

## Recommended Next Step
Complete manual preview QA for `/tenant/inbox`, `/landlord/unified-inbox`, and `/contractor/inbox` with seeded role accounts before Gate 2.
