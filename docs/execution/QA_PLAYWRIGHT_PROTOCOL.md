# QA Playwright Protocol

## Purpose

This protocol defines safe Playwright readiness for RentChain preview QA. It supports Codex implementation checks, Claude audit/testing, and operator review without creating production mutations or replacing manual approval.

## Existing State

- Playwright is already present in `rentchain-frontend` as a dev dependency.
- The current config is `rentchain-frontend/playwright.config.ts`.
- Existing Playwright tests live under `rentchain-frontend/tests/playwright`.
- This mission adds wrapper scripts only. It does not add dependencies or change product runtime behavior.

## Safety Rules

- Use preview or local URLs only.
- Do not run QA against production unless the operator explicitly authorizes it.
- Do not commit credentials, session cookies, screenshots containing secrets, or downloaded sensitive payloads.
- Do not mutate production records from browser QA.
- Do not test landlord, tenant, or admin flows with another role's credentials.
- Capture screenshots/traces only when they are safe to store locally and are not committed by default.

## Environment Inputs

QA scripts use:

- `PREVIEW_URL`: target preview or local base URL
- `QA_ROLE`: `tenant`, `landlord`, or `admin`
- `QA_BROWSER`: optional Playwright browser name for future extension

Example:

```bash
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-tenant-smoke.sh
```

If `PREVIEW_URL` is not set, scripts default to `http://localhost:5173`.

## Script Behavior

The smoke scripts:

- verify `rentchain-frontend` exists
- verify Playwright is available through the existing frontend install
- print the target URL and role
- print whether the run is authenticated through local storage state or unauthenticated
- run the mobile preview smoke harness by default
- pass `PREVIEW_URL` through Playwright `baseURL`
- create role-labeled Playwright artifact and HTML report folders
- create a role-labeled Playwright JSON report
- generate a concise Markdown QA summary after the run, even when smoke tests fail
- generate a Claude-ready QA review pack in Markdown and JSON
- refuse production URLs unless `ALLOW_PRODUCTION_QA=true` is explicitly set
- fail clearly if dependencies are missing

They do not:

- install dependencies
- add test data
- write to Firestore
- deploy code
- modify product runtime configuration

## Role-Specific Smoke Scripts

- `tools/qa/run-mobile-smoke.sh`: general mobile-oriented smoke entrypoint
- `tools/qa/run-admin-smoke.sh`: admin/governance smoke entrypoint
- `tools/qa/run-tenant-smoke.sh`: tenant portal smoke entrypoint
- `tools/qa/run-landlord-smoke.sh`: landlord operations smoke entrypoint
- `tools/qa/verify-cloud-run-preview-revision.sh`: read-only backend revision verifier for preview QA

The role-specific scripts default to their matching Playwright spec:

- `admin-smoke`
- `tenant-smoke`
- `landlord-smoke`

`run-mobile-smoke.sh` still defaults to `mobile-preview-smoke` unless `QA_SPEC` is overridden. The harness is non-mutating: protected routes may render login/access-denied states when authenticated storage state is not supplied, but the run still verifies preview reachability, desktop/mobile viewport containment, console/page-error behavior, and artifact capture.

Use `QA_SPEC=mobile-layout-matrix` when the goal is responsive layout regression coverage across the tenant, landlord, and admin route matrix. The matrix runs iPhone, Android, and narrow mobile viewports and checks horizontal overflow, oversized panels/cards, fixed navigation overflow, clipped interactive controls, and role shell visibility. It remains non-mutating and uses the same artifact, finding classification, storage-state, QA summary, and Claude review-pack outputs as the other smoke suites.

Role-specific wrapper scripts write to role-scoped artifact folders by default, such as `test-results/admin-smoke`, `test-results/tenant-smoke`, and `test-results/landlord-smoke`.

Examples:

```bash
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-mobile-smoke.sh
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-tenant-smoke.sh
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-admin-smoke.sh
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-landlord-smoke.sh
PREVIEW_URL=https://example-preview.vercel.app QA_SPEC=mobile-layout-matrix tools/qa/run-mobile-smoke.sh
```

Optional inputs:

