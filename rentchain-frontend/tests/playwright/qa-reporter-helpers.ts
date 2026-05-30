import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { TestResult, TestCase, FullResult, FullConfig, TestError, Suite } from "@playwright/test/reporter";

// Node.js globals - available at runtime
declare const Buffer: {
  from(str: string, encoding: string): Buffer;
};
interface Buffer {
  toString(encoding: string): string;
}
declare const process: {
  env: Record<string, string | undefined>;
  version: string;
};
import {
  type QAReport,
  type SmokeFindingsSummary,
  type MobileLayoutRegressionSummary,
  type MobileLayoutMetrics,
  createArtifactMetadata,
  createEmptySmokeFindingsSummary,
  validateQAReport,
  isSanitizedString,
} from "./qa-artifacts";
import type { ClassifiedSmokeFinding, SmokeFindingCategory } from "./smoke-findings";

/**
 * QA Reporter Helper Functions
 *
 * Aggregates test attachments into structured QA report artifacts.
 * Handles smoke findings, mobile layout metrics, and test execution context.
 */

// ============================================================================
// Attachment Processing
// ============================================================================

/**
 * Decoded attachment data from Playwright test results
 */
type DecodedAttachment = {
  name: string;
  contentType: string;
  data: unknown;
  testTitle: string;
  testFile: string;
  role?: "tenant" | "landlord" | "admin";
};

/**
 * Safely decodes a base64 attachment to JSON
 */
function decodeAttachment(attachment: { name: string; contentType: string; body?: string | Buffer }): unknown | null {
  try {
    if (!attachment.body) return null;

    let jsonString: string;
    if (typeof attachment.body === "string") {
      // Assume base64 encoded
      jsonString = Buffer.from(attachment.body, "base64").toString("utf8");
    } else {
      // Already a buffer
      jsonString = attachment.body.toString("utf8");
    }

    return JSON.parse(jsonString);
  } catch (error) {
    console.warn(`Failed to decode attachment ${attachment.name}:`, error);
    return null;
  }
}

/**
 * Extracts role from test title or annotations
 */
function extractRoleFromTest(testCase: TestCase, result: TestResult): "tenant" | "landlord" | "admin" | undefined {
  // Check test title patterns
  if (testCase.title.includes("tenant") || testCase.location?.file?.includes("tenant")) return "tenant";
  if (testCase.title.includes("landlord") || testCase.location?.file?.includes("landlord")) return "landlord";
  if (testCase.title.includes("admin") || testCase.location?.file?.includes("admin")) return "admin";

  // Check annotations for matrix-role
  const roleAnnotation = result.annotations?.find(ann => ann.type === "matrix-role");
  if (roleAnnotation?.description && ["tenant", "landlord", "admin"].includes(roleAnnotation.description)) {
    return roleAnnotation.description as "tenant" | "landlord" | "admin";
  }

  // Check for role smoke context in test files
  if (testCase.location?.file?.includes("smoke")) {
    if (testCase.location.file.includes("admin")) return "admin";
    if (testCase.location.file.includes("landlord")) return "landlord";
    if (testCase.location.file.includes("tenant")) return "tenant";
  }

  return undefined;
}

/**
 * Processes all test results and extracts attachments from suite
 */
function collectAttachments(suite: Suite | null): DecodedAttachment[] {
  const attachments: DecodedAttachment[] = [];

  const processTestCase = (testCase: TestCase) => {
    for (const result of testCase.results) {
      const role = extractRoleFromTest(testCase, result);

      for (const attachment of result.attachments || []) {
        if (attachment.contentType === "application/json") {
          const data = decodeAttachment(attachment);
          if (data) {
            attachments.push({
              name: attachment.name,
              contentType: attachment.contentType,
              data,
              testTitle: testCase.title,
              testFile: testCase.location?.file || "unknown",
              role,
            });
          }
        }
      }
    }
  };

  const processSuite = (currentSuite: Suite) => {
    const entries = currentSuite.entries();
    for (const entry of entries) {
      if (entry.type === "test") {
        processTestCase(entry as TestCase);
      } else if (entry.type === "describe") {
        processSuite(entry as Suite);
      }
    }
  };

  // Process the root suite if available
  if (suite) {
    processSuite(suite);
  }

  return attachments;
}

// ============================================================================
// Smoke Findings Aggregation
// ============================================================================

/**
 * Aggregates smoke findings by role
 */
