import { resolve } from "node:path";
import type { FullConfig, FullResult, Reporter, TestCase, TestResult, TestStep, Suite } from "@playwright/test/reporter";
import { generateQAReport, writeQAReportArtifact } from "./qa-reporter-helpers";

/**
 * QA Artifact Reporter for Playwright
 *
 * Custom Playwright reporter that aggregates test attachments and generates
 * structured QA report artifacts. Executes after all tests complete and
 * writes QA report JSON to test-results/qa-artifacts/qa-report.json.
 *
 * This reporter:
 * - Collects all JSON attachments from test results
 * - Aggregates smoke findings by role (tenant, landlord, admin)
 * - Aggregates mobile layout regression metrics by role
 * - Generates complete QA report with sanitized data (no credentials/tokens)
 * - Validates report structure before writing
 * - Completes in <5 seconds without blocking test output
 */
export default class QAArtifactReporter implements Reporter {
  private config: FullConfig | null = null;
  private rootSuite: Suite | null = null;
  private startTime: number = Date.now();

  /**
   * Called once before running tests
   */
  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.rootSuite = suite;
    this.startTime = Date.now();
    console.log("QA Artifact Reporter initialized");
  }

  /**
   * Called for each test case (no action needed for individual tests)
   */
  onTestBegin(test: TestCase) {
    // No action needed - we aggregate at the end
  }

  /**
   * Called for each test step (no action needed)
   */
  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    // No action needed - we aggregate at the end
  }

  /**
   * Called for each completed test step (no action needed)
   */
  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    // No action needed - we aggregate at the end
  }

  /**
   * Called for each completed test case (no action needed for individual tests)
   */
  onTestEnd(test: TestCase, result: TestResult) {
    // No action needed - we aggregate at the end
  }

  /**
   * Called once after running all tests
   * This is where we generate the QA report artifact
   */
  onEnd(result: FullResult) {
    const generationStart = Date.now();

    try {
      if (!this.config) {
        console.error("QA Artifact Reporter: Config not available, cannot generate report");
        return;
      }

      console.log("Generating QA report artifact...");

      // Generate QA report from test results
      const qaReport = generateQAReport(result, this.config, this.rootSuite);

      // Determine output directory
      const outputDir = (this.config as any).outputDir || process.env.QA_ARTIFACT_DIR || "test-results";

      // Write QA report artifact
      writeQAReportArtifact(qaReport, outputDir);

      const generationDuration = Date.now() - generationStart;
      const totalDuration = Date.now() - this.startTime;

      // Log summary
      console.log("QA Artifact Reporter Summary:");
      console.log(`  Tests: ${qaReport.execution.totalTests} total, ${qaReport.execution.passedTests} passed, ${qaReport.execution.failedTests} failed`);
      console.log(`  Attachments processed: ${qaReport.rawAttachmentCount}`);
      console.log(`  Smoke findings: T:${qaReport.smokeFindings.tenant.routesTested} L:${qaReport.smokeFindings.landlord.routesTested} A:${qaReport.smokeFindings.admin.routesTested} routes tested`);
      console.log(`  Layout combinations: T:${qaReport.mobileLayoutRegression.tenant.combinationsTested} L:${qaReport.mobileLayoutRegression.landlord.combinationsTested} A:${qaReport.mobileLayoutRegression.admin.combinationsTested} tested`);
      console.log(`  Artifact generation: ${generationDuration}ms (total test time: ${totalDuration}ms)`);

      // Performance check (should complete in <5 seconds)
      if (generationDuration > 5000) {
        console.warn(`QA Artifact Reporter: Generation took ${generationDuration}ms, exceeds 5s target`);
      }

    } catch (error) {
      console.error("QA Artifact Reporter failed:", error);
      // Don't throw - this would fail the entire test run
      // Just log the error and continue
    }
  }

  /**
   * Called on various reporter events (optional)
   */
  onError(error: TestError) {
    // Log but don't fail - artifact generation issues shouldn't break tests
    console.warn("QA Artifact Reporter: Test error occurred:", error.message);
  }
}

/**
 * Export type for error handling
 */
interface TestError {
  message?: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
  snippet?: string;
}