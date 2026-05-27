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
- run the mobile preview smoke harness by default
- pass `PREVIEW_URL` through Playwright `baseURL`
- create role-labeled Playwright artifact and HTML report folders
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

The role-specific scripts default to their matching Playwright spec:

- `admin-smoke`
- `tenant-smoke`
- `landlord-smoke`

`run-mobile-smoke.sh` still defaults to `mobile-preview-smoke` unless `QA_SPEC` is overridden. The harness is non-mutating: protected routes may render login/access-denied states when authenticated storage state is not supplied, but the run still verifies preview reachability, desktop/mobile viewport containment, console/page-error behavior, and artifact capture.

Role-specific wrapper scripts write to role-scoped artifact folders by default, such as `test-results/admin-smoke`, `test-results/tenant-smoke`, and `test-results/landlord-smoke`.

Examples:

```bash
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-mobile-smoke.sh
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-tenant-smoke.sh
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-admin-smoke.sh
PREVIEW_URL=https://example-preview.vercel.app tools/qa/run-landlord-smoke.sh
```

Optional inputs:

- `QA_SPEC`: Playwright spec filter, default `mobile-preview-smoke`
- `QA_GREP`: Playwright grep filter
- `QA_BROWSER`: Playwright project name when projects are added
- `QA_ARTIFACT_DIR`: output directory under `rentchain-frontend`, default `test-results/<role>-mobile-smoke`
- `QA_HTML_REPORT_DIR`: HTML report directory under `rentchain-frontend`, default `playwright-report/<role>-mobile-smoke`
- `QA_TRACE=on`: collect traces for all tests instead of failures only
- `QA_VIDEO=on`: collect videos for all tests instead of failures only

## Authenticated Role State

Role smoke tests may use Playwright storage-state files when an operator provides them through environment variables:

- `QA_ADMIN_STORAGE_STATE`
- `QA_TENANT_STORAGE_STATE`
- `QA_LANDLORD_STORAGE_STATE`
- `QA_STORAGE_STATE` as a generic fallback

Storage-state files must be generated outside the repository or kept in ignored local artifact locations. Do not commit session cookies, bearer tokens, credentials, or storage-state JSON. If no storage state is provided, the role smoke tests run as unauthenticated reachability checks and annotate role-shell expectations as gated when protected pages redirect or block access.

## Evidence Handling

When Playwright produces artifacts:

- keep `playwright-report/` and `test-results/` uncommitted
- summarize key failures in the PR or QA report
- include screenshots only when they do not expose secrets, raw IDs, private documents, tokens, or sensitive user data
- failures should include the route/page label, viewport, target URL, and artifact/report path from the smoke script output

## Pass / Fail Interpretation

Passing Playwright smoke is not merge approval by itself.

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
