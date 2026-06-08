PR: #1118
PR URL: https://github.com/rentchaincanada/rentchain/pull/1118
Branch: fix/work-order-property-dropdown-v1

# Implementation Summary

## Mission
Fix work order property dropdown frontend binding bug.

## Files Changed
- `rentchain-frontend/src/pages/landlord/WorkOrderNewPage.tsx`
- `rentchain-frontend/src/pages/landlord/WorkOrderNewPage.test.tsx`

## What Changed
- Added property option normalization for both `id` and `propertyId` response shapes.
- Added fallback labels from `name`, `addressLine1`, `address`, `displayName`, and `propertyName`.
- Deduplicated property options by normalized property ID.
- Disabled the property dropdown with an explicit empty option when no properties are available.
- Reset stale unit selection and unit options whenever the selected property changes.
- Preserved the existing `createWorkOrder` request payload and backend `propertyId` contract.
- Added regression tests covering dropdown population, visible selection, stale unit clearing, and submitted `propertyId`.

## Governance
- Scope limited to frontend landlord work order creation UI and tests.
- No backend route, service, auth, Firestore rules, billing, screening, pricing, deployment, or dependency changes.
- No permission widening.
- No raw IDs, tokens, secrets, storage paths, or provider payloads exposed.
- Backend authorization remains server-side through existing work order and property ownership checks.
- Projection safety preserved; the change consumes existing landlord-scoped property responses only.

## Validation
- `npm --prefix rentchain-frontend run test -- src/pages/landlord/WorkOrderNewPage.test.tsx`: PASS, 2 tests.
- `npm --prefix rentchain-api run test -- src/routes/__tests__/workOrdersRoutes.test.ts`: PASS, 21 tests.
- `npm --prefix rentchain-frontend run test`: PASS, 294 files, 1155 tests.
- `npm --prefix rentchain-frontend run build`: PASS.
- `git diff --check`: PASS.

## Manual QA
- Manual browser QA not completed in this environment.
- Full workflow requires seeded landlord, contractor, property, unit, and work order data with authenticated preview access.
- Automated coverage verifies the frontend binding behavior and submitted payload for the affected form.

## Known Limitations
- Existing work order edit UI does not expose property reassignment, and the backend patch route does not currently accept `propertyId`; no new route or API surface was added.
- Contractor invite visibility in the contractor portal remains out of scope for a separate mission.

## Recommended Follow-Up
- Run preview manual QA with seeded accounts for the landlord work order creation flow.
- Address contractor invite portal visibility as a separate scoped mission.
