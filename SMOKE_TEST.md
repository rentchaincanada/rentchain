# Authenticated Smoke Test Guide

## Purpose

Authenticated smoke testing validates core RentChain API and browser workflow contracts before backend deployment is authorized. The checks are read-only by default and use isolated fixture state unless an operator provides a dedicated target environment and role storage state.

## Scope

The smoke suite covers:

- admin session and projection access
- admin property and tenant list projections
- landlord property isolation
- tenant lease isolation
- maintenance request audit trail visibility
- 401 and 403 error response safety
- frontend role storage-state requirements
- frontend critical journey route mapping

The suite does not deploy backend code, mutate production data, run load tests, or authorize promotion by itself.

## Fixture Version

Backend smoke fixtures use `authenticated-smoke-v1`.

Minimum fixture corpus:

- 1 admin user with `system.admin`
- 2 landlord users
- 1 tenant user
- 2 properties
- 2 units
- 2 tenants
- 2 leases
- 2 maintenance requests
- 1 admin audit event

All fixture identifiers are test-prefixed and intended for isolated test environments only.

## Required Environment

Use Node 20.x.

Backend:

```bash
cd rentchain-api
npm ci
npm run test:smoke
```

Frontend:

```bash
cd rentchain-frontend
npm ci
npm run test:smoke
```

For browser-level role smoke against a preview or local app, provide Playwright storage state files:

```bash
QA_ADMIN_STORAGE_STATE=/path/to/admin-storage-state.json
QA_LANDLORD_STORAGE_STATE=/path/to/landlord-storage-state.json
QA_TENANT_STORAGE_STATE=/path/to/tenant-storage-state.json
```

Set the API target explicitly when using browser smoke:

```bash
VITE_API_BASE_URL=https://target-api.example.test/api
```

## Backend Smoke Commands

Run only the smoke suite:

```bash
cd rentchain-api
npm run test:smoke
```

Run the underlying test files directly:

```bash
cd rentchain-api
npm run test:single -- tests/smoke/admin-smoke.test.ts tests/smoke/projection-boundaries.test.ts
```

## Frontend Smoke Commands

Run only the storage-state and navigation contract smoke tests:

```bash
cd rentchain-frontend
npm run test:smoke
```

Run browser role smoke when storage state and app target are available:

```bash
cd rentchain-frontend
npm run test:e2e -- admin-smoke.spec.ts landlord-smoke.spec.ts tenant-smoke.spec.ts
```

## Pass Criteria

Deployment readiness can be recommended only when:

- backend smoke tests pass
- frontend smoke tests pass
- build commands pass for touched workspaces
- `git diff --check` passes
- no projection boundary violations are observed
- 401 and 403 responses do not expose internal details
- any browser smoke run uses valid role storage state for admin, landlord, and tenant roles

## Report Location

Use `docs/reports/authenticated-smoke-readiness-report.md` to record execution evidence, blockers, known limitations, and operator action items.
