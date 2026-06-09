# Merge Log

PR: #1128
PR URL: https://github.com/rentchaincanada/rentchain/pull/1128
Branch: fix/viewing-cancellation-notification-v1
Base: main
Head commit: 8a7ffcec62e5c5a5cda53a005a492ae52936e60a
Merge commit: fb9ecc6e0d4024d7ff141ccc84aa62ae8ff433b7
Merged at: 2026-06-09T16:49:34Z

## Merge Confirmation
- PR #1128 merged into `main` using standard merge with operator-provided admin authorization.
- Local `main` synced with `origin/main`.
- Local branch `fix/viewing-cancellation-notification-v1` deleted.
- Remote branch `fix/viewing-cancellation-notification-v1` deleted.

## Final Check Status
- All required checks were green before merge.
- backend: pass.
- frontend: pass.
- merge-gate: pass.
- codex-review: pass.
- Terraform Cloud/Rentchain/repo-id-KeMiLzWpFf7Yq2Zr: pass.
- Vercel Preview Comments: pass.
- Vercel `rentchain`: pass.
- Vercel `rentchain-status`: pass.
- post-review-comment: skipped.

## Confirmed Scope
- Added applicant notifications for landlord viewing cancellations.
- Added viewing reschedule service flow and route handler.
- Added landlord-prefixed cancellation and reschedule route aliases while preserving existing viewing routes.
- Added deterministic safe viewing references for applicant notifications.
- Added idempotent notification creation for cancellation and unchanged reschedule retries.
- Added transaction-aware persistence for viewing request update, tenant notification creation, and viewing audit event creation.
- Added `tenant.viewing` source support for safe tenant inbox projection.
- No frontend UI, Firestore rules, billing, screening, pricing, deployment, dependency, or auth core changes.

## Validation Evidence
- `npm --prefix rentchain-api test -- src/routes/__tests__/viewingRoutes.test.ts`: pass, 1 file, 19 tests.
- `npm --prefix rentchain-api test -- src/tests/unifiedInbox/`: pass, 5 files, 17 tests.
- `npm --prefix rentchain-api run build`: pass.
- `git diff --check`: pass.
- `npm --prefix rentchain-api run lint`: not run, script missing in `rentchain-api`.
- Gate 2 QA status: approved with manual override.

## Manual QA Evidence
- `POST /api/viewings/:id/cancel` with no auth returned 401.
- `POST /api/viewings/:id/reschedule` with no auth returned 401.
- Auth boundary enforced on cancellation and reschedule routes.
- Route and data-layer behavior covered by 19 route tests and 17 data-layer tests.

## Known Limitations
- Transaction rollback is covered by the route test mock and production Firestore transaction path; local fallback without `runTransaction` remains best-effort for non-production adapters.
- Applicant notification routing is based on existing viewing request applicant email or tenant fields when present.
- No cancellation or reschedule UI was added.

## Viewing Notifications Live
- Routes: `POST /api/viewings/:id/cancel`, `POST /api/viewings/:id/reschedule`
- Aliases: `POST /api/landlord/viewing/:id/cancel`, `POST /api/landlord/viewing/:id/reschedule`
- Tests: 19 viewing route tests + 17 unified inbox data-layer tests passing
- Auth: landlord auth boundary enforced
- Projection: viewing notification source uses safe tenant inbox references

## Recommended Next Mission
- feat/unified-inbox-data-layer-expansion-v1 — add viewing requests, work order communications, notices, and remaining application status sources before building inbox UI.
