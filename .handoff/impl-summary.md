PR: #1129
PR URL: https://github.com/rentchaincanada/rentchain/pull/1129
Branch: feat/unified-inbox-data-layer-expansion-v1

# Implementation Summary

## Mission
Expand the unified inbox data layer with viewing request, notice, application status, work order, and work order communication adapters.

## Files Changed
- `rentchain-api/src/services/unifiedInbox/types.ts`
- `rentchain-api/src/services/unifiedInbox/tenantInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/landlordInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/contractorInboxAdapters.ts`
- `rentchain-api/src/services/unifiedInbox/deriveUnifiedInbox.ts`
- `rentchain-api/src/tests/unifiedInbox/tenantInboxAdapters.test.ts`
- `rentchain-api/src/tests/unifiedInbox/landlordInboxAdapters.test.ts`
- `rentchain-api/src/tests/unifiedInbox/contractorInboxAdapters.test.ts`
- `rentchain-api/src/tests/unifiedInbox/deriveUnifiedInbox.test.ts`

## What Changed
- Added tenant adapters for viewing requests, lease notices, and application status records.
- Added landlord adapters for viewing requests, work orders, lease notices, and application status records.
- Added contractor adapter for work order communications.
- Added landlord source kinds for viewing, notice, and work order events.
- Extended tenant, landlord, and contractor derivation options to aggregate the new source arrays.
- Added tests for scope validation, sensitive-field rejection, lifecycle status mapping, safe references, and mixed-source aggregation.

## Governance
- Scope limited to unified inbox data-layer adapters and tests.
- No routes, UI, persistence writes, Firestore rules, billing, screening, pricing, deployment, dependency, or auth core changes.
- Adapters are pure transformations and do not mutate source records.
- Tenant, landlord, and contractor adapters validate audience scope before projection.
- Sensitive fields, unsafe text, provider payloads, storage paths, raw IDs, internal notes, screening reports, and private evidence are rejected.
- Output events use existing safe inbox identifiers and safe source references.

## Validation
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/tenantInboxAdapters.test.ts`: PASS, 1 file, 8 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/landlordInboxAdapters.test.ts`: PASS, 1 file, 5 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/contractorInboxAdapters.test.ts`: PASS, 1 file, 5 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/deriveUnifiedInbox.test.ts`: PASS, 1 file, 7 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/`: PASS, 5 files, 27 tests.
- `npm --prefix rentchain-api run build`: PASS.
- `git diff --check`: PASS.

## Manual QA
- Not required for this mission because it adds pure backend data-layer adapters only and does not change routes, UI, auth flow, or user-visible runtime behavior.

## Known Limitations
- The new adapters are available for route/UI consumers but no new route or UI integration was added in this mission.
- Source records with missing scope identifiers are rejected fail-closed.
- Adapter tests use representative document shapes from existing route and service patterns; live Firestore shape variation should be validated when inbox UI consumes these arrays.

## Recommended Follow-Up
- Build unified inbox UI and route integration only after Gate 2 approval confirms these adapter projections are safe.
