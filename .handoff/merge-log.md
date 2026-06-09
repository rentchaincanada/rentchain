# Merge Log

PR: #1129
PR URL: https://github.com/rentchaincanada/rentchain/pull/1129
Branch: feat/unified-inbox-data-layer-expansion-v1
Base: main
Head commit: 3d367f85fb3a78286cb4776290720c771f29a88c
Merge commit: 4778e14f53da6c579e21d8478510a4094e272701
Merged at: 2026-06-09T17:22:49Z

## Merge Confirmation
- PR #1129 merged into `main` using standard merge with operator-provided admin authorization.
- Local `main` synced with `origin/main`.
- Local branch `feat/unified-inbox-data-layer-expansion-v1` deleted.
- Remote branch `feat/unified-inbox-data-layer-expansion-v1` deleted.

## Final Check Status
- All required checks were green before merge.
- backend: pass.
- frontend: pass.
- merge-gate: pass.
- review check: pass.
- Terraform Cloud/Rentchain/repo-id-KeMiLzWpFf7Yq2Zr: pass.
- Vercel Preview Comments: pass.
- Vercel `rentchain`: pass.
- Vercel `rentchain-status`: pass.
- post-review-comment: skipped.

## Confirmed Scope
- Added tenant adapters for viewing requests, lease notices, and application status records.
- Added landlord adapters for viewing requests, work orders, lease notices, and application status records.
- Added contractor adapter for work order communications.
- Added landlord source kinds for viewing, notice, and work order events.
- Extended tenant, landlord, and contractor derivation options to aggregate the new source arrays.
- Added tests for scope validation, sensitive-field rejection, lifecycle status mapping, safe references, and mixed-source aggregation.
- No routes, UI, persistence writes, Firestore rules, billing, screening, pricing, deployment, dependency, or auth core changes.

## Validation Evidence
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/tenantInboxAdapters.test.ts`: pass, 1 file, 8 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/landlordInboxAdapters.test.ts`: pass, 1 file, 5 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/contractorInboxAdapters.test.ts`: pass, 1 file, 5 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/deriveUnifiedInbox.test.ts`: pass, 1 file, 7 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/`: pass, 5 files, 27 tests.
- `npm --prefix rentchain-api run build`: pass.
- `git diff --check`: pass.
- Gate 2 QA status: approved.

## Manual QA Evidence
- Manual QA not required for backend-only data-layer adapters with no UI, route, auth, or user-visible runtime behavior changes.

## Known Limitations
- The new adapters are available for route/UI consumers but no new route or UI integration was added in this mission.
- Source records with missing scope identifiers are rejected fail-closed.
- Adapter tests use representative document shapes from existing route and service patterns; live Firestore shape variation should be validated when inbox UI consumes these arrays.

## Unified Inbox Data Layer Expanded
- Tenant sources: viewing requests, lease notices, application status.
- Landlord sources: viewing requests, work orders, lease notices, application status.
- Contractor sources: work order communications.
- Tests: 27 unified inbox tests passing.

## Recommended Next Mission
- feat/unified-inbox-navigation-v1 — build unified inbox UI on the completed landlord, tenant, and contractor data foundation.
