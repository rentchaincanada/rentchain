# Smoke Testing with Authenticated Storage State

This document explains how to set up and run authenticated smoke tests using Playwright storage state fixtures.

## Overview

Smoke tests validate critical user workflows without deploying code to production. For authenticated smoke tests, we use **storage state presets** that simulate logged-in users with specific roles and permissions.

The storage state system has three layers:
1. **Fixtures** (backend): Define test data and user contexts
2. **Presets** (backend): Generate Playwright storage state from fixtures
3. **Export** (CLI): Serialize storage state to JSON files for tests to consume

## Setup

### Prerequisites

- Node 20.11.1 (pinned)
- Playwright 1.58.2+

### Generate Storage State Files

First, export the storage state presets to JSON files:

```bash
# From the project root
cd rentchain-api
npm run storage-state:export
```

This command:
- Reads the fixture definitions from `tests/fixtures/admin-storage-state.ts`
- Generates storage state for each role (admin, landlord, tenant)
- Writes JSON files to `.smoke-storage-state/` by default
- Outputs environment variable assignments

### Configure Environment

Source the exported environment variables:

```bash
# From rentchain-frontend, point to the files generated in rentchain-api
export QA_ADMIN_STORAGE_STATE="../rentchain-api/.smoke-storage-state/admin-storage-state.json"
export QA_LANDLORD_STORAGE_STATE="../rentchain-api/.smoke-storage-state/landlord-storage-state.json"
export QA_TENANT_STORAGE_STATE="../rentchain-api/.smoke-storage-state/tenant-storage-state.json"

# Option 2: Or set via command line
QA_ADMIN_STORAGE_STATE="../rentchain-api/.smoke-storage-state/admin-storage-state.json" npm run test:e2e -- admin-smoke.spec.ts
```

## Running Smoke Tests

### Backend API Smoke Tests

```bash
cd rentchain-api
npm run test:smoke        # Run all backend smoke tests
npm run test:smoke -- --reporter=verbose
```

### Frontend Playwright Smoke Tests

```bash
cd rentchain-frontend
npm run test:e2e          # Run all Playwright tests
npm run test:e2e -- admin-smoke.spec.ts  # Run specific role tests
npm run test:e2e -- --project=frontend-chromium   # Run specific browser
```

### Run Role Suites In Isolation

```bash
cd rentchain-api
npm run storage-state:export

cd ../rentchain-frontend
export QA_ADMIN_STORAGE_STATE="../rentchain-api/.smoke-storage-state/admin-storage-state.json"
export QA_LANDLORD_STORAGE_STATE="../rentchain-api/.smoke-storage-state/landlord-storage-state.json"
export QA_TENANT_STORAGE_STATE="../rentchain-api/.smoke-storage-state/tenant-storage-state.json"

npm run test:e2e -- admin-smoke.spec.ts
npm run test:e2e -- landlord-smoke.spec.ts
npm run test:e2e -- tenant-smoke.spec.ts
```

Each role suite loads the exported storage state, derives the role context, installs deterministic smoke API responses, and verifies both allowed workflows and forbidden role boundaries.

#### With UI Mode

```bash
cd rentchain-frontend
npm run test:e2e -- --ui  # Interactive test runner
```

#### Debugging

```bash
cd rentchain-frontend
npm run test:e2e -- --debug  # Step through tests
npm run test:e2e -- --headed # See browser while tests run
```

## Storage State Structure

Storage state is generated for three roles:

### Admin Storage State

- **User**: `smoke-admin` (admin@rentchain.ai)
- **Access**: All admin routes and data
- **Usage**: Admin workflow validation

### Landlord Storage State

- **User**: `smoke-landlord-a-user` (landlord.a@example.test)
- **Access**: Landlord's properties, tenants, and maintenance requests
- **Usage**: Landlord workflow validation, role-based access control

### Tenant Storage State

- **User**: `smoke-tenant-a-user` (tenant.a@example.test)
- **Access**: Own lease, maintenance requests, and communications
- **Usage**: Tenant workflow validation, isolated data access

## Understanding the Fixture Format

The base fixture (`admin-storage-state.ts`) contains:

```typescript
{
  fixtureVersion: "authenticated-smoke-v1",
  generatedAt: "ISO 8601 timestamp",
  users: [ /* User definitions with roles */ ],
  properties: [ /* Property data */ ],
  units: [ /* Unit/suite data */ ],
  tenants: [ /* Tenant records */ ],
  leases: [ /* Lease agreements */ ],
  maintenanceRequests: [ /* Maintenance tickets */ ],
  auditEvents: [ /* System audit log */ ]
}
```

