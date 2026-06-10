PR: #1131
PR URL: https://github.com/rentchaincanada/rentchain/pull/1131
Branch: fix/unified-inbox-debug-metadata-removal-v1

# Implementation Summary

## Mission
Removed debug metadata and internal source references from unified inbox API response bodies while preserving existing auth, route behavior, role separation, and adapter projection logic.

## Audit Findings
- Tenant, landlord, and contractor unified inbox responses were built from internal `UnifiedInboxEvent` objects.
- Public `items` and `records` previously exposed `sourceId`, `sourceRef`, `audienceScopeKey`, and six diagnostic safety flags.
- The raw source record IDs were already hashed before adapter output, but the exposed source/scope reference fields were still internal implementation details.
- Adapter outputs still carry internal safety flags for projection validation, but those fields no longer cross the service response boundary.
- Frontend rendering previously depended on diagnostic flags to filter records; that dependency was removed.

## Fields Removed From Public Responses
- `sourceId`
- `sourceRef`
- `audienceScopeKey`
- `rawIdsIncluded`
- `tokensIncluded`
- `secretsIncluded`
- `providerPayloadIncluded`
- `storagePathIncluded`
- `privateNotesIncluded`

## Public Record Fields Kept
- `id`
- `sourceKind`
- `audienceRole`
- `title`
- `body`
- `priority`
- `status`
- `occurredAt`
- `readAt`

## Files Changed
- `rentchain-api/src/services/unifiedInbox/types.ts`
- `rentchain-api/src/services/unifiedInbox/unifiedInboxService.ts`
- `rentchain-api/src/tests/unifiedInbox/unifiedInboxRoute.test.ts`
- `rentchain-api/src/tests/unifiedInbox/unifiedInboxService.test.ts`
- `rentchain-frontend/src/api/unifiedInboxApi.ts`
- `rentchain-frontend/src/components/UnifiedInbox/UnifiedInboxList.tsx`
- `rentchain-frontend/src/pages/UnifiedInboxPage.test.tsx`

## Validation
- `npm --prefix rentchain-api run test:single -- src/tests/unifiedInbox/unifiedInboxService.test.ts src/tests/unifiedInbox/unifiedInboxRoute.test.ts src/tests/unifiedInbox/tenantInboxAdapters.test.ts src/tests/unifiedInbox/landlordInboxAdapters.test.ts src/tests/unifiedInbox/contractorInboxAdapters.test.ts src/tests/unifiedInbox/deriveUnifiedInbox.test.ts src/tests/unifiedInbox/safeInboxReferences.test.ts`: PASS, 7 files, 34 tests.
- `npm --prefix rentchain-frontend run test:single -- src/api/unifiedInboxApi.test.ts src/pages/UnifiedInboxPage.test.tsx`: PASS, 2 files, 6 tests.
- `npm --prefix rentchain-api run build`: PASS.
- `npm --prefix rentchain-frontend run build`: PASS.
- `git diff --check`: PASS.

## Acceptance Criteria Status
- Raw source references removed from API response bodies: PASS.
- Debug metadata flags removed from API response bodies: PASS.
- Tenant, landlord, and contractor public responses constrained to allowlisted fields: PASS.
- Existing route signatures, auth checks, status codes, and source data remain unchanged: PASS.
- Frontend unified inbox rendering remains compatible with the public response shape: PASS.
- Manual browser/network QA: NOT RUN locally because seeded authenticated tenant, landlord, and contractor sessions were not available in this environment.

## Known Limitations
- The implemented shared router remains mounted as it was before this mission; route mounts and auth middleware were not changed.
- Internal adapter objects still include safety flags and safe hashed references for derivation tests. These are intentionally stripped before public response serialization.
- Full authenticated browser Network-tab inspection should still be completed against preview or a seeded local environment before Pilot 1 authorization.
