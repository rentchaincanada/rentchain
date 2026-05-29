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
# Option 1: Source the exports (one-time per shell)
export QA_ADMIN_STORAGE_STATE="./.smoke-storage-state/admin-storage-state.json"
export QA_LANDLORD_STORAGE_STATE="./.smoke-storage-state/landlord-storage-state.json"
export QA_TENANT_STORAGE_STATE="./.smoke-storage-state/tenant-storage-state.json"

# Option 2: Or set via command line
QA_ADMIN_STORAGE_STATE="./.smoke-storage-state/admin-storage-state.json" npm run test:smoke
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
npm run test:e2e -- --project=chromium   # Run specific browser
```

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

## Key Points

### Storage State is Deterministic

Storage state generation is deterministic—same fixture always produces identical storage state. This ensures test reliability.

### Tokens are Mocked

Auth tokens in smoke tests are deterministic mocks (e.g., `smoke-admin-smoke-admin-token`). The backend's test utilities verify role and permissions without checking token validity.

### No Production Secrets

Storage state files contain no real secrets, credentials, or API keys. They are safe to commit to version control (stored in `.smoke-storage-state/` which is gitignored by default).

### Role Isolation

Each role has isolated data access:
- **Admin**: Sees all data across all landlords and tenants
- **Landlord**: Sees only their own properties and associated tenants
- **Tenant**: Sees only their own leases and communications

This is enforced both in fixtures and in test assertions.

## Troubleshooting

### Storage state file not found

**Error**: `Error: ENOENT: no such file or directory`

**Solution**: Run `npm run storage-state:export` first to generate the JSON files.

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

## Next Steps

- Run `npm run storage-state:export` to generate storage state files
- Run backend smoke tests: `npm run test:smoke`
- Run frontend Playwright tests: `npm run test:e2e`
- Commit `.smoke-storage-state/` to version control (it's gitignored)
