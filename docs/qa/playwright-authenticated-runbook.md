# Playwright Authenticated Test Runbook

## Purpose

This runbook explains how to run RentChain Playwright tests with authenticated tenant, landlord, and admin contexts in local and staging-style preview environments. It documents the current storage-state based flow, expected role boundaries, troubleshooting steps, and governance rules for handling credentials and artifacts.

Authenticated Playwright runs must remain read-only and audit-safe. They validate page reachability, role hydration, projection boundaries, and expected fail-closed behavior without submitting forms, approving records, mutating production data, or storing secrets in the repository.

## Current Test Structure

Frontend Playwright configuration lives at `rentchain-frontend/playwright.config.ts`. The current Playwright package version is `1.58.2`.

The frontend Playwright specs and helpers live in `rentchain-frontend/tests/playwright/`:

- `admin-smoke.spec.ts`
- `landlord-smoke.spec.ts`
- `tenant-smoke.spec.ts`
- `mobile-layout-matrix.spec.ts`
- `mobile-preview-smoke.spec.ts`
- `payments.responsive.spec.ts`
- `legacy-smoke-setup.ts`
- `role-smoke-helpers.ts`
- `smoke-findings.ts`
- `qa-artifact-reporter.ts`
- `qa-artifacts.ts`
- `qa-reporter-helpers.ts`

Authenticated role smoke tests use Playwright storage-state JSON files supplied through environment variables. Legacy smoke tests use the dev preview unlock harness and do not require role storage state.

## Authentication Model

Role smoke tests use storage-state files generated from deterministic smoke fixtures in `rentchain-api/tests/storage-state/`. These files are test fixtures for QA automation; they are not production credentials.

The storage-state export command is:

```bash
cd rentchain-api
npm run storage-state:export
```

By default this writes role-specific JSON files under `rentchain-api/.smoke-storage-state/` and prints matching environment variable assignments.

Supported Playwright authentication variables:

- `QA_ADMIN_STORAGE_STATE`
- `QA_LANDLORD_STORAGE_STATE`
- `QA_TENANT_STORAGE_STATE`
- `QA_STORAGE_STATE` as a generic fallback

Resolution order:

1. Role-specific storage state, such as `QA_TENANT_STORAGE_STATE`
2. Generic `QA_STORAGE_STATE`
3. Unauthenticated smoke mode, when the wrapper supports it

The role smoke specs call `requireStorageStateDetailsForRole()`, so `admin-smoke.spec.ts`, `landlord-smoke.spec.ts`, and `tenant-smoke.spec.ts` fail fast when the required storage-state file is missing.

## Secure Environment Setup

Use environment variables for file paths only. Do not paste tokens, cookies, passwords, session JSON, provider credentials, or API keys into shell history, PRs, tickets, logs, generated reports, or documentation.

Local deterministic smoke setup:

```bash
cd rentchain-api
npm run storage-state:export

cd ../rentchain-frontend
export QA_ADMIN_STORAGE_STATE="../rentchain-api/.smoke-storage-state/admin-storage-state.json"
export QA_LANDLORD_STORAGE_STATE="../rentchain-api/.smoke-storage-state/landlord-storage-state.json"
export QA_TENANT_STORAGE_STATE="../rentchain-api/.smoke-storage-state/tenant-storage-state.json"
```

Operator-supervised staging or preview setup should keep session state outside the repository:

```bash
mkdir -p ~/rentchain-auth

export QA_TENANT_STORAGE_STATE=~/rentchain-auth/tenant-storage-state.json
export QA_LANDLORD_STORAGE_STATE=~/rentchain-auth/landlord-storage-state.json
export QA_ADMIN_STORAGE_STATE=~/rentchain-auth/admin-storage-state.json
```

The `~/rentchain-auth/*.json` files must be created by an approved local capture workflow or by manual operator-supervised Playwright tooling. Do not commit these files and do not upload them as QA artifacts.

## Local Test Commands

Run all frontend Playwright tests:

```bash
cd rentchain-frontend
npm run test:e2e
```

Run one authenticated role suite:

```bash
cd rentchain-frontend
npm run test:e2e -- tenant-smoke.spec.ts
npm run test:e2e -- landlord-smoke.spec.ts
npm run test:e2e -- admin-smoke.spec.ts
```

Run through the QA wrapper scripts, which also produce local QA artifacts:

```bash
PREVIEW_URL=http://localhost:5173 tools/qa/run-tenant-smoke.sh
PREVIEW_URL=http://localhost:5173 tools/qa/run-landlord-smoke.sh
PREVIEW_URL=http://localhost:5173 tools/qa/run-admin-smoke.sh
```

Optional debugging:

```bash
cd rentchain-frontend
npm run test:e2e -- tenant-smoke.spec.ts --headed
npm run test:e2e -- tenant-smoke.spec.ts --debug
```

