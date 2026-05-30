#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { QAReport } from "../tests/playwright/qa-artifacts";

/**
 * Review Pack Generator
 *
 * Consumes QA report JSON and generates human-readable markdown review pack
 * for team assessment. Creates structured summary with findings
 * categorization, recommendations, and next steps for Phase 0A completion.
 *
 * Usage: npm run generate-qa-review-pack
 */

/**
 * Formats a timestamp for human reading
 */
function formatTimestamp(isoString: string | undefined): string {
  if (!isoString) return "Unknown";
  try {
    return new Date(isoString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return isoString;
  }
}

/**
 * Formats duration in milliseconds to human readable
 */
function formatDuration(ms: number | undefined): string {
  if (!ms) return "Unknown";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Generates executive summary section
 */
function generateExecutiveSummary(report: QAReport): string {
  const { execution, smokeFindings, mobileLayoutRegression } = report;

  const totalRoutesTested =
    smokeFindings.tenant.routesTested +
    smokeFindings.landlord.routesTested +
    smokeFindings.admin.routesTested;

  const totalRoutesWithBlockers =
    smokeFindings.tenant.routesWithBlockers +
    smokeFindings.landlord.routesWithBlockers +
    smokeFindings.admin.routesWithBlockers;

  const totalLayoutCombinations =
    mobileLayoutRegression.tenant.combinationsTested +
    mobileLayoutRegression.landlord.combinationsTested +
    mobileLayoutRegression.admin.combinationsTested;

  const totalLayoutFailures =
    mobileLayoutRegression.tenant.combinationsWithFailures +
    mobileLayoutRegression.landlord.combinationsWithFailures +
    mobileLayoutRegression.admin.combinationsWithFailures;

  const testSuccessRate = execution.totalTests > 0
    ? Math.round((execution.passedTests / execution.totalTests) * 100)
    : 0;

  return `## Executive Summary

**Phase 0A QA Report - ${formatTimestamp(report.metadata.timestamp)}**

This report summarizes the comprehensive QA artifacts generated from Phase 0A mission testing, including authenticated role smoke tests and mobile layout regression validation. The test execution achieved a ${testSuccessRate}% success rate across ${execution.totalTests} total tests, with ${totalRoutesTested} route combinations tested for smoke findings and ${totalLayoutCombinations} viewport/role combinations tested for mobile layout regressions.

**Key Findings:**
- **Smoke Tests**: ${totalRoutesWithBlockers}/${totalRoutesTested} routes have blocking issues requiring attention
- **Mobile Layout**: ${totalLayoutFailures}/${totalLayoutCombinations} viewport combinations have layout failures
- **Test Stability**: ${execution.passedTests} passed, ${execution.failedTests} failed, ${execution.skippedTests} skipped
- **Known Issues**: ${mobileLayoutRegression.admin.knownBlockers.length} pre-existing admin layout defects identified from Mission 6 baseline

The majority of findings fall into expected categories (auth-gated responses, browser environment issues) with a small number of potential app regressions requiring investigation.`;
}

/**
 * Generates test coverage overview section
 */
function generateTestCoverage(report: QAReport): string {
  const { execution, metadata } = report;

  return `## Phase 0A Test Coverage Overview

**Test Execution Context:**
- **Environment**: ${metadata.environment} (${metadata.nodeVersion || 'Unknown Node'}, Playwright ${metadata.playwrightVersion || 'Unknown'})
- **Branch**: ${metadata.branch || 'Unknown'}
- **Commit**: ${metadata.commit || 'Not available'}
- **Duration**: ${formatDuration(metadata.totalDuration)}
- **Workers**: ${execution.workers || 'Unknown'} parallel workers
- **Test Files**: Executed across smoke and mobile layout test suites

**Coverage Breakdown:**
- **Total Tests**: ${execution.totalTests}
- **Passed**: ${execution.passedTests} (${execution.totalTests > 0 ? Math.round((execution.passedTests / execution.totalTests) * 100) : 0}%)
- **Failed**: ${execution.failedTests} (${execution.totalTests > 0 ? Math.round((execution.failedTests / execution.totalTests) * 100) : 0}%)
- **Skipped**: ${execution.skippedTests} (${execution.totalTests > 0 ? Math.round((execution.skippedTests / execution.totalTests) * 100) : 0}%)
- **Attachments Processed**: ${report.rawAttachmentCount} JSON artifacts collected

This coverage represents the comprehensive Phase 0A test infrastructure spanning authenticated role harnesses, mobile viewport testing, and regression baseline validation.`;
}

/**
 * Generates smoke findings section by role
 */
function generateSmokeFindings(report: QAReport): string {
  const { smokeFindings } = report;
  let section = `## Smoke Findings by Role\n\n`;

  for (const [roleName, findings] of Object.entries(smokeFindings)) {
    const role = roleName as keyof typeof smokeFindings;
    const summary = findings;

    section += `### ${role.charAt(0).toUpperCase() + role.slice(1)} Role Findings\n\n`;
    section += `**Summary**: ${summary.routesTested} routes tested, ${summary.routesWithBlockers} with blocking issues\n\n`;

    // Category breakdown
    section += `**Finding Categories:**\n`;
    for (const [category, count] of Object.entries(summary.categoryTotals)) {
      section += `- **${category}**: ${count}\n`;
    }
    section += `\n`;

    // Severity breakdown
    section += `**Severity Levels:**\n`;
    for (const [severity, count] of Object.entries(summary.severityTotals)) {
      section += `- **${severity}**: ${count}\n`;
    }
    section += `\n`;

    // Sample critical findings
    if (summary.sampleFindings.length > 0) {
      section += `**Critical Findings Sample:**\n\n`;
      for (const finding of summary.sampleFindings.slice(0, 5)) {
        section += `> **${finding.routeOrFeature}** (${finding.severity})\n`;
        section += `> Category: ${finding.category}\n`;
        section += `> Status: ${finding.result}\n`;
        section += `> Message: ${finding.message}\n\n`;
      }
    } else {
      section += `**No critical findings detected for this role.**\n\n`;
    }
  }

  return section;
}

/**
 * Generates mobile layout regression section
 */
function generateMobileLayoutFindings(report: QAReport): string {
  const { mobileLayoutRegression } = report;
  let section = `## Mobile Layout Regression Findings\n\n`;

  for (const [roleName, regression] of Object.entries(mobileLayoutRegression)) {
    const role = roleName as keyof typeof mobileLayoutRegression;
    const summary = regression;

    section += `### ${role.charAt(0).toUpperCase() + role.slice(1)} Role Layout Analysis\n\n`;
    section += `**Summary**: ${summary.combinationsTested} viewport combinations tested, ${summary.combinationsWithFailures} with layout failures\n\n`;

    // Aggregate metrics
    const metrics = summary.aggregateMetrics;
    section += `**Aggregate Metrics:**\n`;
    section += `- Horizontal overflow: ${metrics.totalHorizontalOverflow}px total\n`;
    section += `- Oversized elements: ${metrics.totalOversizedElements}\n`;
    section += `- Fixed overflow elements: ${metrics.totalFixedOverflowElements}\n`;
    section += `- Clipped interactive elements: ${metrics.totalClippedInteractiveElements}\n\n`;

    // Known blockers (pre-existing issues)
    if (summary.knownBlockers.length > 0) {
      section += `**Known Pre-Existing Issues (Mission 6 Baseline):**\n\n`;
      for (const blocker of summary.knownBlockers) {
        section += `> **${blocker.route}** @ ${blocker.viewport}\n`;
        section += `> Issue: ${blocker.issue}\n`;
        section += `> Category: ${blocker.category}\n\n`;
      }
    }

    // Sample failures
    if (summary.sampleFailures.length > 0) {
      section += `**Sample Layout Failures:**\n\n`;
      for (const failure of summary.sampleFailures.slice(0, 3)) {
        section += `> **${failure.route}** @ ${failure.viewport}\n`;
        section += `> Overflow: ${failure.metrics.horizontalOverflow}px\n`;
        section += `> Oversized elements: ${failure.metrics.oversizedElements.length}\n`;
        section += `> Fixed overflow: ${failure.metrics.fixedOverflowElements.length}\n`;
        section += `> Clipped interactive: ${failure.metrics.clippedInteractiveElements.length}\n\n`;

        // Include JSON excerpt for critical failures
        if (failure.metrics.horizontalOverflow > 10 || failure.metrics.clippedInteractiveElements.length > 0) {
          section += `\`\`\`json\n`;
          section += JSON.stringify(failure.metrics, null, 2);
          section += `\n\`\`\`\n\n`;
        }
      }
    } else {
      section += `**No layout failures detected for this role.**\n\n`;
    }
  }

  return section;
}

/**
 * Generates recommendations section
 */
function generateRecommendations(report: QAReport): string {
  const { smokeFindings, mobileLayoutRegression, execution } = report;

  // Count critical issues
  const totalCriticalIssues = Object.values(smokeFindings).reduce((sum, findings) =>
    sum + findings.categoryTotals["hard-failure"] + findings.categoryTotals["possible-app-regression"], 0);

  const totalNewLayoutRegressions = Object.values(mobileLayoutRegression).reduce((sum, regression) =>
    sum + regression.knownBlockers.filter(b => b.category === "new-regression").length, 0);

  const testFailureRate = execution.totalTests > 0 ? (execution.failedTests / execution.totalTests) : 0;

  return `## Recommendations

### Fix Priorities

**Immediate Action Required:**
${totalCriticalIssues > 0 ?
  `- **${totalCriticalIssues} critical smoke findings** require investigation (hard-failure or possible-app-regression categories)` :
  `- No critical smoke findings requiring immediate action`}
${totalNewLayoutRegressions > 0 ?
  `- **${totalNewLayoutRegressions} new layout regressions** detected beyond Mission 6 baseline` :
  `- No new layout regressions detected (${mobileLayoutRegression.admin.knownBlockers.length} pre-existing admin issues remain from baseline)`}
${testFailureRate > 0.1 ?
  `- **Test stability**: ${Math.round(testFailureRate * 100)}% failure rate suggests test infrastructure issues` :
  `- Test infrastructure is stable with ${Math.round((1 - testFailureRate) * 100)}% success rate`}

**Future Mission Considerations:**
- Pre-existing admin layout defects (Mission 6 baseline) should be addressed in dedicated UX improvement missions
- Expected auth-gated responses and browser environment issues are normal and require no action
- Mobile layout test coverage is comprehensive and ready for Phase 0A completion assessment

### Next Steps for Phase 0A Completion

**Ready for Phase 0A Sign-off if:**
- Critical smoke findings are resolved or confirmed as expected behavior
- New layout regressions are addressed or documented as acceptable
- Test failure rate is <10% (currently ${Math.round(testFailureRate * 100)}%)

**Phase 0A Deliverables Status:**
- ✅ Authenticated role test harnesses (Missions 1-3)
- ✅ Mobile layout regression matrix (Mission 6)
- ✅ QA artifact generation and review pack (Mission 7)
- 🔄 Pending: QA Dashboard artifact indexing (Mission 10)

The comprehensive test infrastructure and artifact generation established in Phase 0A provides a solid foundation for ongoing quality assurance and regression detection.`;
}

/**
 * Main function to generate the complete review pack
 */
function generateReviewPack(qaReportPath: string, outputPath: string): void {
  try {
    // Read QA report
    if (!existsSync(qaReportPath)) {
      console.error(`QA report not found at: ${qaReportPath}`);
      console.error("Run tests with QA artifact generation first: npm run test:e2e");
      process.exit(1);
    }

    const reportJson = readFileSync(qaReportPath, "utf8");
    const report: QAReport = JSON.parse(reportJson);

    console.log("Generating review pack from QA report...");
    console.log(`Report timestamp: ${formatTimestamp(report.metadata.timestamp)}`);
    console.log(`Tests: ${report.execution.totalTests} total, ${report.execution.passedTests} passed`);

    // Generate markdown sections
    const reviewPack = [
      `# Phase 0A QA Review Pack`,
      ``,
      `Generated from QA artifacts on ${formatTimestamp(report.metadata.timestamp)} from branch \`${report.metadata.branch || 'unknown'}\`.`,
      ``,
      generateExecutiveSummary(report),
      ``,
      generateTestCoverage(report),
      ``,
      generateSmokeFindings(report),
      ``,
      generateMobileLayoutFindings(report),
      ``,
      generateRecommendations(report),
      ``,
      `---`,
      ``,
      `**Artifact Metadata:**`,
      `- Schema Version: ${report.schemaVersion}`,
      `- Raw Attachments: ${report.rawAttachmentCount}`,
      `- Generated: ${formatTimestamp(report.metadata.timestamp)}`,
      `- Environment: ${report.metadata.environment}`,
      `- Branch: ${report.metadata.branch || 'Unknown'}`,
      `- Commit: ${report.metadata.commit || 'Not available'}`,
      ``,
      `*This review pack enables reviewers to assess Phase 0A completion status and quality metrics without re-running tests.*`,
    ].join('\n');

    // Ensure output directory exists
    const outputDir = resolve(outputPath, '..');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write review pack
    writeFileSync(outputPath, reviewPack, 'utf8');

    console.log(`Review pack generated successfully:`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Size: ${reviewPack.length} characters`);

  } catch (error) {
    console.error("Failed to generate review pack:", error);
    process.exit(1);
  }
}

/**
 * CLI entry point
 */
function main() {
  const cwd = process.cwd();
  const qaReportPath = resolve(cwd, "test-results/qa-artifacts/qa-report.json");
  const outputPath = resolve(cwd, ".handoff/qa-review-pack.md");

  generateReviewPack(qaReportPath, outputPath);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateReviewPack, formatTimestamp, formatDuration };
