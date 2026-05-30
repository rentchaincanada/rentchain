# QA Mobile Layout Matrix

## Purpose

The mobile layout matrix validates authenticated tenant, landlord, and admin routes across constrained mobile viewports. It is focused on regression detection for horizontal overflow, oversized elements, fixed or sticky navigation overflow, and clipped interactive controls.

The matrix is read-only. It uses exported smoke storage state and deterministic API fixtures from `role-smoke-helpers.ts`; it does not mutate production data or call live production services.

## Coverage

Viewports:
- `iphone`: 390 x 844
- `android`: 412 x 915
- `narrow`: 360 x 780

Tenant routes:
- `/tenant`
- `/tenant/lease`
- `/tenant/ledger`
- `/tenant/documents`
- `/tenant/messages`
- `/tenant/profile`
- `/tenant/maintenance`

Landlord routes:
- `/dashboard`
- `/properties`
- `/applications`
- `/decision-inbox`
- `/operations`
- `/leases`
- `/payments`
- `/work-orders`
- `/messages`

Admin routes:
- `/admin`
- `/admin/properties`
- `/admin/tenants`
- `/admin/leases`
- `/admin/review-workspaces`
- `/admin/support/escalations`
- `/admin/security/incidents`
- `/support-operations`

The active matrix contains 24 authenticated routes across 3 viewports, for 72 tests in the default all-role run.

Role-filtered counts:
- `QA_ROLE=tenant`: 7 routes x 3 viewports = 21 tests
- `QA_ROLE=landlord`: 9 routes x 3 viewports = 27 tests
- `QA_ROLE=admin`: 8 routes x 3 viewports = 24 tests

## Authentication

Before running the matrix, export smoke storage-state fixtures from `rentchain-api`:

```bash
cd rentchain-api
npm run storage-state:export
```

Then run tests from `rentchain-frontend` with all role storage-state paths set:

```bash
export QA_ADMIN_STORAGE_STATE="../rentchain-api/.smoke-storage-state/admin-storage-state.json"
export QA_LANDLORD_STORAGE_STATE="../rentchain-api/.smoke-storage-state/landlord-storage-state.json"
export QA_TENANT_STORAGE_STATE="../rentchain-api/.smoke-storage-state/tenant-storage-state.json"
```

Each matrix test installs the role smoke harness for the route's declared role. This keeps tenant, landlord, and admin contexts separate while allowing the default run to cover all roles.

## Run Commands

Default all-role matrix:

```bash
npm run test:e2e -- mobile-layout-matrix.spec.ts
```

Tenant-only matrix:

```bash
QA_ROLE=tenant npm run test:e2e -- mobile-layout-matrix.spec.ts
```

Landlord-only matrix:

```bash
QA_ROLE=landlord npm run test:e2e -- mobile-layout-matrix.spec.ts
```

Admin-only matrix:

```bash
QA_ROLE=admin npm run test:e2e -- mobile-layout-matrix.spec.ts
```

## Metrics

Each test attaches `mobile-layout-metrics` JSON with:
- `viewportWidth`
- `viewportHeight`
- `horizontalOverflow`
- `oversizedElements`
- `fixedOverflowElements`
- `clippedInteractiveElements`

Passing criteria:
- `horizontalOverflow <= 2`
- `oversizedElements` is empty
- `fixedOverflowElements` is empty
- `clippedInteractiveElements` is empty

Element labels in metrics are limited to stable accessibility or test identifiers when available. The matrix avoids embedding page text in the metrics artifact to reduce the risk of exposing role-specific display data.

## Artifacts

Playwright generates:
- JSON report: `test-results/qa-results.json`
- HTML report: `playwright-report/`
- Per-test screenshots under the configured Playwright output directory
- `mobile-layout-metrics` attachments for each test
- `classified-smoke-findings` attachments for console and page errors

The screenshot naming pattern is:

```text
<viewport>-<role>-<route-label>.png
```

Example:

```text
iphone-tenant-tenant-workspace.png
```

## Baseline Interpretation

A clean baseline has:
- no horizontal overflow above the 2 px tolerance
- no oversized non-root visible elements
- no fixed or sticky elements outside the viewport
- no clipped buttons, links, inputs, selects, textareas, or role-button controls
- no page errors
- no unclassified console failures

Any route with non-empty metric arrays should be treated as a mobile layout remediation candidate for the QA report artifact pipeline.

## Current Baseline

The initial authenticated matrix run produced 69 passing tests out of 72. Tenant and landlord role-filtered runs passed completely. Admin coverage detected clipped interactive controls in the existing admin metadata filter rows:

- `/admin/support/escalations` at `iphone` and `android` viewports: `Approval expectation` select extends beyond the viewport.
- `/admin/security/incidents` at `android` viewport: one select control extends beyond the viewport.

These are existing route layout findings. The matrix keeps them as failures so the regression suite does not normalize clipped interactive controls.

## Governance Notes

- The matrix uses deterministic smoke fixtures only.
- No production credentials, provider payloads, or live production data are used.
- Tenant routes run under tenant context, landlord routes under landlord context, and admin routes under admin context.
- No storage state fixtures, role harnesses, runtime routes, source services, or Playwright configuration are modified by the matrix documentation.