## Staging Or Preview Runs

Set `PREVIEW_URL` to the approved non-production preview origin. Do not run authenticated smoke against production unless the operator explicitly authorizes it.

Tenant preview example:

```bash
export QA_TENANT_STORAGE_STATE=~/rentchain-auth/tenant-storage-state.json
PREVIEW_URL=https://example-preview.example.app tools/qa/run-tenant-smoke.sh
```

Landlord preview example:

```bash
export QA_LANDLORD_STORAGE_STATE=~/rentchain-auth/landlord-storage-state.json
PREVIEW_URL=https://example-preview.example.app tools/qa/run-landlord-smoke.sh
```

Admin preview example:

```bash
export QA_ADMIN_STORAGE_STATE=~/rentchain-auth/admin-storage-state.json
PREVIEW_URL=https://example-preview.example.app tools/qa/run-admin-smoke.sh
```

For backend freshness-sensitive preview QA, run the Cloud Run public signal or revision verifier first and pass the saved local artifact through `QA_REVISION_VERIFICATION_FILE`. See `docs/execution/CLOUD_RUN_DEPLOYMENT_CHECKLIST.md` and `docs/execution/QA_PLAYWRIGHT_PROTOCOL.md`.

## Tenant Flow

Tenant-authenticated tests use `tenant-smoke.spec.ts` and `QA_TENANT_STORAGE_STATE`.

Expected coverage:

- Tenant dashboard hydrates from `/api/me`.
- Tenant lease surfaces load for the authenticated tenant.
- Tenant workspace data includes only the authenticated tenant's lease, property, unit, and maintenance context.
- Tenant routes for maintenance and messages load without submitting records.
- Tenant context cannot access landlord property APIs, landlord property management, or admin surfaces.

Projection boundaries to validate:

- Tenant sees only their own lease and property context.
- Tenant responses do not include another tenant's lease, unit, maintenance request, landlord-only data, admin metadata, storage paths, tokens, or provider payloads.
- Cross-tenant API attempts should fail closed with an expected unauthorized, forbidden, not-found, or access-denied result.

Command:

```bash
export QA_TENANT_STORAGE_STATE=~/rentchain-auth/tenant-storage-state.json
PREVIEW_URL=https://example-preview.example.app tools/qa/run-tenant-smoke.sh
```

## Landlord Flow

Landlord-authenticated tests use `landlord-smoke.spec.ts` and `QA_LANDLORD_STORAGE_STATE`.

Expected coverage:

- Landlord dashboard hydrates from `/api/me`.
- Landlord property and unit surfaces load for owned properties.
- Landlord tenant visibility is limited to tenants assigned to owned units.
- Landlord maintenance visibility is limited to owned units.
- Landlord context cannot access admin APIs, admin routes, or tenant-only APIs.

Projection boundaries to validate:

- Landlord sees only owned properties and associated tenant or maintenance summaries.
- Landlord responses do not include another landlord's property, tenant, unit, lease, or maintenance details.
- Landlord cannot use tenant-only routes as a shortcut to tenant-scoped data.
- Landlord cannot access admin/support-only review, audit, security, or platform-wide management surfaces.

Command:

```bash
export QA_LANDLORD_STORAGE_STATE=~/rentchain-auth/landlord-storage-state.json
PREVIEW_URL=https://example-preview.example.app tools/qa/run-landlord-smoke.sh
```

## Admin And Support Flow

Admin-authenticated tests use `admin-smoke.spec.ts` and `QA_ADMIN_STORAGE_STATE`.

Expected coverage:

- Admin dashboard hydrates from `/api/me`.
- Admin properties, tenants, leases, audit, and support-operation surfaces load.
- Admin can see platform-wide review metadata needed for operational oversight.
- Admin context is not downgraded to tenant or landlord scoping.

Projection boundaries to validate:

- Admin visibility is broader than tenant or landlord visibility, but still must be projection-safe.
- Admin smoke should not expose raw tokens, credentials, private document payloads, provider payloads, or storage paths in artifacts.
- Support-oriented surfaces must remain admin/support gated and must not become public or landlord/tenant visible.

Command:

```bash
export QA_ADMIN_STORAGE_STATE=~/rentchain-auth/admin-storage-state.json
PREVIEW_URL=https://example-preview.example.app tools/qa/run-admin-smoke.sh
```

Support-specific testing should use the admin/support route coverage already present in admin smoke unless a future mission adds a separate support storage-state fixture.

## Backend Auth And Route Guards

The runbook documents current behavior only; it does not authorize changes to auth code.

Relevant middleware:

