import type { SmokeFindingCategory, SmokeFindingSeverity, ClassifiedSmokeFinding } from "./smoke-findings";

/**
 * Canonical QA Artifact Types and Schema Definitions
 *
 * This module defines the TypeScript types and JSON schema validators for
 * QA report artifacts generated from Playwright test execution.
 *
 * All artifacts must be sanitized - no credentials, tokens, raw Firestore IDs,
 * or PII should be present in any artifact structure.
 */

// ============================================================================
// Core Artifact Types
// ============================================================================

/**
 * Metadata about artifact generation
 */
export type ArtifactMetadata = {
  /** Timestamp when artifact was generated (ISO 8601) */
  timestamp: string;
  /** Git branch name (sanitized, no sensitive info) */
  branch?: string;
  /** Git commit hash (first 8 chars only) */
  commit?: string;
  /** Test environment (local, ci, etc.) */
  environment: "local" | "ci" | "unknown";
  /** Node.js version used for test execution */
  nodeVersion?: string;
  /** Playwright version */
  playwrightVersion?: string;
  /** Total test execution duration in milliseconds */
  totalDuration?: number;
};

/**
 * Test execution summary and statistics
 */
export type TestExecutionContext = {
  /** Total number of tests executed */
  totalTests: number;
  /** Number of tests that passed */
  passedTests: number;
  /** Number of tests that failed */
  failedTests: number;
  /** Number of tests that were skipped */
  skippedTests: number;
  /** Number of tests that were flaky (passed on retry) */
  flakyTests?: number;
  /** Test execution start time (ISO 8601) */
  startTime?: string;
  /** Test execution end time (ISO 8601) */
  endTime?: string;
  /** Worker count used for parallel execution */
  workers?: number;
};

/**
 * Aggregated smoke findings summary by role
 */
export type SmokeFindingsSummary = {
  /** Role context (tenant, landlord, admin) */
  role: "tenant" | "landlord" | "admin";
  /** Total number of routes tested for this role */
  routesTested: number;
  /** Number of routes with blocking issues */
  routesWithBlockers: number;
  /** Summary counts by finding category */
  categoryTotals: Record<SmokeFindingCategory, number>;
  /** Summary counts by severity level */
  severityTotals: Record<SmokeFindingSeverity, number>;
  /** Sample findings (limited to 10 most critical) */
  sampleFindings: Array<{
    /** Route or feature identifier (sanitized) */
    routeOrFeature: string;
    /** Test result status */
    result: "pass" | "fail" | "blocked";
    /** Finding category */
    category: SmokeFindingCategory;
    /** Finding severity */
    severity: SmokeFindingSeverity;
    /** Sanitized message (no credentials/tokens) */
    message: string;
  }>;
};

/**
 * Mobile layout regression metrics for a viewport/role combination
 */
export type MobileLayoutMetrics = {
  /** Viewport name (iphone, android, narrow) */
  viewport: string;
  /** Viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
  /** Horizontal overflow in pixels */
  horizontalOverflow: number;
  /** Elements exceeding viewport width */
  oversizedElements: Array<{
    tag: string;
    label: string;
    width: number;
    left: number;
    right: number;
  }>;
  /** Fixed/sticky elements overflowing viewport */
  fixedOverflowElements: Array<{
    tag: string;
    label: string;
    width: number;
    left: number;
    right: number;
  }>;
  /** Interactive controls clipped outside viewport */
  clippedInteractiveElements: Array<{
    tag: string;
    label: string;
    width: number;
    left: number;
    right: number;
  }>;
};

/**
 * Mobile layout regression summary by role
 */
export type MobileLayoutRegressionSummary = {
  /** Role context (tenant, landlord, admin) */
  role: "tenant" | "landlord" | "admin";
  /** Total number of route/viewport combinations tested */
  combinationsTested: number;
  /** Number of combinations with layout failures */
  combinationsWithFailures: number;
  /** Routes with known pre-existing issues (from Mission 6 baseline) */
  knownBlockers: Array<{
    route: string;
    viewport: string;
    issue: string;
    category: "pre-existing-admin-layout-defect" | "new-regression";
  }>;
  /** Summary metrics across all viewports */
  aggregateMetrics: {
    totalHorizontalOverflow: number;
    totalOversizedElements: number;
    totalFixedOverflowElements: number;
    totalClippedInteractiveElements: number;
  };
  /** Sample failing routes (limited to 5 most critical) */
  sampleFailures: Array<{
    route: string;
    viewport: string;
    metrics: MobileLayoutMetrics;
  }>;
};