function aggregateSmokeFindingsByRole(attachments: DecodedAttachment[]): Record<"tenant" | "landlord" | "admin", SmokeFindingsSummary> {
  const summaries = {
    tenant: createEmptySmokeFindingsSummary("tenant"),
    landlord: createEmptySmokeFindingsSummary("landlord"),
    admin: createEmptySmokeFindingsSummary("admin"),
  };

  const smokeAttachments = attachments.filter(att => att.name === "classified-smoke-findings");

  for (const attachment of smokeAttachments) {
    const data = attachment.data as any;
    if (!data || typeof data !== "object") continue;

    // Determine role from attachment data or test context
    const role = attachment.role || data.role || "admin"; // Default to admin if unclear
    if (!["tenant", "landlord", "admin"].includes(role)) continue;

    const summary = summaries[role as keyof typeof summaries];

    // Count this route as tested
    summary.routesTested += 1;

    // Process findings
    if (data.findings && Array.isArray(data.findings)) {
      for (const finding of data.findings) {
        if (finding.category && finding.severity) {
          // Update category totals
          if (summary.categoryTotals.hasOwnProperty(finding.category)) {
            summary.categoryTotals[finding.category as SmokeFindingCategory] += 1;
          }

          // Update severity totals
          if (summary.severityTotals.hasOwnProperty(finding.severity)) {
            summary.severityTotals[finding.severity as keyof typeof summary.severityTotals] += 1;
          }

          // Add to sample findings (limited to 10)
          if (summary.sampleFindings.length < 10 && finding.severity === "failure") {
            const routeOrFeature = data.routeOrFeature || data.label || attachment.testTitle;
            if (routeOrFeature && isSanitizedString(routeOrFeature) &&
                finding.message && isSanitizedString(finding.message)) {
              summary.sampleFindings.push({
                routeOrFeature,
                result: data.result || "fail",
                category: finding.category,
                severity: finding.severity,
                message: finding.message,
              });
            }
          }
        }
      }
    }

    // Update summary stats
    const hasCriticalFindings = data.findings?.some((f: any) =>
      f.severity === "failure" || f.category === "hard-failure"
    ) || false;

    if (hasCriticalFindings) {
      summary.routesWithBlockers += 1;
    }
  }

  return summaries;
}

// ============================================================================
// Mobile Layout Regression Aggregation
// ============================================================================

/**
 * Aggregates mobile layout metrics by role
 */
function aggregateMobileLayoutByRole(attachments: DecodedAttachment[]): Record<"tenant" | "landlord" | "admin", MobileLayoutRegressionSummary> {
  const summaries: Record<"tenant" | "landlord" | "admin", MobileLayoutRegressionSummary> = {
    tenant: {
      role: "tenant",
      combinationsTested: 0,
      combinationsWithFailures: 0,
      knownBlockers: [],
      aggregateMetrics: {
        totalHorizontalOverflow: 0,
        totalOversizedElements: 0,
        totalFixedOverflowElements: 0,
        totalClippedInteractiveElements: 0,
      },
      sampleFailures: [],
    },
    landlord: {
      role: "landlord",
      combinationsTested: 0,
      combinationsWithFailures: 0,
      knownBlockers: [],
      aggregateMetrics: {
        totalHorizontalOverflow: 0,
        totalOversizedElements: 0,
        totalFixedOverflowElements: 0,
        totalClippedInteractiveElements: 0,
      },
      sampleFailures: [],
    },
    admin: {
      role: "admin",
      combinationsTested: 0,
      combinationsWithFailures: 0,
      knownBlockers: [
        // Known pre-existing issues from Mission 6 baseline
        {
          route: "/admin/support/escalations",
          viewport: "iphone",
          issue: "Clipped selects at iPhone viewport",
          category: "pre-existing-admin-layout-defect" as const,
        },
        {
          route: "/admin/support/escalations",
          viewport: "android",
          issue: "Clipped selects at Android viewport",
          category: "pre-existing-admin-layout-defect" as const,
        },
        {
          route: "/admin/security/incidents",
          viewport: "android",
          issue: "Clipped select at Android viewport",
          category: "pre-existing-admin-layout-defect" as const,
        },
      ],
      aggregateMetrics: {
        totalHorizontalOverflow: 0,
        totalOversizedElements: 0,
        totalFixedOverflowElements: 0,
        totalClippedInteractiveElements: 0,
      },
      sampleFailures: [],
    },
  };

  const layoutAttachments = attachments.filter(att => att.name === "mobile-layout-metrics");

  for (const attachment of layoutAttachments) {
    const data = attachment.data as any;
    if (!data || typeof data !== "object") continue;

    // Determine role from attachment data or test context
    const role = attachment.role || "admin"; // Default to admin if unclear
    if (!["tenant", "landlord", "admin"].includes(role)) continue;

    const summary = summaries[role as keyof typeof summaries];
    summary.combinationsTested += 1;

    // Check if this combination has failures
    const hasFailures = (data.horizontalOverflow > 2) ||
      (data.oversizedElements && data.oversizedElements.length > 0) ||
      (data.fixedOverflowElements && data.fixedOverflowElements.length > 0) ||
      (data.clippedInteractiveElements && data.clippedInteractiveElements.length > 0);

    if (hasFailures) {
      summary.combinationsWithFailures += 1;

      // Add to sample failures (limited to 5)
      if (summary.sampleFailures.length < 5) {
        summary.sampleFailures.push({
          route: data.route || attachment.testTitle,
          viewport: data.viewport || "unknown",
          metrics: {
            viewport: data.viewport || "unknown",
            viewportWidth: data.viewportWidth || 0,
            viewportHeight: data.viewportHeight || 0,
            horizontalOverflow: data.horizontalOverflow || 0,
            oversizedElements: data.oversizedElements || [],
            fixedOverflowElements: data.fixedOverflowElements || [],
            clippedInteractiveElements: data.clippedInteractiveElements || [],
          },
        });
      }
    }

    // Aggregate metrics
    summary.aggregateMetrics.totalHorizontalOverflow += data.horizontalOverflow || 0;
    summary.aggregateMetrics.totalOversizedElements += (data.oversizedElements?.length || 0);
    summary.aggregateMetrics.totalFixedOverflowElements += (data.fixedOverflowElements?.length || 0);
    summary.aggregateMetrics.totalClippedInteractiveElements += (data.clippedInteractiveElements?.length || 0);
  }

  return summaries;
}

