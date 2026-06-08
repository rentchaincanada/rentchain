PR: #1119
PR URL: https://github.com/rentchaincanada/rentchain/pull/1119
Branch: fix/contractor-invite-visibility-v1

# Implementation Summary

## Mission
Establish contractor invite portal visibility and normalize contractor message projection safety.

## Files Changed
- `rentchain-api/src/services/contractorPortalService.ts`
- `rentchain-api/src/routes/__tests__/contractorPortalRoutes.test.ts`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/App.routes.test.tsx`
- `rentchain-frontend/src/api/contractorPortalApi.ts`

## What Changed
- Routed `/contractor/invite/:token` and `/contractor/invite?invite=...` to `ContractorInviteAcceptPage`.
- Removed sender display names from contractor-visible message projection to prevent stored landlord/operator names from being returned in contractor message responses.
- Kept stored internal contractor message metadata unchanged for server-side authorization and audit continuity.
- Removed obsolete `landlordId` and `senderName` fields from the contractor message frontend response type.
- Added backend tests proving listed and embedded contractor messages exclude landlord identifiers, sender identifiers, recipient role metadata, and landlord/operator display names.
- Added frontend route tests proving both contractor invite URL forms render the invite acceptance page.

## Governance
- Scope limited to contractor invite routing and contractor message projection safety.
- No auth, Firestore rules, billing, screening, pricing, deployment, dependency, landlord workflow, tenant workflow, or admin workflow changes.
- Contractor routes still use existing `requireContractor` middleware and self-scope checks.
- Message storage remains append-safe; only contractor-facing projection changed.
- Contractor message responses now use explicit whitelist projection fields.

## Validation
- `npm --prefix rentchain-api run test -- src/routes/__tests__/contractorPortalRoutes.test.ts`: PASS, 6 tests.
- `npm --prefix rentchain-api run build`: PASS.
- `npm --prefix rentchain-frontend run test -- src/App.routes.test.tsx src/pages/contractor/ContractorJobsPage.test.tsx`: PASS, 56 tests.
- `npm --prefix rentchain-frontend run test`: PASS, 294 files, 1157 tests.
- `npm --prefix rentchain-frontend run build`: PASS.
- `git diff --check`: PASS.

## Manual QA
- Manual browser QA not completed in this environment.
- Full invite acceptance QA requires seeded preview contractor invite tokens and authenticated contractor test accounts.
- Automated route and projection tests verify the mission-critical routing and response-shape behavior.

## Known Limitations
- `/contractor/signup` remains on the existing legacy onboarding redirect path; this mission only wires `/contractor/invite/:token` and `/contractor/invite?invite=...`.
- Contractor invite acceptance still depends on existing backend invite token state and account setup.
- Stored internal contractor message records still retain landlord scope metadata for authorization; the contractor-facing projection removes that metadata.

## Recommended Follow-Up
- Run manual preview QA with seeded contractor invite tokens.
- Verify contractor invite acceptance across unauthenticated, contractor-authenticated, and wrong-role authenticated sessions.
