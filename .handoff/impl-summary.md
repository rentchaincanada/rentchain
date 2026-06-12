PR: #1141
PR URL: https://github.com/rentchaincanada/rentchain/pull/1141
Branch: fix/free-tier-gated-feature-ux-v1

# Implementation Summary

Mission: Fix free tier gated feature UX

## Summary

- Implemented locked feature states for free-tier users on lease operations, ledger, ledger v2, and messages.
- Split operational command center loading so free-safe dashboard, decision inbox, and property signals still load while lease-driven lanes show locked guidance.
- Normalized backend capability-denial payloads for leases, ledger, ledger v2, and messages.
- Centralized operations-signal upgrade copy in `upgradeCopy.ts`.
- Documented the Pilot 1 maintenance decision in the capability catalog without changing maintenance enforcement.

## Backend Changes

- Added `buildUpgradeRequiredResponse()` in `rentchain-api/src/services/capabilityGuard.ts`.
- Updated ad hoc upgrade-required responses in:
  - `rentchain-api/src/routes/leaseRoutes.ts`
  - `rentchain-api/src/routes/ledgerRoutes.ts`
  - `rentchain-api/src/routes/ledgerV2Routes.ts`
  - `rentchain-api/src/routes/messagesRoutes.ts`
- Preserved existing capability decisions and route structure.
- Did not modify auth middleware, billing flows, pricing tables, Firestore rules, deployment configuration, or entitlement allow lists.

## Frontend Changes

- Updated `LandlordActiveLeasesPage.tsx` to show `LockedFeature` for free-tier users before calling paid lease APIs.
- Updated `OperationalCommandCenterPage.tsx` to keep free-safe content visible and render locked operations lanes for lease-driven signals.
- Updated `LedgerPage.tsx`, `LedgerV2Page.tsx`, and `MessagesPage.tsx` to use the shared locked-state component.
- Added `gatedFeatureErrors.ts` so stale backend denials do not surface raw upgrade errors.
- Updated `LockedFeature` so feature title and description can default to centralized upgrade copy.

## Tests Added Or Updated

- `rentchain-api/src/services/__tests__/capabilityGuard.test.ts`
- `rentchain-api/src/services/__tests__/planCapabilities.test.ts`
- `rentchain-frontend/src/lib/gatedFeatureErrors.test.ts`
- `rentchain-frontend/src/billing/upgradeCopy.test.ts`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.test.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.test.tsx`
- `rentchain-frontend/src/pages/MessagesPage.test.tsx`

## Validation

- Passed: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run test:single -- src/services/__tests__/capabilityGuard.test.ts src/services/__tests__/planCapabilities.test.ts` in `rentchain-api`.
- Passed: `npm run test:single -- src/lib/gatedFeatureErrors.test.ts src/billing/upgradeCopy.test.ts src/pages/LandlordActiveLeasesPage.test.tsx src/pages/OperationalCommandCenterPage.test.tsx src/pages/MessagesPage.test.tsx` in `rentchain-frontend`.
- Passed: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run build` in `rentchain-api`.
- Passed: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run build` in `rentchain-frontend`.
- Passed: `git diff --check`.

## Manual QA

- Not run locally. This mission changes frontend rendering and should receive preview QA for free-tier, Starter, and Pro landlord accounts before merge.

## Known Limitations

- Frontend build completed with the existing large chunk warning.
- Full browser preview QA was not run in this workspace.
- `.handoff/merge-log.md` had pre-existing local edits and was intentionally left unstaged.
