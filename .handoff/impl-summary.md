PR: #1121
PR URL: https://github.com/rentchaincanada/rentchain/pull/1121
Branch: fix/landing-page-login-cta-v1

# Implementation Summary

## Mission
Establish a visually prominent Log In call-to-action on the landing page while preserving the existing signup flow.

## Files Changed
- `rentchain-frontend/src/pages/marketing/LandingPage.tsx`
- `rentchain-frontend/src/pages/marketing/LandingPage.test.tsx`

## What Changed
- Added co-equal `Sign Up Free` and `Log In` button CTAs in the landing page hero.
- Added matching `Sign Up Free` and `Log In` CTAs in the closing landing page section.
- Preserved the existing signup attribution behavior and destination: `/signup?next=/properties&intent=registry_readiness`.
- Added explicit login CTA routing to `/login`.
- Updated landing page tests to verify both CTAs render and route correctly.

## Governance
- Scope limited to the landing page component and its direct test.
- No auth logic, signup logic, login logic, role-specific onboarding, backend routes, Firestore rules, billing, screening, pricing, deployment, or dependency changes.
- No tenant, contractor, or landlord account creation behavior changed.
- Future role-specific onboarding experience remains out of scope for a separate audit.

## Validation
- `npm --prefix rentchain-frontend run test -- src/pages/marketing/LandingPage.test.tsx`: PASS, 4 tests.
- `npm --prefix rentchain-frontend run build`: PASS.
- `git diff --check`: PASS.

## Manual QA
- Local browser QA completed with the dev gate unlocked in browser storage.
- Desktop 1440x900: both CTAs visible, 48px minimum height, click targets route correctly.
- Tablet 768x1024: both CTAs visible, stacked cleanly, 48px minimum height, click targets route correctly.
- Mobile 375x812: both CTAs visible, stacked cleanly, 48px minimum height, click targets route correctly.
- `Log In` routed to `/login`.
- `Sign Up Free` routed to `/signup?next=/properties&intent=registry_readiness`.

## Known Limitations
- Screen reader testing with NVDA, JAWS, or VoiceOver was not completed in this environment.
- Color contrast was reviewed through existing design tokens and button variants, not an external contrast tool.
- Broader login/signup onboarding audit is intentionally deferred.

## Recommended Follow-Up
- Run preview QA on the deployed Vercel URL after PR checks complete.
- Schedule `audit/auth-onboarding-experience-v1` to review role-specific login and signup entry points.
