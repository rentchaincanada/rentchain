# QA Artifacts Schema Documentation

This document describes the QA artifact generation system implemented for Phase 0A Mission 7, including JSON schema definitions, field explanations, sanitization rules, and the complete artifact lifecycle from test execution to dashboard indexing.

## Overview

The QA artifact system generates structured reports from Playwright test execution, enabling systematic review of smoke findings and mobile layout regression metrics without re-running tests. The system creates two primary artifacts:

1. **QA Report JSON** (`test-results/qa-artifacts/qa-report.json`) - Machine-readable structured data
2. **Review Pack** (`.handoff/qa-review-pack.md`) - Human-readable markdown summary

## QA Report JSON Schema

### Root Structure (`QAReport`)

```typescript
type QAReport = {
  metadata: ArtifactMetadata;           // Generation context and timing
  execution: TestExecutionContext;     // Test run statistics and timing
  smokeFindings: {                     // Role-specific smoke test findings
    tenant: SmokeFindingsSummary;
    landlord: SmokeFindingsSummary;
    admin: SmokeFindingsSummary;
  };
  mobileLayoutRegression: {            // Role-specific layout metrics
    tenant: MobileLayoutRegressionSummary;
    landlord: MobileLayoutRegressionSummary;
    admin: MobileLayoutRegressionSummary;
  };
  rawAttachmentCount: number;          // Total JSON attachments processed
  schemaVersion: "1.0.0";            // Schema compatibility version
};
```

### Metadata Fields (`ArtifactMetadata`)

```typescript
type ArtifactMetadata = {
  timestamp: string;          // ISO 8601 generation timestamp (required)
  branch?: string;           // Git branch name (sanitized, max 50 chars)
  commit?: string;           // Git commit hash (first 8 chars only)
  environment: "local" | "ci" | "unknown";  // Test environment type
  nodeVersion?: string;      // Node.js runtime version
  playwrightVersion?: string; // Playwright library version
  totalDuration?: number;    // Test execution time in milliseconds
};
```

**Field Requirements:**
- `timestamp` - Required, must be valid ISO 8601 format
- `environment` - Required, must be one of the three enum values
- `branch` - Optional, truncated to 50 characters for security
- `commit` - Optional, truncated to 8 characters (no full SHAs)
- Durations in milliseconds for consistency

### Test Execution Context (`TestExecutionContext`)

```typescript
type TestExecutionContext = {
  totalTests: number;        // Total number of test cases executed
  passedTests: number;       // Tests that completed successfully
  failedTests: number;       // Tests that failed with errors
  skippedTests: number;      // Tests that were skipped/ignored
  flakyTests?: number;       // Tests that passed on retry (optional)
  startTime?: string;        // Test run start time (ISO 8601)
  endTime?: string;          // Test run completion time (ISO 8601)
  workers?: number;          // Parallel worker count used
};
```

**Validation Rules:**
- All count fields must be non-negative integers
- `totalTests` should equal `passedTests + failedTests + skippedTests`
- Timestamps must be valid ISO 8601 format when present

### Smoke Findings Summary (`SmokeFindingsSummary`)

```typescript
type SmokeFindingsSummary = {
  role: "tenant" | "landlord" | "admin";    // Test role context
  routesTested: number;                     // Total routes tested for this role
  routesWithBlockers: number;               // Routes with critical issues
  categoryTotals: Record<SmokeFindingCategory, number>;  // Findings by category
  severityTotals: Record<SmokeFindingSeverity, number>;  // Findings by severity
  sampleFindings: Array<{                   // Critical findings sample (max 10)
    routeOrFeature: string;                 // Route/feature identifier (sanitized)
    result: "pass" | "fail" | "blocked";   // Test result status
    category: SmokeFindingCategory;         // Finding classification
    severity: SmokeFindingSeverity;         // Severity level
    message: string;                        // Finding description (sanitized)
  }>;
};
```

**Smoke Finding Categories:**
- `expected-auth-gated-response` - Normal auth-protected endpoints (info level)
- `expected-third-party-browser-noise` - Browser/extension interference (info level)
- `environment-browser-permission-issue` - Local environment setup (warning level)
- `possible-app-regression` - Potential application bugs (warning/failure level)
- `hard-failure` - Critical application failures (failure level)

**Severity Levels:**
- `info` - Expected findings that don't require action
- `warning` - Issues that may need investigation but don't block functionality
- `failure` - Critical issues that block functionality or indicate regressions

### Mobile Layout Regression Summary (`MobileLayoutRegressionSummary`)