- `rentchain-api/src/middleware/requireAuth.ts` reads Bearer tokens, verifies claims, builds the canonical session user, and fails unauthenticated requests with 401.
- `rentchain-api/src/middleware/requireAuthz.ts` enforces permission checks and fails missing permissions with 403.
- `rentchain-api/src/middleware/requireAdmin.ts` requires an admin role or configured admin allowlist.
- `rentchain-api/src/middleware/requireLandlord.ts` allows landlord or admin users with landlord context.
- `rentchain-api/src/middleware/requireRole.ts` enforces explicit role membership.
- `rentchain-api/src/middleware/validateTenantScope.ts` requires tenant role and tenant context for tenant-scoped handlers.

Protected route probes in Playwright should confirm fail-closed behavior only. Do not bypass auth, inject privileged credentials, or call mutation endpoints to prove access.

## CI Invocation Pattern

The current GitHub Actions CI workflow installs dependencies, runs frontend unit tests, and builds frontend/backend packages. It does not inject authenticated Playwright storage state.

For future CI-authenticated Playwright jobs, use GitHub encrypted secrets or an approved ephemeral storage-state generation step. CI must pass only file paths through `QA_*_STORAGE_STATE` variables and must avoid printing storage-state JSON or token values.

CI examples should follow this shape:

```bash
export QA_TENANT_STORAGE_STATE="$RUNNER_TEMP/tenant-storage-state.json"
export PREVIEW_URL="https://example-preview.example.app"
tools/qa/run-tenant-smoke.sh
```

The storage-state file creation step must be approved separately. Do not commit workflow changes as part of this documentation mission.

## Troubleshooting

### Missing storage state

Symptom: the role suite fails before opening a browser and reports that storage state is missing.

Check:

```bash
echo "$QA_TENANT_STORAGE_STATE"
test -f "$QA_TENANT_STORAGE_STATE"
```

Resolution: regenerate deterministic local smoke storage state or provide the approved preview storage-state path for the target role.

### Wrong role or expired session

Symptom: a role suite reaches the app but shows login, access denied, missing shell text, or unexpected 401/403 responses.

Check:

- The correct role-specific variable is set.
- The storage-state file was captured for the same preview origin used by `PREVIEW_URL`.
- The target preview is not production unless explicitly authorized.
- The suite being run matches the role in the storage-state file.

Resolution: refresh the storage-state file through an approved local workflow and rerun only the affected role suite.

### 401 responses

Meaning: authentication was missing, invalid, expired, or not accepted by the target route.

Action: verify storage-state path, role, preview origin, and any backend freshness requirements. Do not paste tokens into logs while debugging.

### 403 responses

Meaning: authentication succeeded but the role or permissions are not allowed for the route.

Action: decide whether the 403 is expected role-boundary protection or a regression. Tenant attempts to access landlord/admin routes and landlord attempts to access admin or tenant-only routes should fail closed.

### Projection boundary failures

Symptom: tenant tests see another tenant's data, landlord tests see another landlord's records, or admin artifacts expose sensitive raw payloads.

Action: treat this as a blocking projection-safety finding. Preserve screenshots and traces only if they do not expose sensitive values, then summarize the route, role, expected boundary, and observed leakage.

### Artifact safety

Generated reports under `rentchain-frontend/test-results/` and `rentchain-frontend/playwright-report/` are local artifacts. Do not commit screenshots, traces, videos, storage-state JSON, cookies, tokens, or downloaded private data.

## Governance Rules

- Authenticated Playwright runs must be read-only.
- Do not run mutation flows such as approvals, dismissals, payment recording, lease signing, document submission, message sending, maintenance submission, or profile edits unless a future mission explicitly authorizes a safe fixture-only mutation test.
- Do not run authenticated smoke against production without explicit operator approval.
- Do not request, store, print, commit, upload, or paste credentials, tokens, cookies, storage-state JSON, provider payloads, private documents, or raw internal identifiers.
- Tenant tests must validate tenant isolation.
- Landlord tests must validate landlord-owned boundaries and admin separation.
- Admin/support tests must validate gated platform visibility without leaking sensitive payloads into artifacts.
- If authenticated state is unavailable, run unauthenticated reachability smoke where appropriate and report auth-gated results honestly.

## Related References

- `rentchain-frontend/playwright.config.ts`
- `rentchain-frontend/tests/playwright/role-smoke-helpers.ts`
- `rentchain-frontend/tests/playwright/tenant-smoke.spec.ts`
- `rentchain-frontend/tests/playwright/landlord-smoke.spec.ts`
- `rentchain-frontend/tests/playwright/admin-smoke.spec.ts`
- `rentchain-api/tests/storage-state/export-storage-state.ts`
- `rentchain-api/tests/storage-state/storage-state-generator.ts`
- `docs/development/SMOKE_TEST.md`
- `docs/execution/QA_PLAYWRIGHT_PROTOCOL.md`
- `docs/execution/CLOUD_RUN_DEPLOYMENT_CHECKLIST.md`
