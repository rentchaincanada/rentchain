# Reporting Runbook (Production Readiness)

## 1) Required env vars (prod defaults)
- Phase 3.2A (shadow only):
  - `REPORTING_ENABLED=true` (allows shadow ops)
  - `REPORTING_DRY_RUN=true` (mandatory)
- Baseline defaults:
  - `REPORTING_ENABLED=false` (hard stop if set false)
  - `REPORTING_DRY_RUN=true` (no external submits)
- `REPORTING_MAX_ATTEMPTS=3`
- `REPORTING_TASK_SECRET=<strong random>`
- `REPORTING_STUCK_THRESHOLD_MINUTES=10`
- `REPORTING_SWEEP_LIMIT=50`
- Optional pilot allowlist: `REPORTING_PILOT_LANDLORD_IDS="id1,id2"`
 - Phase 3.2B micro-live: set `REPORTING_DRY_RUN=false` ONLY when ready for single live submit.

## 2) Hot pause / resume
- Preferred: call `POST /api/admin/reporting/pause` to set `config/reporting.reportingPaused=true` (no redeploy).
- Resume: `POST /api/admin/reporting/resume`.
- Hard stop: set `REPORTING_ENABLED=false` and redeploy (env is the hard ceiling; resume cannot override a false env).

## 3) Sanity check endpoints
- Metrics: `GET /api/admin/reporting/metrics?days=7`
- Providers: `GET /api/admin/reporting/providers`
- Processor (requires HMAC): `POST /api/internal/reporting/process` with header `x-reporting-task-signature = HMAC_SHA256(body, REPORTING_TASK_SECRET)` and body `{ "submissionId": "<id>" }`

## 4) Incident procedure (short)
1. Pause (`POST /api/admin/reporting/pause`).
2. Snapshot metrics (`/api/admin/reporting/metrics`).
3. Inspect `lastError` on submissions (admin status/logs).
4. Decide: retry (`POST /api/admin/reporting/retry`) or hold. Keep `REPORTING_ENABLED=false` / paused until resolved.

## 5) Stuck processing sweeper
- Definition: status = "processing" AND `processingStartedAt` older than threshold (default 10 minutes).
- Manual sweep: `POST /api/admin/reporting/sweep-stuck` with optional `{ olderThanMinutes, limit, dryRun }`.
- Adjust threshold: env `REPORTING_STUCK_THRESHOLD_MINUTES` (default 10); limit via `REPORTING_SWEEP_LIMIT` (default 50).

## 6) Smoke script (safe, no submissions)
- Run `scripts/reporting_smoke_prod.sh` with `ADMIN_TOKEN` and optional `API_BASE`.
- Steps: metrics → providers → pause → resume → sweep-stuck (dry-run).

## 7) Shadow prepare script (safe, no submit)
- Run `scripts/reporting_shadow_prepare.sh` with `LANDLORD_TOKEN`, `TENANT_ID`, optional `API_BASE`, `MONTHS`.
- Calls shadow prepare and shadow status (dry-run only).

## 8) Micro-live (admin-only, one at a time)
1. Set env for live: `REPORTING_ENABLED=true`, `REPORTING_DRY_RUN=false` (Phase 3.2B only).
2. List eligible: `GET /api/admin/reporting/micro-live/eligible`.
3. Approve: `POST /api/admin/reporting/micro-live/approve { submissionId }`.
4. Submit live: `POST /api/admin/reporting/micro-live/submit { submissionId }` (admin only).
5. Verify metrics/ledger; pause via `POST /api/admin/reporting/pause` for emergency stop.
6. Script: `scripts/reporting_micro_live_admin.sh` with `ADMIN_TOKEN`, `SUBMISSION_ID`, optional `API_BASE`.