## Architecture

### Backend (`rentchain-api/tests/storage-state/`)

- **storage-state-generator.ts**: Core logic to convert fixtures to Playwright format
- **storage-state-presets.ts**: Pre-built storage state for each role
- **export-storage-state.ts**: CLI to export presets to JSON files

### Frontend (`rentchain-frontend/tests/playwright/`)

- **role-smoke-helpers.ts**: Utilities to read storage state from environment variables
- **admin-smoke.spec.ts**: Admin role workflow tests
- **landlord-smoke.spec.ts**: Landlord role workflow tests
- **tenant-smoke.spec.ts**: Tenant role workflow tests

## Role Coverage

### Admin

`admin-smoke.spec.ts` validates:

- Admin dashboard hydration through `/api/me`
- Admin properties, tenants, leases, audit, and support surfaces
- Platform-wide visibility across all landlords, properties, tenants, leases, and maintenance records
- Admin-only data access without landlord or tenant scoping

### Landlord

`landlord-smoke.spec.ts` validates:

- Landlord dashboard hydration through `/api/me`
- Owned property and unit visibility
- Tenant visibility limited to units owned by the landlord
- Maintenance visibility limited to owned units
- Blocking from admin APIs, admin routes, and tenant-only data

### Tenant

`tenant-smoke.spec.ts` validates:

- Tenant dashboard hydration through `/api/me`
- Lease visibility limited to the authenticated tenant
- Tenant maintenance list and creation path without submitting data
- Tenant communications surface
- Blocking from landlord APIs, property management APIs, and admin surfaces

## Key Points

### Storage State is Deterministic

Storage state generation is deterministic—same fixture always produces identical storage state. This ensures test reliability.

### Tokens are Mocked

Auth tokens in smoke tests are deterministic mocks (e.g., `smoke-admin-smoke-admin-token`). The backend's test utilities verify role and permissions without checking token validity.

### No Production Secrets

Storage state files contain no real secrets, credentials, or API keys. They are generated into `.smoke-storage-state/`, which is gitignored and must not be committed.

### Role Isolation

Each role has isolated data access:
- **Admin**: Sees all data across all landlords and tenants
- **Landlord**: Sees only their own properties and associated tenants
- **Tenant**: Sees only their own leases and communications

This is enforced both in fixtures and in test assertions.

### Findings Structure

Each Playwright test attaches a `classified-smoke-findings` JSON payload with:

- `testName`
- `role`
- `routeOrFeature`
- `result`
- `summary`
- `findings`

The finding payload classifies expected 401/403 responses separately from hard failures and avoids storing raw credentials or provider payloads.

## Troubleshooting

### Storage state file not found

**Error**: `Error: ENOENT: no such file or directory`

**Solution**: Run `npm run storage-state:export` first to generate the JSON files.

### Missing role environment variable

**Error**: `Missing storage state for admin`

**Solution**: Export the role-specific variable from the `rentchain-frontend` shell:

```bash
export QA_ADMIN_STORAGE_STATE="../rentchain-api/.smoke-storage-state/admin-storage-state.json"
```

### Tests pass locally but fail in CI

**Cause**: Environment variables not set in CI runner.

**Solution**: Export storage state as part of CI setup:
```bash
npm run storage-state:export
export QA_ADMIN_STORAGE_STATE="./.smoke-storage-state/admin-storage-state.json"
# ... etc
```

### Storage state not being used by tests

**Symptom**: Tests run as unauthenticated even though env vars are set.

**Debugging**: Check that `storageStateDetailsForRole()` can read the env vars:
```bash
echo $QA_ADMIN_STORAGE_STATE
# Should print the file path
```

### Wrong route boundary result

**Symptom**: A landlord or tenant can reach an admin API, or a tenant can reach landlord APIs.

**Solution**: Treat this as a role-boundary regression. The role suites assert `403 Forbidden` for unauthorized API paths and route blocking for admin-only UI paths.

### Tenant dashboard stays on login or recovery screen

**Cause**: `QA_TENANT_STORAGE_STATE` is missing or points to the wrong file.

**Solution**: Regenerate storage state, set `QA_TENANT_STORAGE_STATE`, and rerun `npm run test:e2e -- tenant-smoke.spec.ts`.

## Next Steps

- Run `npm run storage-state:export` to generate storage state files
- Run backend smoke tests: `npm run test:smoke`
- Run frontend Playwright tests: `npm run test:e2e`
- Keep `.smoke-storage-state/` out of version control