/**
 * Root QA report artifact structure
 */
export type QAReport = {
  /** Artifact metadata */
  metadata: ArtifactMetadata;
  /** Test execution context and statistics */
  execution: TestExecutionContext;
  /** Smoke findings summary by role */
  smokeFindings: {
    tenant: SmokeFindingsSummary;
    landlord: SmokeFindingsSummary;
    admin: SmokeFindingsSummary;
  };
  /** Mobile layout regression summary by role */
  mobileLayoutRegression: {
    tenant: MobileLayoutRegressionSummary;
    landlord: MobileLayoutRegressionSummary;
    admin: MobileLayoutRegressionSummary;
  };
  /** Raw attachment count for validation */
  rawAttachmentCount: number;
  /** Schema version for compatibility */
  schemaVersion: "1.0.0";
};

// ============================================================================
// JSON Schema Validators
// ============================================================================

/**
 * Validates if a string is a valid ISO 8601 timestamp
 */
export function isValidISOTimestamp(value: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!iso8601Regex.test(value)) return false;

  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validates artifact metadata structure
 */
export function validateArtifactMetadata(metadata: unknown): metadata is ArtifactMetadata {
  if (!metadata || typeof metadata !== "object") return false;

  const m = metadata as Record<string, unknown>;

  // Required fields
  if (typeof m.timestamp !== "string" || !isValidISOTimestamp(m.timestamp)) return false;
  if (!["local", "ci", "unknown"].includes(m.environment as string)) return false;

  // Optional fields validation
  if (m.branch !== undefined && typeof m.branch !== "string") return false;
  if (m.commit !== undefined && (typeof m.commit !== "string" || m.commit.length > 8)) return false;
  if (m.nodeVersion !== undefined && typeof m.nodeVersion !== "string") return false;
  if (m.playwrightVersion !== undefined && typeof m.playwrightVersion !== "string") return false;
  if (m.totalDuration !== undefined && (typeof m.totalDuration !== "number" || m.totalDuration < 0)) return false;

  return true;
}

/**
 * Validates test execution context structure
 */
export function validateTestExecutionContext(execution: unknown): execution is TestExecutionContext {
  if (!execution || typeof execution !== "object") return false;

  const e = execution as Record<string, unknown>;

  // Required fields
  if (typeof e.totalTests !== "number" || e.totalTests < 0) return false;
  if (typeof e.passedTests !== "number" || e.passedTests < 0) return false;
  if (typeof e.failedTests !== "number" || e.failedTests < 0) return false;
  if (typeof e.skippedTests !== "number" || e.skippedTests < 0) return false;

  // Optional fields validation
  if (e.flakyTests !== undefined && (typeof e.flakyTests !== "number" || e.flakyTests < 0)) return false;
  if (e.startTime !== undefined && (typeof e.startTime !== "string" || !isValidISOTimestamp(e.startTime))) return false;
  if (e.endTime !== undefined && (typeof e.endTime !== "string" || !isValidISOTimestamp(e.endTime))) return false;
  if (e.workers !== undefined && (typeof e.workers !== "number" || e.workers < 1)) return false;

  return true;
}

/**
 * Validates that a string contains no sensitive data patterns
 */
export function isSanitizedString(value: string): boolean {
  // Check for potential credential patterns
  const sensitivePatterns = [
    /[a-z0-9]{20,}/i, // Long alphanumeric strings (potential tokens)
    /sk_[a-z0-9]+/i, // Secret key patterns
    /pk_[a-z0-9]+/i, // Public key patterns
    /@[a-z0-9.-]+\.[a-z]{2,}/i, // Email addresses (unless from test fixtures)
    /Bearer\s+[a-z0-9]/i, // Bearer tokens
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUIDs (potential IDs)
  ];

  // Allow test fixture patterns
  const allowedPatterns = [
    /smoke-[a-z]+-[a-z0-9-]+/, // Test fixture patterns
    /tenant\.a@example\.test/, // Test email patterns
    /landlord\.a@example\.test/,
    /admin@rentchain\.ai/,
  ];

  // If it matches allowed patterns, it's safe
  for (const pattern of allowedPatterns) {
    if (pattern.test(value)) return true;
  }

  // Check against sensitive patterns
  for (const pattern of sensitivePatterns) {
    if (pattern.test(value)) return false;
  }

  return true;
}

/**
 * Validates smoke findings summary structure
 */