// ============================================================================
// QA Report Generation
// ============================================================================

/**
 * Generates complete QA report from test results
 */
export function generateQAReport(results: FullResult, config: FullConfig, suite: Suite | null): QAReport {
  const attachments = collectAttachments(suite);

  // Calculate test statistics from the suite
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  const calculateStats = (currentSuite: Suite) => {
    const entries = currentSuite.entries();
    for (const entry of entries) {
      if (entry.type === "test") {
        const testCase = entry as TestCase;
        totalTests += 1;
        const lastResult = testCase.results?.[testCase.results.length - 1];
        if (lastResult?.status === "passed") passedTests += 1;
        else if (lastResult?.status === "failed") failedTests += 1;
        else skippedTests += 1;
      } else if (entry.type === "describe") {
        calculateStats(entry as Suite);
      }
    }
  };

  if (suite) {
    calculateStats(suite);
  }

  // Get environment info
  const environment = process.env.CI ? "ci" : "local";
  const branch = process.env.BRANCH_NAME || process.env.GIT_BRANCH;
  const commit = process.env.COMMIT_SHA || process.env.GIT_COMMIT;

  // Generate report
  const report: QAReport = {
    metadata: createArtifactMetadata({
      branch: branch?.replace(/^origin\//, ""), // Clean branch name
      commit,
      environment,
      nodeVersion: process.version,
      playwrightVersion: config.version,
      totalDuration: Date.now() - (results.startTime?.getTime() || Date.now()),
    }),
    execution: {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      startTime: results.startTime?.toISOString(),
      workers: config.workers,
    },
    smokeFindings: aggregateSmokeFindingsByRole(attachments),
    mobileLayoutRegression: aggregateMobileLayoutByRole(attachments),
    rawAttachmentCount: attachments.length,
    schemaVersion: "1.0.0",
  };

  return report;
}

/**
 * Writes QA report to artifacts directory
 */
export function writeQAReportArtifact(report: QAReport, outputDir: string): void {
  const artifactsDir = resolve(outputDir, "qa-artifacts");
  const reportPath = resolve(artifactsDir, "qa-report.json");

  // Ensure directory exists
  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true });
  }

  // Validate report before writing
  if (!validateQAReport(report)) {
    console.warn("QA report failed validation, writing anyway for debugging");
  }

  // Write report with pretty formatting
  const reportJson = JSON.stringify(report, null, 2);
  writeFileSync(reportPath, reportJson, "utf8");

  console.log(`QA report artifact written to: ${reportPath}`);
  console.log(`Report summary: ${report.execution.totalTests} tests, ${report.execution.passedTests} passed, ${report.execution.failedTests} failed`);
}