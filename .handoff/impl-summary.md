PR: #1108
PR URL: https://github.com/rentchaincanada/rentchain/pull/1108
Branch: fix/billing-checkout-alignment-v1

# Implementation Summary

Mission: Phase E - Billing Checkout Alignment for v0.9 Soft Launch

Aligned the subscription billing checkout contract across backend and frontend while preserving billing scope, landlord authorization, safe subscription status projection, and Track B deferral. The canonical subscription checkout route remains `POST /api/billing/checkout` because it was already registered in `app.build.ts`, documented by the public billing diagnostic probe, and used by the existing `startCheckout` helper. The stale frontend `billingApi.createCheckoutSession` path now calls the canonical route, while the backend keeps `/billing/create-checkout-session` as a compatibility alias for stale clients.

## Confirmed Findings

- Backend billing routes are mounted at `/api/billing` through `rentchain-api/src/app.build.ts`.
- Current backend checkout route was `POST /billing/checkout`; frontend `billingApi.createCheckoutSession` was still calling `/billing/create-checkout-session`.
- Existing `startCheckout` already called `/billing/checkout`, so keeping `/billing/checkout` as canonical avoids creating a second checkout contract.
- Billing route auth previously used `requireAuth` directly on billing state and checkout routes; this mission moved those protected routes to `requireLandlord`.
- Pricing and health routes remain public as non-sensitive read surfaces.
- Subscription status previously inferred status from plan tier and returned null renewal fields without source labeling.

## Changes Made

- Updated protected backend billing routes to use `requireLandlord`:
  - `GET /billing`
  - `GET /billing/receipts/:id`
  - `GET /billing/subscription-status`
  - `GET /billing/billing/subscription-status`
  - `POST /billing/checkout`
  - `POST /billing/create-checkout-session`
  - `POST /billing/subscribe`
  - `POST /billing/upgrade`
  - `GET /billing/session-status`
  - `POST /billing/portal`
- Added `POST /billing/create-checkout-session` as a compatibility alias to the shared checkout handler.
- Updated checkout response to include `sessionId`, `url`, and `checkoutUrl` for compatibility with existing callers.
- Added safe subscription status fields:
  - `currentPeriodEnd`
  - `statusSource`
  - `subscriptionStatusSource`
- Subscription status now uses stored synced subscription fields when present and labels the source as `stripe_subscription`; otherwise it labels plan-tier inference as `plan_tier`.
- Updated `rentchain-frontend/src/api/billingApi.ts` so `createCheckoutSession` posts to `/billing/checkout`.
- Added focused frontend API tests for checkout route alignment and safe subscription status normalization.
- Updated backend billing route tests for landlord-only access, tenant denial, canonical checkout response, compatibility alias, and safe subscription status fields.
- Added `.codex/docs/billing.md` documenting canonical subscription checkout, compatibility aliases, safe subscription status fields, and Track B deferral.

## Files Changed

- `rentchain-api/src/routes/billingRoutes.ts`
- `rentchain-api/src/routes/__tests__/billingRoutes.test.ts`
- `rentchain-frontend/src/api/billingApi.ts`
- `rentchain-frontend/src/api/billingApi.test.ts`
- `.codex/docs/billing.md`
- `.handoff/impl-summary.md`

## Validation

- `cd rentchain-api && source ~/.nvm/nvm.sh && nvm use 20 && npm run test:single -- src/routes/__tests__/billingRoutes.test.ts`
  - PASS: 1 test file, 13 tests
- `cd rentchain-frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test:single -- src/api/billingApi.test.ts`
  - PASS: 1 test file, 3 tests
- `cd rentchain-frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test:single -- src/pages/BillingPage.test.tsx src/hooks/useBillingStatus.test.tsx src/billing/openUpgradeFlow.test.ts`
  - PASS: 3 test files, 8 tests
- `cd rentchain-api && source ~/.nvm/nvm.sh && nvm use 20 && npm run build`
  - PASS
- `cd rentchain-frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run build`
  - PASS
- `cd rentchain-frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test`
  - PASS: 293 test files, 1153 tests
- `git diff --check`
  - PASS
- `cd rentchain-api && source ~/.nvm/nvm.sh && nvm use 20 && npm run test`
  - FAIL: full backend suite hit unrelated local `listen EPERM: operation not permitted 0.0.0.0` failures in route tests outside billing. Focused billing backend tests passed.

## Manual QA

Manual QA is required because this mission changes frontend checkout routing, backend billing route authorization, and user-visible billing/subscription behavior.

Manual QA not completed in this local environment. Required preview QA:

1. Log in as landlord and trigger checkout from billing/upgrade flow.
   - Confirm the Network tab shows `POST /api/billing/checkout`.
   - Confirm the request is not sent to `/api/billing/create-checkout-session`.
   - Confirm the response includes a checkout redirect URL.
2. Log in as landlord and load billing/account page.
   - Confirm tier, status, interval, and renewal date display without raw Stripe customer IDs, subscription IDs, invoices, or provider payloads.
3. Log in as tenant and attempt billing routes.
   - Confirm subscription status and checkout creation are denied.
4. Log out and attempt billing checkout/status routes.
   - Confirm unauthenticated access is denied.
5. Simulate Stripe unavailable or missing price configuration.
   - Confirm checkout errors are safe and do not expose raw Stripe error details or stack traces.
6. Confirm pricing display still loads from public billing pricing route.
7. Confirm Track B payout/statement flows are not introduced or exposed.

## Protected Areas

- No pricing or entitlement configuration changes.
- No Stripe webhook changes.
- No Stripe Connect, payout, statement, tenant rent payment settlement, or Track B implementation.
- No Firestore rules changes.
- No CI/CD, deployment, Terraform, or migration changes.
- No new dependencies.

## Known Limitations

- Subscription status can only be Stripe-derived when synced subscription fields are already stored on the landlord record.
- When no synced subscription fields exist, status remains plan-tier inferred and is explicitly labeled with `statusSource: "plan_tier"`.
- Full backend suite remains blocked locally by unrelated `listen EPERM` route-test failures.
- Full checkout manual E2E requires seeded landlord accounts, configured Stripe price IDs, and a preview billing environment.

## Acceptance Criteria Status

- Frontend checkout route alignment: completed.
- Backend canonical checkout route: completed.
- Compatibility alias for stale checkout clients: completed.
- Landlord-only billing route access: completed.
- Tenant billing route denial: completed in tests.
- Safe subscription status response without raw Stripe IDs: completed.
- Subscription status source labeling: completed.
- Billing route documentation: completed.
- Track B deferral documented: completed.
- Backend focused billing tests: completed.
- Frontend focused and full tests: completed.
- Backend build and frontend build: completed.
- Manual QA: pending preview environment.

## Recommended Next Mission

Run billing checkout manual preview QA with seeded landlord accounts and Stripe test price configuration, then continue to Phase F tenant portal environment documentation.