- `QA_SPEC`: Playwright spec filter, default `mobile-preview-smoke`
- `QA_GREP`: Playwright grep filter
- `QA_BROWSER`: Playwright project name when projects are added
- `QA_ARTIFACT_DIR`: output directory under `rentchain-frontend`, default `test-results/mobile-smoke` or `test-results/<role>-smoke`
- `QA_HTML_REPORT_DIR`: HTML report directory under `rentchain-frontend`, default `playwright-report/mobile-smoke` or `playwright-report/<role>-smoke`
- `QA_JSON_REPORT_FILE`: Playwright JSON report path under `rentchain-frontend`, default `<QA_ARTIFACT_DIR>/qa-results.json`
- `QA_MARKDOWN_REPORT_FILE`: generated Markdown QA summary path under `rentchain-frontend`, default `<QA_ARTIFACT_DIR>/qa-summary.md`
- `QA_REVIEW_PACK_FILE`: Claude-ready Markdown review pack path under `rentchain-frontend`, default `<QA_ARTIFACT_DIR>/qa-review-pack.md`
- `QA_REVIEW_PACK_JSON_FILE`: structured review pack JSON path under `rentchain-frontend`, default `<QA_ARTIFACT_DIR>/qa-review-pack.json`
- `QA_REVISION_VERIFICATION_FILE`: optional local text artifact from `verify-cloud-run-preview-revision.sh`
- `QA_TRACE=on`: collect traces for all tests instead of failures only
- `QA_VIDEO=on`: collect videos for all tests instead of failures only

## Structured QA Reports

Every `tools/qa/run-*-smoke.sh` wrapper writes a Markdown QA summary after Playwright exits. The summary is generated by `tools/qa/generate-playwright-qa-report.mjs` from the Playwright JSON reporter output.

Each wrapper also writes a Claude review pack generated by `tools/qa/generate-claude-qa-review-pack.mjs`.

Default output locations:

- Mobile smoke: `rentchain-frontend/test-results/mobile-smoke/qa-summary.md`
- Admin smoke: `rentchain-frontend/test-results/admin-smoke/qa-summary.md`
- Tenant smoke: `rentchain-frontend/test-results/tenant-smoke/qa-summary.md`
- Landlord smoke: `rentchain-frontend/test-results/landlord-smoke/qa-summary.md`

Default Claude review pack locations:

- Mobile smoke: `rentchain-frontend/test-results/mobile-smoke/qa-review-pack.md`
- Admin smoke: `rentchain-frontend/test-results/admin-smoke/qa-review-pack.md`
- Tenant smoke: `rentchain-frontend/test-results/tenant-smoke/qa-review-pack.md`
- Landlord smoke: `rentchain-frontend/test-results/landlord-smoke/qa-review-pack.md`

The summary includes:

- preview URL
- generated timestamp
- role and spec
- pass/fail/skip/flaky counts
- classified findings totals
- per-route/per-test status
- failure details when present
- screenshot, trace, video, JSON, and HTML report locations

The Claude review pack adds:

- authenticated versus unauthenticated mode
- optional revision verification artifact status
- hard failures grouped separately from possible regressions
- expected auth-gated behavior separated from third-party/browser noise
- environment/browser warnings separated from product failures
- screenshot, trace, video, HTML report, JSON report, and local artifact paths

These summaries and review packs are designed for Codex and Claude review handoff. Keep them local unless an operator explicitly asks to share excerpts. Do not commit generated reports, screenshots, traces, videos, storage state, cookies, tokens, or downloaded private data.

If backend freshness matters, save the revision verifier output locally and pass it into the smoke wrapper:

```bash
PREVIEW_URL=https://example-preview.vercel.app \
EXPECTED_COMMIT=<pr-head-sha> \
tools/qa/verify-cloud-run-preview-revision.sh > rentchain-frontend/test-results/revision-verification.txt

PREVIEW_URL=https://example-preview.vercel.app \
QA_REVISION_VERIFICATION_FILE=rentchain-frontend/test-results/revision-verification.txt \
tools/qa/run-admin-smoke.sh
```

## Cloud Run Preview Revision Verification

Vercel preview freshness does not prove that Cloud Run is serving the expected backend commit. For missions that touch `rentchain-api`, run the revision verifier before treating preview API payloads as current.

The verifier is read-only and calls only safe public or diagnostic endpoints. It refuses production targets unless `ALLOW_PRODUCTION_QA=true` is explicitly set.

Required:

- `PREVIEW_URL`: frontend preview URL or backend preview origin
- one of `EXPECTED_COMMIT`, `EXPECTED_BACKEND_COMMIT`, `EXPECTED_REVISION`, or `EXPECTED_IMAGE_TAG`

