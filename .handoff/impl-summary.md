PR: #1124
PR URL: https://github.com/rentchaincanada/rentchain/pull/1124
Branch: feat/unified-inbox-data-layer-v1

# Implementation Summary

## Mission
Implement the unified inbox data layer foundation with role-safe tenant and landlord source adapters.

## Files Changed
- `rentchain-api/src/services/unifiedInbox/types.ts`
- `rentchain-api/src/services/unifiedInbox/safeInboxReferences.ts`
- `rentchain-api/src/services/unifiedInbox/tenantInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/landlordInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/deriveUnifiedInbox.ts`
- `rentchain-api/src/services/unifiedInbox/index.ts`
- `rentchain-api/src/services/unifiedInbox/__tests__/index.test.ts`
- `rentchain-api/src/tests/unifiedInbox/safeInboxReferences.test.ts`
- `rentchain-api/src/tests/unifiedInbox/tenantInboxAdapters.test.ts`
- `rentchain-api/src/tests/unifiedInbox/landlordInboxAdapters.test.ts`
- `rentchain-api/src/tests/unifiedInbox/deriveUnifiedInbox.test.ts`

## What Changed
- Added canonical unified inbox event types with explicit tenant, landlord, and contractor role surfaces.
- Added deterministic safe inbox ID, source reference, and scope key helpers using stable hash output.
- Added pure tenant adapters for notifications, messages, maintenance, and screening source records.
- Added pure landlord adapters for application, screening, lease, maintenance, and message source records.
- Added derivation helpers that accept already-loaded source arrays, filter unsafe records, sort deterministically, and return cursor-paginated inbox pages.
- Added projection tests for role scope filtering, sensitive-field rejection, safe identifier generation, source immutability, ordering, and pagination.

## Governance
- Scope limited to backend service-layer data shaping and tests.
- No routes, UI, persistence writes, realtime subscriptions, background workers, Firestore rules, auth logic, billing, screening adapters, pricing, deployment, or dependency changes.
- Tenant and landlord projections use explicit adapters and safe references.
- Contractor implementation remains out of scope for this mission.
- Source records are never mutated by adapters or derivation helpers.

## Validation
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/`: PASS, 4 files, 12 tests.
- `npm --prefix rentchain-api test -- src/services/unifiedInbox/`: PASS, 1 file, 1 test.
- `npm --prefix rentchain-api run build`: PASS.
- `git diff --check`: PASS.
- `npm --prefix rentchain-api run lint -- src/services/unifiedInbox/ src/tests/unifiedInbox/`: NOT RUN, package has no `lint` script.

## Manual QA
- N/A. This is a backend data-layer foundation with no routes, UI, or user-visible runtime behavior.
- Role separation, projection safety, append safety, and no-mutation behavior are covered by automated tests and code inspection.

## Known Limitations
- Derivation helpers accept already-loaded source records and do not perform Firestore reads in this mission.
- Contractor inbox adapters are intentionally deferred.
- Route integration, unread state persistence, realtime delivery, admin/support tooling, and UI rendering are intentionally deferred.
- Backend lint could not run because the package has no lint script.

## Recommended Follow-Up
- Add route-level unified inbox retrieval after this data layer is reviewed and approved.
- Add contractor adapters in a separate scoped mission after tenant and landlord projections are accepted.
