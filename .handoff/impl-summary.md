PR: #1128
PR URL: https://github.com/rentchaincanada/rentchain/pull/1128
Branch: fix/viewing-cancellation-notification-v1

# Implementation Summary

## Mission
Fix viewing cancellation and reschedule notifications for applicant-facing viewing workflows.

## Files Changed
- `rentchain-api/src/routes/viewingRoutes.ts`
- `rentchain-api/src/routes/__tests__/viewingRoutes.test.ts`
- `rentchain-api/src/services/viewings/viewingController.ts`
- `rentchain-api/src/services/viewings/viewingRepository.ts`
- `rentchain-api/src/services/viewings/viewingService.ts`
- `rentchain-api/src/services/viewings/viewingTypes.ts`
- `rentchain-api/src/services/unifiedInbox/types.ts`
- `rentchain-api/src/services/unifiedInbox/tenantInboxAdapters.ts`
- `rentchain-api/src/tests/unifiedInbox/tenantInboxAdapters.test.ts`

## What Changed
- Added applicant notifications for landlord viewing cancellations.
- Added viewing reschedule service flow and route handler.
- Added landlord-prefixed route aliases for cancellation and reschedule.
- Added deterministic safe viewing references for applicant notifications.
- Added idempotent notification creation for cancellation and unchanged reschedule retries.
- Added transaction-aware persistence for viewing request update, tenant notification creation, and viewing audit event creation.
- Added `tenant.viewing` source support for safe tenant inbox projection.
- Added tests for cancellation notifications, reschedule notifications, retry idempotency, landlord authorization, rollback behavior, and tenant viewing projection.

## Governance
- Scope limited to backend viewing notification behavior, tenant inbox source typing, and tests.
- No frontend UI, Firestore rules, billing, screening, pricing, deployment, dependency, or auth core changes.
- Landlord ownership remains enforced server-side before cancellation or reschedule changes.
- Applicant notifications use safe deterministic viewing references and do not expose raw viewing request IDs in projected fields.
- Viewing state changes for cancellation and reschedule write an audit event in the same transaction path.

## Validation
- `npm --prefix rentchain-api test -- src/routes/__tests__/viewingRoutes.test.ts`: PASS, 1 file, 19 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/`: PASS, 5 files, 17 tests.
- `npm --prefix rentchain-api run build`: PASS.
- `git diff --check`: PASS.
- `npm --prefix rentchain-api run lint`: NOT RUN, script missing in `rentchain-api`.

## Manual QA
- Not completed locally. This mission changes authenticated backend route behavior and requires manual QA before merge.

## Known Limitations
- Transaction rollback is covered by the route test mock and production Firestore transaction path; local fallback without `runTransaction` remains best-effort for non-production adapters.
- Applicant notification routing is based on existing viewing request applicant email or tenant fields when present.
- No cancellation or reschedule UI was added.

## Recommended Follow-Up
- Manual QA against deployed backend for no-auth 401, wrong-landlord 403, cancellation notification creation, reschedule notification creation, retry idempotency, and safe response fields.
- Continue to unified inbox data-layer expansion after viewing notification QA passes.