Optional:

- `BACKEND_BASE_URL`: backend origin when the frontend preview and backend probe origin differ
- `VERIFY_TIMEOUT_SECONDS`: per-endpoint curl timeout, default `10`

Examples:

```bash
PREVIEW_URL=https://example-preview.vercel.app \
EXPECTED_COMMIT=<pr-head-sha> \
tools/qa/verify-cloud-run-preview-revision.sh

PREVIEW_URL=https://example-preview.vercel.app \
BACKEND_BASE_URL=https://backend-preview.example.run.app \
EXPECTED_IMAGE_TAG=<image-tag-or-short-sha> \
tools/qa/verify-cloud-run-preview-revision.sh
```

The verifier checks known safe probes, including `/health`, `/health/db`, `/health/ready`, `/api/_build`, `/api/__probe/version`, and `/api/__probe/revision`. It also reports gated diagnostics such as `/api/__debug/build` and `/api/_echo` when present, but gated `404` responses are not treated as proof of backend freshness.

If none of the safe endpoint responses contain an expected commit, revision, or image token, the script fails clearly. Current public probes may expose only route/build presence flags rather than the raw commit or revision value; in that case, use `docs/execution/CLOUD_RUN_DEPLOYMENT_CHECKLIST.md` to confirm the active Cloud Run revision, image tag/digest, and 100 percent traffic allocation before continuing preview QA.

## Authenticated Role State

Role smoke tests may use Playwright storage-state files when an operator provides them through environment variables. Authenticated state is optional; if no storage-state path is provided, smoke tests keep running as unauthenticated reachability checks.

Supported variables:

- `QA_ADMIN_STORAGE_STATE`
- `QA_TENANT_STORAGE_STATE`
- `QA_LANDLORD_STORAGE_STATE`
- `QA_STORAGE_STATE` as a generic fallback

Precedence:

1. role-specific storage state, such as `QA_TENANT_STORAGE_STATE`
2. generic `QA_STORAGE_STATE`
3. unauthenticated smoke mode

The wrapper scripts print the active auth mode. When a storage-state variable is set, the referenced file must exist before Playwright starts; missing files fail fast with a clear message.

Authenticated admin smoke is stricter than unauthenticated reachability smoke. When `QA_ADMIN_STORAGE_STATE` or `QA_STORAGE_STATE` is provided to `tools/qa/run-admin-smoke.sh`, the admin smoke suite applies the storage state and requires role-appropriate admin shell text on each checked route. If that shell text is missing, treat the result as an expired or wrong-role storage-state candidate unless screenshots/traces show a real admin route regression.

The authenticated admin suite remains read-only. It checks admin dashboard, properties, tenants, leases, governed review workspaces, support escalations, security incidents, and support-operations continuity without approving, resolving, deleting, dismissing, or mutating records.

Authenticated landlord smoke follows the same storage-state safety model. When `QA_LANDLORD_STORAGE_STATE` or `QA_STORAGE_STATE` is provided to `tools/qa/run-landlord-smoke.sh`, the landlord suite applies the storage state and requires role-appropriate landlord shell text on each checked route. If that shell text is missing, treat the result as an expired or wrong-role storage-state candidate unless screenshots/traces show a real landlord route regression.

The authenticated landlord suite remains read-only. It checks dashboard, properties, applications, decision inbox, operations, leases, payments, work orders, and messages continuity without approving applications, sending notices, recording payments, assigning work orders, or mutating records.

Authenticated tenant smoke follows the same storage-state safety model. When `QA_TENANT_STORAGE_STATE` or `QA_STORAGE_STATE` is provided to `tools/qa/run-tenant-smoke.sh`, the tenant suite applies the storage state and requires role-appropriate tenant shell text on each checked route. If that shell text is missing, treat the result as an expired or wrong-role storage-state candidate unless screenshots/traces show a real tenant portal regression.

The authenticated tenant suite remains read-only. It checks tenant workspace, lease, ledger, documents, messages, profile, and maintenance continuity without sending messages, signing documents, initiating payments, editing profile data, submitting applications, or creating maintenance requests.

Safe local locations:

- outside the repository, such as `/tmp/rentchain-playwright/tenant.json`
- recommended local auth-state folder: `~/rentchain-auth`
- ignored artifact paths, such as `rentchain-frontend/test-results/storage-state/tenant.json`

Create the recommended local folder before using storage-state paths:

