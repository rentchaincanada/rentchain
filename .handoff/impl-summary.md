PR: #1087
PR URL: https://github.com/rentchaincanada/rentchain/pull/1087
Branch: feat/phase-3-firebase-initialization-consolidation-v1

# Implementation Summary

Completed the Phase 3 Firebase initialization consolidation mission.

## Scope Completed

- Added canonical backend Firebase initialization under `rentchain-api/src/firebase/`.
- Replaced legacy `rentchain-api/src/config/firebase.ts`, `rentchain-api/src/firebase.ts`, and `rentchain-api/src/events/firestore.ts` usage with the canonical `src/firebase` import path.
- Preserved exported Firestore contract: `db`, `firestore`, `FieldValue`, and `PROJECT_ID`.
- Preserved the Firestore environment guard as the single safety authority before Admin SDK initialization.
- Preserved singleton initialization through `admin.apps.length`.
- Preserved existing startup log labels:
  - `[FIREBASE CONFIG LOADED]`
  - `[FIREBASE CONFIG] PROJECT_ID = ...`
- Added Firebase initialization audit metadata through `initializationState()` and `captureInitializationAudit()`.
- Added `firebaseInitializationMode` to health responses.
- Added documentation for initialization topology, consolidation plan, and troubleshooting.

## Files Changed

- Added `rentchain-api/src/firebase/admin.ts`.
- Added `rentchain-api/src/firebase/index.ts`.
- Added `rentchain-api/src/firebase/initializationRegistry.ts`.
- Added `docs/firebase/consolidation-plan.md`.
- Added `docs/firebase/INITIALIZATION.md`.
- Added `docs/firebase/TROUBLESHOOTING.md`.
- Deleted `rentchain-api/src/config/firebase.ts`.
- Deleted `rentchain-api/src/firebase.ts`.
- Deleted `rentchain-api/src/events/firestore.ts`.
- Updated backend imports from legacy Firebase entrypoints to `src/firebase`.
- Updated `rentchain-api/src/routes/healthRoutes.ts`.
- Updated `rentchain-api/src/routes/__tests__/healthRoutes.test.ts`.

## Validation

- Passed: `npm --prefix rentchain-api run build`
- Passed: `npm --prefix rentchain-api run test:single -- src/routes/__tests__/healthRoutes.test.ts`
- Passed: `npm --prefix rentchain-api run test:single -- src/routes/__tests__/healthRoutes.test.ts src/routes/__tests__/screeningJobStatusRoutes.test.ts src/routes/__tests__/screeningOrderStatusReconcile.test.ts src/routes/__tests__/transunionReferralMode.test.ts src/routes/__tests__/transunionScreeningGate.test.ts src/routes/__tests__/rentalApplicationsReviewSummaryRisk.test.ts`
- Passed: `git diff --check`
- Passed: no legacy `config/firebase` or `events/firestore` imports remain under `rentchain-api/src`.
- Passed: Firebase default-app route failures from the initial validation pass were repaired.
- Partial: `npm --prefix rentchain-api run test` now runs without Firebase default-app failures, but the full suite still has unrelated existing assertion failures.

## Full Suite Limitations

The full backend suite currently reports:

- 7 failed test files, 421 passed.
- 20 failed tests, 2064 passed.

Observed remaining failures are in:

- `rentchain-api/src/routes/__tests__/leaseDraftRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/recipientTrustReviewRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/supportConsoleRoutes.test.ts`
- `rentchain-api/src/lib/analytics/__tests__/deriveDecisionExecutionMappings.test.ts`
- `rentchain-api/src/services/landlord/__tests__/landlordAnalyticsSnapshot.test.ts`

These failures are assertion mismatches around lease draft document fields, recipient review lifecycle status, support resource status, and lease notice decision execution inputs. They are not Firebase default-app initialization failures.

## Production Safety Assessment

- No frontend Firebase initialization changed.
- No Firestore rules changed.
- No Firestore indexes changed.
- No auth permission changes.
- No production data mutation.
- No dependency changes.
- Firestore emulator guard remains active and authoritative.
- Existing Admin SDK auth and storage imports were not widened.

## Manual QA

- Manual startup against a live local backend was not run in this environment.
- Health route behavior was validated through focused backend route tests.

## Recommended Follow-Up

Open a separate narrow mission for the unrelated full-suite assertion failures before treating the entire backend test suite as green.
