PR: #1149
PR URL: https://github.com/rentchaincanada/rentchain/pull/1149
Branch: fix/upgrade-driver-clarification-v1

WHAT WAS DONE:
- Standardized backend upgrade-required payloads from the shared capability guard.
- Added `userMessage`, `requiredTier`, `upgradeDrivers`, and tier-specific `upgradePath` to capability-denial responses while preserving legacy fields such as `requiredPlan`, `currentPlan`, `capability`, and `message`.
- Updated the Pro-only expense import/export guard to use the shared upgrade response shape.
- Added canonical frontend upgrade driver constants for Analytics, Payments, Work Orders, Expenses, and Screening.
- Extended the locked-state component to show the feature name, required tier, upgrade drivers, driver descriptions, and a styled upgrade CTA.
- Replaced the Expenses page plain-text import/export lock with the canonical locked-state component.
- Added expense import/export upgrade copy and required-plan mappings so the Pro expense gate does not fall back to generic copy.

KEY DECISIONS:
- Entitlement checks were not changed. The mission explicitly required messaging standardization without widening or weakening auth, billing, or plan enforcement.
- Existing locked pages for leases, ledger, messages, and operations already use the canonical locked-state component or the shared capability guard, so the patch extends those shared pieces rather than duplicating page-level logic.
- Maintenance/work-order entitlement behavior was left unchanged because the current capability map documents maintenance as reachable on Free during Pilot 1 measurement.
- Expenses remain manually usable on Free; only import/export surfaces show the Pro locked state.
- Operations remains a derived frontend coordination page in the current codebase; there is no separate browser-used `/api/landlord/operations` route to patch in this mission.

CURRENT STATE:
- Branch: fix/upgrade-driver-clarification-v1
- PR: pending
- Backend upgrade response shape is standardized for shared capability-guarded routes and expense import/export gates.
- Frontend locked-state UI now exposes consistent upgrade-driver messaging.
- Manual preview QA has not been run in this environment.

VALIDATION:
- Frontend targeted tests passed:
  - `npm run test:single -- src/components/billing/LockedFeature.test.tsx src/constants/tiers.test.ts src/pages/ExpensesPage.test.tsx`
  - `npm run test:single -- src/components/billing/FeatureGate.test.tsx` (after fixing message expectation)
- Backend targeted tests passed:
  - `npm run test:single -- src/services/__tests__/capabilityGuard.test.ts`
  - `npm run test:single -- src/routes/__tests__/expensesRoutes.test.ts`
- Backend build passed:
  - `npm run build`
- Frontend build passed:
  - `npm run build`
- `git diff --check` passed (after fixing trailing whitespace).
- Note: the first sandboxed backend route test run failed with `listen EPERM: operation not permitted 0.0.0.0`; rerunning the same route suite outside the sandbox passed.
- Frontend build retained an existing large chunk warning; build completed successfully.

FILES CHANGED:
- `rentchain-api/src/services/capabilityGuard.ts`
- `rentchain-api/src/services/__tests__/capabilityGuard.test.ts`
- `rentchain-api/src/routes/expensesRoutes.ts`
- `rentchain-api/src/routes/__tests__/expensesRoutes.test.ts`
- `rentchain-frontend/src/constants/tiers.ts`
- `rentchain-frontend/src/constants/tiers.test.ts`
- `rentchain-frontend/src/components/billing/LockedFeature.tsx`
- `rentchain-frontend/src/components/billing/LockedFeature.test.tsx`
- `rentchain-frontend/src/components/billing/FeatureGate.test.tsx`
- `rentchain-frontend/src/billing/upgradeCopy.ts`
- `rentchain-frontend/src/lib/upgradePrompt.ts`
- `rentchain-frontend/src/pages/ExpensesPage.tsx`
- `rentchain-frontend/src/pages/ExpensesPage.test.tsx`
- `.handoff/impl-summary.md`

KNOWN LIMITATIONS:
- No live browser preview QA was run.
- No Cloud Run deployment verification was performed because this mission only changes response copy/shape and frontend locked-state rendering, not deployment configuration.
- Existing non-mission local handoff edits remain unstaged in `.handoff/merge-log.md` and `.handoff/mission-current.md`.

NEXT STEP:
- Review PR, run preview QA for Free-tier locked surfaces, and then proceed to the next adoption-flow mission only after this upgrade messaging pass is accepted.

## Manual QA Results — Vercel Preview

Step 1: PARTIAL — /expenses canonical LockedFeature renders on first load but reverts
to plain text "Import expenses / Upgrade to Pro..." after page refresh.
State persistence issue — component may have conditional fallback to old text implementation.
Step 2: PASS — Other locked surfaces consistent with canonical component
Step 3: N/A — Could not test CTA link after LockedFeature reverted on refresh
Step 4: PASS — Mobile layout 375px confirmed, no overflow

FINDING 1 (medium): /expenses LockedFeature reverts to plain text after refresh —
conditional render or hydration issue. Blocks full acceptance criteria.

FINDING 2 (low): /payments missing single payment add — CSV upload only.
Log as follow-up mission fix/payments-manual-entry-v1.

## Manual QA Results — Final (after navigation-back fix)

Step 1: PASS — /expenses LockedFeature displays correctly on Free tier
Step 2: PASS — CTA → /pricing → browser back → /expenses: LockedFeature persists
Step 3: PASS — Hard refresh: LockedFeature persists

Root cause resolved: useRef stable state prevents LockedFeature from reverting
during navigation transitions when useCapabilities briefly shows loading: true.

FINDING 2 (low): /payments missing single payment add — log as follow-up mission.

Manual QA: PASS — all three checks confirmed on Vercel preview.