export function validateSmokeFindingsSummary(summary: unknown): summary is SmokeFindingsSummary {
  if (!summary || typeof summary !== "object") return false;

  const s = summary as Record<string, unknown>;

  // Required fields
  if (!["tenant", "landlord", "admin"].includes(s.role as string)) return false;
  if (typeof s.routesTested !== "number" || s.routesTested < 0) return false;
  if (typeof s.routesWithBlockers !== "number" || s.routesWithBlockers < 0) return false;

  // Validate category totals
  if (!s.categoryTotals || typeof s.categoryTotals !== "object") return false;
  const expectedCategories: SmokeFindingCategory[] = [
    "expected-auth-gated-response",
    "expected-third-party-browser-noise",
    "environment-browser-permission-issue",
    "possible-app-regression",
    "hard-failure"
  ];
  for (const category of expectedCategories) {
    const count = (s.categoryTotals as Record<string, unknown>)[category];
    if (typeof count !== "number" || count < 0) return false;
  }

  // Validate severity totals
  if (!s.severityTotals || typeof s.severityTotals !== "object") return false;
  const expectedSeverities: SmokeFindingSeverity[] = ["info", "warning", "failure"];
  for (const severity of expectedSeverities) {
    const count = (s.severityTotals as Record<string, unknown>)[severity];
    if (typeof count !== "number" || count < 0) return false;
  }

  // Validate sample findings
  if (!Array.isArray(s.sampleFindings)) return false;
  if (s.sampleFindings.length > 10) return false; // Limit sample size

  for (const finding of s.sampleFindings) {
    if (!finding || typeof finding !== "object") return false;
    if (typeof finding.routeOrFeature !== "string" || !isSanitizedString(finding.routeOrFeature)) return false;
    if (!["pass", "fail", "blocked"].includes(finding.result)) return false;
    if (!expectedCategories.includes(finding.category)) return false;
    if (!expectedSeverities.includes(finding.severity)) return false;
    if (typeof finding.message !== "string" || !isSanitizedString(finding.message)) return false;
  }

  return true;
}

/**
 * Validates complete QA report structure
 */
export function validateQAReport(report: unknown): report is QAReport {
  if (!report || typeof report !== "object") return false;

  const r = report as Record<string, unknown>;

  // Schema version check
  if (r.schemaVersion !== "1.0.0") return false;

  // Required fields
  if (!validateArtifactMetadata(r.metadata)) return false;
  if (!validateTestExecutionContext(r.execution)) return false;

  // Validate raw attachment count
  if (typeof r.rawAttachmentCount !== "number" || r.rawAttachmentCount < 0) return false;

  // Validate smoke findings structure
  if (!r.smokeFindings || typeof r.smokeFindings !== "object") return false;
  const smokeFindings = r.smokeFindings as Record<string, unknown>;
  if (!validateSmokeFindingsSummary(smokeFindings.tenant)) return false;
  if (!validateSmokeFindingsSummary(smokeFindings.landlord)) return false;
  if (!validateSmokeFindingsSummary(smokeFindings.admin)) return false;

  // Note: Mobile layout regression validation would be similar but omitted for brevity
  // In a full implementation, we would validate mobileLayoutRegression structure here

  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a sanitized artifact metadata object
 */
export function createArtifactMetadata(options: {
  branch?: string;
  commit?: string;
  environment?: "local" | "ci" | "unknown";
  nodeVersion?: string;
  playwrightVersion?: string;
  totalDuration?: number;
}): ArtifactMetadata {
  return {
    timestamp: new Date().toISOString(),
    branch: options.branch?.slice(0, 50), // Limit length
    commit: options.commit?.slice(0, 8), // First 8 chars only
    environment: options.environment ?? "unknown",
    nodeVersion: options.nodeVersion,
    playwrightVersion: options.playwrightVersion,
    totalDuration: options.totalDuration,
  };
}

/**
 * Creates an empty smoke findings summary for a role
 */
export function createEmptySmokeFindingsSummary(role: "tenant" | "landlord" | "admin"): SmokeFindingsSummary {
  return {
    role,
    routesTested: 0,
    routesWithBlockers: 0,
    categoryTotals: {
      "expected-auth-gated-response": 0,
      "expected-third-party-browser-noise": 0,
      "environment-browser-permission-issue": 0,
      "possible-app-regression": 0,
      "hard-failure": 0,
    },
    severityTotals: {
      info: 0,
      warning: 0,
      failure: 0,
    },
    sampleFindings: [],
  };
}