```typescript
type MobileLayoutRegressionSummary = {
  role: "tenant" | "landlord" | "admin";
  combinationsTested: number;              // Route/viewport combinations tested
  combinationsWithFailures: number;       // Combinations with layout issues
  knownBlockers: Array<{                  // Pre-existing issues from baseline
    route: string;                        // Route path
    viewport: string;                     // Viewport name (iphone, android, narrow)
    issue: string;                        // Issue description
    category: "pre-existing-admin-layout-defect" | "new-regression";
  }>;
  aggregateMetrics: {                     // Summary across all viewports
    totalHorizontalOverflow: number;      // Total overflow in pixels
    totalOversizedElements: number;       // Count of elements exceeding viewport
    totalFixedOverflowElements: number;   // Count of fixed/sticky overflow elements
    totalClippedInteractiveElements: number; // Count of clipped interactive controls
  };
  sampleFailures: Array<{                 // Sample failing combinations (max 5)
    route: string;                        // Route path
    viewport: string;                     // Viewport name
    metrics: MobileLayoutMetrics;         // Detailed metrics for this combination
  }>;
};
```

**Layout Failure Thresholds:**
- Horizontal overflow > 2px indicates layout regression
- Any oversized elements (width > viewport) indicate layout issues
- Fixed/sticky elements overflowing viewport indicate positioning issues
- Clipped interactive elements indicate usability problems

### Mobile Layout Metrics (`MobileLayoutMetrics`)

```typescript
type MobileLayoutMetrics = {
  viewport: string;              // Viewport identifier
  viewportWidth: number;         // Viewport width in pixels
  viewportHeight: number;        // Viewport height in pixels
  horizontalOverflow: number;    // Horizontal overflow amount in pixels
  oversizedElements: Array<{     // Elements exceeding viewport width
    tag: string;                 // HTML tag name
    label: string;               // Element identifier (sanitized)
    width: number;               // Element width in pixels
    left: number;                // Left position in pixels
    right: number;               // Right position in pixels
  }>;
  fixedOverflowElements: Array<{ // Fixed/sticky elements overflowing viewport
    // Same structure as oversizedElements
  }>;
  clippedInteractiveElements: Array<{ // Interactive controls clipped outside viewport
    // Same structure as oversizedElements
  }>;
};
```

## Data Sanitization Rules

All QA artifacts must be sanitized to prevent exposure of sensitive information:

### Prohibited Content
- **Credentials**: API keys, tokens, passwords, secret keys
- **Personal Data**: Real email addresses (except approved test fixtures)
- **Internal IDs**: Raw Firestore document IDs, database primary keys
- **Infrastructure**: Internal hostnames, IP addresses, port numbers

### Allowed Test Fixtures
The following patterns are explicitly allowed as they represent test fixtures:
- `smoke-[role]-[identifier]` - Test fixture patterns
- `tenant.a@example.test`, `landlord.a@example.test` - Test email addresses
- `admin@rentchain.ai` - Approved admin test email

### Sanitization Validation
The `isSanitizedString(value: string)` function validates content:
- Rejects long alphanumeric strings (potential tokens)
- Rejects bearer token patterns
- Rejects UUID patterns (potential IDs)
- Rejects email addresses outside approved test patterns
- Allows approved test fixture patterns

## Artifact Lifecycle

### 1. Test Execution
1. Playwright tests run with role-specific harnesses
2. Tests attach JSON findings via `testInfo.attach()`
3. Smoke findings classified by category and severity
4. Mobile layout metrics collected for each viewport

### 2. Artifact Aggregation
1. QA Artifact Reporter runs after all tests complete
2. Collects all JSON attachments from test results
3. Groups findings by role (tenant, landlord, admin)
4. Validates and sanitizes all data
5. Generates `test-results/qa-artifacts/qa-report.json`

### 3. Review Pack Generation
1. `generate-qa-review-pack.ts` consumes QA report JSON
2. Generates human-readable markdown at `.handoff/qa-review-pack.md`
3. Includes executive summary, findings categorization, recommendations
4. Formats for structured review consumption

### 4. Dashboard Indexing (Mission 10)
1. QA Dashboard discovers artifacts in `test-results/qa-artifacts/`
2. Indexes historical reports for trend analysis
3. Provides web interface for artifact browsing

## Interpreting Findings

### Smoke Finding Categories

**Expected Findings (No Action Required):**
- `expected-auth-gated-response` - Protected endpoints correctly rejecting unauthenticated requests
- `expected-third-party-browser-noise` - Browser extensions, dev tools, or environment-specific console output

**Investigation Required:**
- `environment-browser-permission-issue` - Local setup issues that may affect CI/production
- `possible-app-regression` - Potential application bugs requiring developer review
- `hard-failure` - Critical failures blocking functionality

### Mobile Layout Metrics

**Healthy Layout Indicators:**
- Horizontal overflow ≤ 2px (acceptable browser measurement variance)
- Zero oversized elements
- Zero clipped interactive elements
- Fixed elements contained within viewport

**Regression Indicators:**
- Horizontal overflow > 2px
- Elements with width exceeding viewport
- Interactive elements (buttons, forms) clipped outside visible area
- Fixed/sticky headers causing content overlap

