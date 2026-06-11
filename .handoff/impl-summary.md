PR: #1139
PR URL: https://github.com/rentchaincanada/rentchain/pull/1139
Branch: fix/free-tier-upgrade-path-clarity-v1

# Implementation Summary

Mission: Free Tier Upgrade Path Clarity

## Summary

- Added shared tier guidance copy and upgrade documentation link constants.
- Added a free-plan property creation callout explaining manual intake and Starter application invitation/tenant portal upgrade path.
- Added a free-plan applications page banner near the applicant workflow with a contextual Starter CTA.
- Added a free-plan property overview panel that labels each property as Free tier and provides an Upgrade to Starter CTA.
- Preserved existing backend-driven entitlement checks and billing flows; no auth, pricing, entitlement, or billing route behavior changed.
- Added focused frontend regression coverage for the new guidance copy and CTA surfaces.

## Files Changed

- `rentchain-frontend/src/constants/tiers.ts`
- `rentchain-frontend/src/constants/tiers.test.ts`
- `rentchain-frontend/src/components/properties/AddPropertyForm.tsx`
- `rentchain-frontend/src/components/properties/AddPropertyForm.test.tsx`
- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/pages/ApplicationsPage.test.tsx`
- `rentchain-frontend/src/pages/PropertiesPage.tsx`
- `rentchain-frontend/src/pages/PropertiesPage.test.tsx`
- `.handoff/impl-summary.md`

## Validation

- `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run test -- src/constants/tiers.test.ts src/components/properties/AddPropertyForm.test.tsx src/pages/ApplicationsPage.test.tsx src/pages/PropertiesPage.test.tsx` in `rentchain-frontend`
- `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run build` in `rentchain-frontend`
- `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run test -- src/routes/__tests__/tenantInvitesRoutes.test.ts src/routes/__tests__/rentalApplicationsDecisionActions.test.ts` in `rentchain-api`
- `git diff --check`

## Manual QA

- Not run locally. Preview/manual QA should verify free-plan landlords see upgrade guidance during property creation, on the applications page, and in the property overview.
- Preview/manual QA should verify guidance does not block property creation, manual applicant handling, or property selection workflows.
- Preview/manual QA should verify tenant and contractor views do not show landlord tier guidance.

## Known Limitations

- No upgrade checkout flow, payment modal, pricing change, analytics event, entitlement change, or billing API change was included.
- Backend route enforcement was verified with focused existing tests, but no backend source changes were made.
- Frontend build still reports the existing large chunk warning; the build completed successfully.
- Focused `PropertiesPage.test.tsx` still emits a pre-existing duplicate mocked property key warning in one test; assertions pass.
