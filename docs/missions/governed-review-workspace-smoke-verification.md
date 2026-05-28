# Governed Review Workspace Smoke Verification

## Purpose

Governed review workspace routes expose admin-only governance metadata. Smoke verification confirms the route hardening remains effective before any backend deployment is authorized.

This verification is read-only. It must not create, modify, delete, or backfill governed workspace records.

## Coverage

The smoke path verifies:

- access control for unauthenticated, non-admin, and admin requests
- `x-route-source: governedReviewWorkspaceRoutes.ts` on list, detail, denied, and missing-record responses
- metadata-only response shape for list and detail reads
- tenant and landlord visibility flags remain false
- unsafe display text, storage paths, bearer text, raw link IDs, and raw tenant or landlord markers are not returned
- `/admin/review-workspaces` renders for authenticated admin smoke sessions
- frontend requests to the review workspace API include the governed route-source response header

## Local Run

Backend-only smoke:

```bash
RUN_FRONTEND_SMOKE=false tools/qa/run-governed-workspace-smoke.sh
```

Full smoke against a local frontend and API:

```bash
API_BASE_URL=http://localhost:8080 \
PREVIEW_URL=http://localhost:5173 \
tools/qa/run-governed-workspace-smoke.sh
```

For authenticated frontend smoke, provide an admin storage state through the existing Playwright smoke convention:

```bash
QA_ADMIN_STORAGE_STATE=/path/to/admin-storage-state.json \
API_BASE_URL=http://localhost:8080 \
PREVIEW_URL=http://localhost:5173 \
tools/qa/run-governed-workspace-smoke.sh
```

## Results

The runner writes artifacts to:

```text
test-results/governed-workspace-smoke/
```

Expected outputs include:

- `backend-smoke-results.json`
- `summary.md`
- Playwright JSON, screenshots, and HTML report when frontend smoke is enabled

The runner exits non-zero if any enabled smoke check fails.

## Pass Criteria

Smoke verification passes when:

- backend smoke returns status 0
- frontend smoke returns status 0 when enabled
- route-source headers match `governedReviewWorkspaceRoutes.ts`
- access control returns 401 for unauthenticated requests and 403 for non-admin requests
- admin list and detail reads return metadata-only payloads
- missing detail reads return 404 without losing route-source attribution
- no unsafe payload markers appear in smoke responses

## Limitations

The backend smoke test uses mocked auth and an in-memory read fixture so it remains read-only and does not touch production data. Environment-level frontend smoke still requires a deployed or locally running API and valid admin storage state to exercise authenticated browser requests.

Backend deployment remains out of scope for this mission.

## Deployment Readiness Checklist

Before backend deployment authorization:

- run backend smoke successfully
- run frontend smoke successfully against the target environment
- inspect `test-results/governed-workspace-smoke/summary.md`
- confirm no write operations were performed
- confirm no sensitive markers appear in smoke output