### Pre-Existing Admin Issues
The following admin layout defects are known from Mission 6 baseline and do not represent new regressions:
- `/admin/support/escalations` - Clipped selects at iPhone and Android viewports
- `/admin/security/incidents` - Clipped select at Android viewport

## Example Artifacts

### Well-Formed QA Report JSON

```json
{
  "metadata": {
    "timestamp": "2026-05-30T14:23:45.678Z",
    "branch": "feat/qa-report-artifact-review-pack-v1",
    "commit": "a1b2c3d4",
    "environment": "local",
    "nodeVersion": "v20.11.1",
    "playwrightVersion": "1.58.2",
    "totalDuration": 45230
  },
  "execution": {
    "totalTests": 24,
    "passedTests": 22,
    "failedTests": 2,
    "skippedTests": 0,
    "startTime": "2026-05-30T14:22:00.448Z",
    "workers": 4
  },
  "smokeFindings": {
    "tenant": {
      "role": "tenant",
      "routesTested": 8,
      "routesWithBlockers": 0,
      "categoryTotals": {
        "expected-auth-gated-response": 3,
        "expected-third-party-browser-noise": 1,
        "environment-browser-permission-issue": 0,
        "possible-app-regression": 0,
        "hard-failure": 0
      },
      "severityTotals": {
        "info": 4,
        "warning": 0,
        "failure": 0
      },
      "sampleFindings": []
    }
    // ... landlord and admin sections omitted for brevity
  },
  "mobileLayoutRegression": {
    // ... sections omitted for brevity
  },
  "rawAttachmentCount": 47,
  "schemaVersion": "1.0.0"
}
```

### Review Pack Markdown Structure

```markdown
# Phase 0A QA Review Pack

Generated from QA artifacts on May 30, 2026 at 2:23:45 PM PDT from branch `feat/qa-report-artifact-review-pack-v1`.

## Executive Summary

This report summarizes the comprehensive QA artifacts generated from Phase 0A mission testing...

## Phase 0A Test Coverage Overview

**Test Execution Context:**
- **Environment**: local (v20.11.1, Playwright 1.58.2)
- **Branch**: feat/qa-report-artifact-review-pack-v1
...

## Smoke Findings by Role

### Tenant Role Findings
**Summary**: 8 routes tested, 0 with blocking issues
...

## Mobile Layout Regression Findings
...

## Recommendations
...
```

## Usage Instructions

### Generating Artifacts

```bash
# Generate QA artifacts during test run
npm run test:e2e:with-artifacts

# Generate review pack from existing QA report
npm run generate-qa-review-pack

# Run tests only (artifacts generated automatically)
npm run test:e2e
```

### Artifact Locations

- **QA Report**: `test-results/qa-artifacts/qa-report.json`
- **Review Pack**: `.handoff/qa-review-pack.md`
- **Test Results**: `test-results/` (Playwright standard outputs)

## Troubleshooting

### Common Generation Failures

**Missing QA Report Error:**
```
QA report not found at: test-results/qa-artifacts/qa-report.json
Run tests with QA artifact generation first: npm run test:e2e
```
**Solution:** Ensure tests have been run and QA artifact reporter is configured in `playwright.config.ts`

**Validation Errors:**
```
QA report failed validation, writing anyway for debugging
```
**Solution:** Check that all required fields are present and data types match schema. Review sanitization warnings for potentially sensitive content.

**Missing Attachments:**
```
No attachments found for role: tenant
```
**Solution:** Verify test files are using `testInfo.attach()` with `contentType: "application/json"` and proper attachment names (`classified-smoke-findings`, `mobile-layout-metrics`).

**Generation Timeout:**
```
QA Artifact Reporter: Generation took 6543ms, exceeds 5s target
```
**Solution:** Review attachment processing logic for performance issues. Consider reducing sample finding limits or optimizing JSON parsing.

### Debugging Tips

1. **Check Attachment Names**: Ensure tests use exact names `classified-smoke-findings` and `mobile-layout-metrics`
2. **Verify JSON Structure**: Attachments must be valid JSON with expected field structure
3. **Role Detection**: Ensure tests include role annotations or file path patterns for proper categorization
4. **Sanitization Issues**: Review logs for sanitization warnings about potentially sensitive content
5. **Schema Validation**: Use TypeScript compilation to catch schema mismatches during development

### File Permissions

Ensure the following directories are writable:
- `test-results/` - Playwright test outputs
- `test-results/qa-artifacts/` - QA report artifacts (created automatically)
- `.handoff/` - Review pack output (created automatically)

## Schema Versioning

Current schema version: `1.0.0`

Schema changes that require version bumps:
- **Major** (2.0.0): Breaking changes to required fields or data types
- **Minor** (1.1.0): New optional fields or enum values
- **Patch** (1.0.1): Bug fixes or clarifications without schema changes

Backward compatibility is maintained within major versions. Mission 10 (QA Dashboard) will need to handle multiple schema versions for historical artifact indexing.