```bash
mkdir -p ~/rentchain-auth
```

Expected local filenames:

- `~/rentchain-auth/tenant-storage-state.json`
- `~/rentchain-auth/landlord-storage-state.json`
- `~/rentchain-auth/admin-storage-state.json`

Storage-state files can contain cookies, local storage, Firebase session material, and other secrets. They must remain local only. Do not commit them, paste them into PRs, attach them to public issues, include them in Claude/ChatGPT/Codex uploads, or upload them as QA artifacts. `test-results/` and `playwright-report/` are ignored local artifact paths.

Manual operator workflow:

1. Open the target preview manually and sign in as the intended role.
2. Use local Playwright tooling to save storage state to an ignored path.
3. Export only the local path, not credentials:

```bash
export QA_TENANT_STORAGE_STATE=~/rentchain-auth/tenant-storage-state.json
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-tenant-smoke.sh
```

4. Delete or rotate storage-state files after QA if the session should not persist.

Codex should not request, generate, store, or commit credentials. If authenticated state is unavailable, run unauthenticated smoke and report auth-gated findings honestly.

Admin example:

```bash
export QA_ADMIN_STORAGE_STATE=~/rentchain-auth/admin-storage-state.json
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-admin-smoke.sh
```

Landlord example:

```bash
export QA_LANDLORD_STORAGE_STATE=~/rentchain-auth/landlord-storage-state.json
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-landlord-smoke.sh
```

Tenant example:

```bash
export QA_TENANT_STORAGE_STATE=~/rentchain-auth/tenant-storage-state.json
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-tenant-smoke.sh
```

Planned capture workflow:

- Future mission: `feat/playwright-storage-state-capture-workflow-v1`
- Purpose: safely support operator-supervised storage-state capture commands:
  - `npm run qa:capture-tenant-state`
  - `npm run qa:capture-landlord-state`
  - `npm run qa:capture-admin-state`
- Expected flow: the operator runs a capture command, Playwright opens the preview login, the operator signs in manually, Playwright saves storage state under `~/rentchain-auth/`, and future authenticated smoke reuses the local file.
- Guardrail: no credentials, cookies, tokens, or storage-state JSON are committed, pasted into AI tools, or uploaded as artifacts.

Until that capture workflow exists, preserve current fail-closed behavior: when a `QA_*_STORAGE_STATE` path is provided but the file does not exist, smoke must fail clearly before Playwright starts.

## Evidence Handling

When Playwright produces artifacts:

- keep `playwright-report/` and `test-results/` uncommitted
- summarize key failures in the PR or QA report
- use `qa-summary.md` as the default operator/Claude review artifact
- use `qa-review-pack.md` when Claude needs grouped severity, revision-verification context, and artifact paths
- include screenshots only when they do not expose secrets, raw IDs, private documents, tokens, or sensitive user data
- failures should include the route/page label, viewport, target URL, and artifact/report path from the smoke script output

## Pass / Fail Interpretation

Passing Playwright smoke is not merge approval by itself.

Smoke findings are classified so preview QA can separate expected protected-route noise from real failures:

- `expected-auth-gated-response`: expected `401` or `403` resource responses when a protected route is checked without authenticated storage state.
- `expected-third-party-browser-noise`: known browser/provider noise, including CSP-blocked preview fonts, Google provider account-list messages, and FedCM token retrieval noise.
- `environment-browser-permission-issue`: browser-launch or local environment restrictions, such as macOS Chromium Mach port permission failures in a sandbox.
- `possible-app-regression`: unexpected console errors or throttling-like `429` responses that need operator review. Unknown console errors fail the smoke run; known `429` noise is reported as a warning.
- `hard-failure`: fatal page errors, app crashes, and route-level failures such as unexpected `5xx` responses.

Each smoke test attaches `classified-smoke-findings` JSON to its Playwright result. Claude/Codex review should cite the category and route before treating a finding as a product blocker.

Merge readiness still requires:

- relevant local validation
- GitHub required checks
- operator/Orion QA interpretation
- explicit merge authorization

If Playwright disagrees with local tests, treat it as a QA finding and inspect the runtime path before assuming either signal is wrong.

## Future Roadmap

Future missions may add:

- authenticated role-specific Playwright specs that use `PREVIEW_URL`
- authenticated storage-state fixtures stored outside the repo
- deterministic screenshot comparison for mobile layouts
- route-source header checks for backend preview routes
- safe trace collection conventions
