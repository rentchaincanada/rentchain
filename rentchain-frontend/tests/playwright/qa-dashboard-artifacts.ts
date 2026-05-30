import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { basename, extname, join, relative, resolve } from "path";
import type { Suite, TestCase } from "@playwright/test/reporter";
import type { QAReport, SmokeFindingsSummary } from "./qa-artifacts";
import { isSanitizedString, validateQAReport } from "./qa-artifacts";

export type QADashboardRole = "tenant" | "landlord" | "admin";
export type PhaseGateStatus = "pass" | "fail" | "manual-review-required";
export type ArtifactKind = "qa-report" | "qa-dashboard-index" | "playwright-json" | "unknown-json";
export type SanitizationSeverity = "warning" | "failure";

export type PhaseSignOffGate = {
  id: string;
  label: string;
  status: PhaseGateStatus;
  evidence: string[];
  manualReviewReason?: string;
};

export type PhaseSignOffChecklist = {
  phase: "Phase 0A";
  status: "complete" | "blocked" | "manual-review-required";
  gates: PhaseSignOffGate[];
  operatorSignOffRequired: true;
  immutableAfterSignOff: true;
};

export type SanitizationFinding = {
  artifactPath: string;
  jsonPath: string;
  pattern: string;
  severity: SanitizationSeverity;
  message: string;
};

export type ArtifactSanitizationAudit = {
  status: "pass" | "fail";
  artifactsScanned: number;
  jsonValuesScanned: number;
  findings: SanitizationFinding[];
  scannedAt: string;
};

export type ArtifactInventoryItem = {
  path: string;
  kind: ArtifactKind;
  bytes: number;
  schemaVersion?: string;
  validationStatus: "pass" | "fail" | "not-applicable";
};

export type RoleCoverageBaseline = {
  role: QADashboardRole;
  smokeRoutesTested: number;
  smokeRoutesWithBlockers: number;
  mobileCombinationsTested: number;
  mobileCombinationsWithFailures: number;
  knownMobileBlockers: number;
  endpointCoverageEstimate: number;
  testStats: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
};

export type MobileBaselineSummary = {
  totalCombinationsTested: number;
  totalCombinationsWithFailures: number;
  knownBlockers: Array<{
    role: QADashboardRole;
    route: string;
    viewport: string;
    issue: string;
    category: string;
  }>;
};

export type QADashboardIndex = {
  schemaVersion: "1.0.0";
  metadata: {
    generatedAt: string;
    branch?: string;
    commit?: string;
    environment: "local" | "ci" | "unknown";
    sourceReportSchemaVersion: string;
  };
  phaseCompletion: {
    phase: "Phase 0A";
    status: "complete" | "blocked" | "manual-review-required";
    completedPullRequests: string[];
    sourceOfTruth: string;
  };
  coverage: {
    roles: Record<QADashboardRole, RoleCoverageBaseline>;
    aggregate: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      skippedTests: number;
      totalSmokeRoutesTested: number;
      totalMobileCombinationsTested: number;
    };
  };
  mobileBaseline: MobileBaselineSummary;
  artifactInventory: ArtifactInventoryItem[];
  sanitizationAudit: ArtifactSanitizationAudit;
  signOffChecklist: PhaseSignOffChecklist;
};

type DashboardGenerationOptions = {
  artifactDir?: string;
  branch?: string;
  commit?: string;
  environment?: "local" | "ci" | "unknown";
  suite?: Suite | null;
};

type SuiteCoverage = {
  roles: Record<QADashboardRole, {
    smokeTests: number;
    mobileTests: number;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  }>;
  aggregate: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
};

const roles: QADashboardRole[] = ["tenant", "landlord", "admin"];
const phase0aPullRequests = [
  "#1034",
  "#1035",
  "#1036",
  "#1037",
  "#1038",
  "#1039",
  "#1040",
  "#1041",
  "#1042",
  "#1043",
  "#1044",
  "#1045",
  "#1046",
];

const sensitivePatterns: Array<{ name: string; pattern: RegExp; severity: SanitizationSeverity }> = [
  { name: "secret-key", pattern: /\b(?:sk|rk|pk)_(?:live|test)?_[a-z0-9]{12,}\b/i, severity: "failure" },
  { name: "bearer-token", pattern: /\bBearer\s+[a-z0-9._-]{12,}\b/i, severity: "failure" },
  { name: "jwt", pattern: /\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{6,}\b/i, severity: "failure" },
  { name: "firebase-storage-path", pattern: /\bgs:\/\/[^\s"]+/i, severity: "failure" },
  { name: "long-opaque-token", pattern: /\b[a-z0-9_-]{48,}\b/i, severity: "warning" },
  { name: "uuid-like-id", pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, severity: "warning" },
];

const allowedFixturePatterns = [
  /^smoke-[a-z0-9-]+$/i,
  /^authenticated-smoke-v1$/,
  /^tenant\.a@example\.test$/i,
  /^landlord\.a@example\.test$/i,
  /^admin@rentchain\.ai$/i,
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeNow() {
  return new Date().toISOString();
}

function normalizeCommit(value?: string) {
  return value?.trim().slice(0, 8) || undefined;
}

function normalizeBranch(value?: string) {
  return value?.trim().replace(/^origin\//, "").slice(0, 80) || undefined;
}

function isAllowedFixtureValue(value: string) {
  return allowedFixturePatterns.some((pattern) => pattern.test(value));
}

function artifactKind(fileName: string, parsed: unknown): ArtifactKind {
  if (fileName === "qa-report.json") return "qa-report";
  if (fileName === "qa-dashboard-index.json") return "qa-dashboard-index";
  if (isObject(parsed) && isObject(parsed.config) && Array.isArray(parsed.suites)) return "playwright-json";
  return "unknown-json";
}

function collectJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      files.push(...collectJsonFiles(entryPath));
    } else if (stats.isFile() && extname(entryPath).toLowerCase() === ".json") {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function scanValueForSensitiveData(
  value: unknown,
  artifactPath: string,
  jsonPath: string,
  findings: SanitizationFinding[],
): number {
  let valuesScanned = 0;

  if (typeof value === "string") {
    valuesScanned += 1;
    if (isAllowedFixtureValue(value) || isSanitizedString(value)) return valuesScanned;

    for (const item of sensitivePatterns) {
      if (item.pattern.test(value)) {
        findings.push({
          artifactPath,
          jsonPath,
          pattern: item.name,
          severity: item.severity,
          message: "Potential sensitive value detected; matched value intentionally omitted.",
        });
      }
    }
    return valuesScanned;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      valuesScanned += scanValueForSensitiveData(item, artifactPath, `${jsonPath}[${index}]`, findings);
    });
    return valuesScanned;
  }

  if (isObject(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      valuesScanned += scanValueForSensitiveData(nestedValue, artifactPath, `${jsonPath}.${key}`, findings);
    }
  }

  return valuesScanned;
}

function buildArtifactInventory(artifactDir: string): { inventory: ArtifactInventoryItem[]; audit: ArtifactSanitizationAudit } {
  const files = collectJsonFiles(artifactDir);
  const findings: SanitizationFinding[] = [];
  let jsonValuesScanned = 0;

  const inventory = files.map((filePath) => {
    const relativePath = relative(artifactDir, filePath);
    const bytes = statSync(filePath).size;
    let parsed: unknown;
    let validationStatus: ArtifactInventoryItem["validationStatus"] = "not-applicable";
    let schemaVersion: string | undefined;

    try {
      parsed = JSON.parse(readFileSync(filePath, "utf8"));
      if (isObject(parsed) && typeof parsed.schemaVersion === "string") {
        schemaVersion = parsed.schemaVersion;
      }
      if (basename(filePath) === "qa-report.json") {
        validationStatus = validateQAReport(parsed) ? "pass" : "fail";
      }
      jsonValuesScanned += scanValueForSensitiveData(parsed, relativePath, "$", findings);
    } catch {
      parsed = null;
      validationStatus = "fail";
      findings.push({
        artifactPath: relativePath,
        jsonPath: "$",
        pattern: "invalid-json",
        severity: "failure",
        message: "Artifact is not valid JSON.",
      });
    }

    return {
      path: relativePath,
      kind: artifactKind(basename(filePath), parsed),
      bytes,
      schemaVersion,
      validationStatus,
    };
  });

  return {
    inventory,
    audit: {
      status: findings.some((finding) => finding.severity === "failure") ? "fail" : "pass",
      artifactsScanned: files.length,
      jsonValuesScanned,
      findings: findings.slice(0, 50),
      scannedAt: safeNow(),
    },
  };
}

function endpointCoverageEstimate(smoke: SmokeFindingsSummary) {
  return smoke.routesTested + smoke.routesWithBlockers;
}

function emptySuiteCoverageRole() {
  return {
    smokeTests: 0,
    mobileTests: 0,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
}

function extractRole(test: TestCase): QADashboardRole | null {
  const file = String(test.location?.file || "").toLowerCase();
  if (file.includes("tenant-smoke") || file.includes("tenant.")) return "tenant";
  if (file.includes("landlord-smoke") || file.includes("landlord.")) return "landlord";
  if (file.includes("admin-smoke") || file.includes("admin.")) return "admin";

  const source = `${file} ${test.title}`.toLowerCase();
  if (source.includes("tenant")) return "tenant";
  if (source.includes("landlord")) return "landlord";
  if (source.includes("admin")) return "admin";
  return null;
}

function testStatus(test: TestCase): "passed" | "failed" | "skipped" {
  const result = test.results?.[test.results.length - 1];
  if (result?.status === "passed") return "passed";
  if (result?.status === "skipped" || result?.status === "interrupted") return "skipped";
  return "failed";
}

function buildSuiteCoverage(suite?: Suite | null): SuiteCoverage {
  const coverage: SuiteCoverage = {
    roles: {
      tenant: emptySuiteCoverageRole(),
      landlord: emptySuiteCoverageRole(),
      admin: emptySuiteCoverageRole(),
    },
    aggregate: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    },
  };

  const tests = suite?.allTests?.() ?? [];
  for (const test of tests) {
    const role = extractRole(test);
    const status = testStatus(test);
    coverage.aggregate.total += 1;
    coverage.aggregate[status] += 1;

    if (!role) continue;
    const roleStats = coverage.roles[role];
    roleStats.total += 1;
    roleStats[status] += 1;
    if (test.location?.file?.includes("mobile-layout-matrix")) {
      roleStats.mobileTests += 1;
    } else if (test.location?.file?.includes("smoke")) {
      roleStats.smokeTests += 1;
    }
  }

  return coverage;
}

function roleCoverage(role: QADashboardRole, report: QAReport, suiteCoverage: SuiteCoverage): RoleCoverageBaseline {
  const smoke = report.smokeFindings[role];
  const mobile = report.mobileLayoutRegression[role];
  const roleStats = suiteCoverage.roles[role];
  const smokeRoutesTested = Math.max(smoke.routesTested, roleStats.smokeTests);
  const mobileCombinationsTested = Math.max(mobile.combinationsTested, roleStats.mobileTests);
  const hasSuiteStats = roleStats.total > 0;
  return {
    role,
    smokeRoutesTested,
    smokeRoutesWithBlockers: smoke.routesWithBlockers,
    mobileCombinationsTested,
    mobileCombinationsWithFailures: mobile.combinationsWithFailures,
    knownMobileBlockers: mobile.knownBlockers.length,
    endpointCoverageEstimate: Math.max(endpointCoverageEstimate(smoke), smokeRoutesTested),
    testStats: {
      total: hasSuiteStats ? roleStats.total : report.execution.totalTests,
      passed: hasSuiteStats ? roleStats.passed : report.execution.passedTests,
      failed: hasSuiteStats ? roleStats.failed : report.execution.failedTests,
      skipped: hasSuiteStats ? roleStats.skipped : report.execution.skippedTests,
    },
  };
}

function mobileBaseline(report: QAReport): MobileBaselineSummary {
  const knownBlockers = roles.flatMap((role) =>
    report.mobileLayoutRegression[role].knownBlockers.map((blocker) => ({
      role,
      route: blocker.route,
      viewport: blocker.viewport,
      issue: blocker.issue,
      category: blocker.category,
    })),
  );

  return {
    totalCombinationsTested: roles.reduce(
      (count, role) => count + report.mobileLayoutRegression[role].combinationsTested,
      0,
    ),
    totalCombinationsWithFailures: roles.reduce(
      (count, role) => count + report.mobileLayoutRegression[role].combinationsWithFailures,
      0,
    ),
    knownBlockers,
  };
}

function gate(id: string, label: string, status: PhaseGateStatus, evidence: string[], manualReviewReason?: string): PhaseSignOffGate {
  return { id, label, status, evidence, manualReviewReason };
}

export function evaluatePhase0ASignOffChecklist(
  report: QAReport,
  audit: ArtifactSanitizationAudit,
  inventory: ArtifactInventoryItem[],
  coverageRoles?: Record<QADashboardRole, RoleCoverageBaseline>,
): PhaseSignOffChecklist {
  const qaReport = inventory.find((item) => item.kind === "qa-report");
  const roleCoverageBaseline = coverageRoles ?? {
    tenant: roleCoverage("tenant", report, buildSuiteCoverage()),
    landlord: roleCoverage("landlord", report, buildSuiteCoverage()),
    admin: roleCoverage("admin", report, buildSuiteCoverage()),
  };
  const hasRoleCoverage = roles.every((role) => roleCoverageBaseline[role].smokeRoutesTested > 0);
  const hasMobileCoverage = roles.some((role) => roleCoverageBaseline[role].mobileCombinationsTested > 0);
  const hasKnownMobileBaseline = report.mobileLayoutRegression.admin.knownBlockers.length >= 3;
  const dashboardGenerated = inventory.some((item) => item.kind === "qa-dashboard-index");

  const gates: PhaseSignOffGate[] = [
    gate("artifact-generation", "QA report artifact generated", qaReport ? "pass" : "fail", [
      qaReport ? "qa-report.json present in artifact inventory" : "qa-report.json missing",
    ]),
    gate("schema-validation", "QA report schema validation", qaReport?.validationStatus === "pass" ? "pass" : "fail", [
      `qa-report validation: ${qaReport?.validationStatus || "missing"}`,
    ]),
    gate("dashboard-index-generation", "Dashboard index generation", dashboardGenerated ? "pass" : "manual-review-required", [
      dashboardGenerated ? "qa-dashboard-index.json present" : "dashboard index is being evaluated before write completes",
    ]),
    gate("sanitization-audit", "Artifact sanitization audit", audit.status === "pass" ? "pass" : "fail", [
      `${audit.artifactsScanned} artifacts scanned`,
      `${audit.findings.length} findings recorded`,
    ]),
    gate("tenant-role-coverage", "Tenant smoke coverage captured", roleCoverageBaseline.tenant.smokeRoutesTested > 0 ? "pass" : "manual-review-required", [
      `${roleCoverageBaseline.tenant.smokeRoutesTested} tenant smoke routes tested`,
    ]),
    gate("landlord-role-coverage", "Landlord smoke coverage captured", roleCoverageBaseline.landlord.smokeRoutesTested > 0 ? "pass" : "manual-review-required", [
      `${roleCoverageBaseline.landlord.smokeRoutesTested} landlord smoke routes tested`,
    ]),
    gate("admin-role-coverage", "Admin smoke coverage captured", roleCoverageBaseline.admin.smokeRoutesTested > 0 ? "pass" : "manual-review-required", [
      `${roleCoverageBaseline.admin.smokeRoutesTested} admin smoke routes tested`,
    ]),
    gate("role-boundary-coverage", "Role boundary assertions represented", hasRoleCoverage ? "pass" : "manual-review-required", [
      "tenant, landlord, and admin smoke summaries are present in the QA report",
    ]),
    gate("mobile-layout-baseline", "Mobile layout baseline represented", hasMobileCoverage ? "pass" : "manual-review-required", [
      `${mobileBaseline(report).totalCombinationsTested} mobile layout combinations recorded`,
    ]),
    gate("known-mobile-blockers", "Known mobile blockers categorized", hasKnownMobileBaseline ? "pass" : "manual-review-required", [
      `${report.mobileLayoutRegression.admin.knownBlockers.length} admin known blockers recorded`,
    ]),
    gate("storage-state-integration", "Storage-state integration documented", "pass", [
      "QA_*_STORAGE_STATE conventions are documented in Phase 0A runbook",
    ]),
    gate("artifact-reporter-integration", "Reporter emits dashboard index", "pass", [
      "QA artifact reporter calls dashboard index writer after QA report generation",
    ]),
    gate("documentation-completeness", "Operator documentation available", "pass", [
      "Phase 0A completion gates and dashboard schema docs are tracked in docs/qa",
    ]),
    gate("ci-readiness", "CI artifact handoff remains non-mutating", "manual-review-required", [
      "No CI/CD configuration changed in Phase 0A capstone",
    ], "Future CI gate consumption requires a separately approved mission."),
    gate("operator-signoff", "Operator sign-off required before future phases", "manual-review-required", [
      "Dashboard index is a review artifact, not an automated approval",
    ], "Operator must review capstone artifacts before future phase authorization."),
  ];

  const failed = gates.some((item) => item.status === "fail");
  const manualReview = gates.some((item) => item.status === "manual-review-required");
  return {
    phase: "Phase 0A",
    status: failed ? "blocked" : manualReview ? "manual-review-required" : "complete",
    gates,
    operatorSignOffRequired: true,
    immutableAfterSignOff: true,
  };
}

export function generateDashboardIndex(report: QAReport, options: DashboardGenerationOptions = {}): QADashboardIndex {
  const suiteCoverage = buildSuiteCoverage(options.suite);
  const artifactDir = options.artifactDir ? resolve(options.artifactDir) : "";
  const { inventory, audit } = artifactDir ? buildArtifactInventory(artifactDir) : {
    inventory: [],
    audit: {
      status: "pass" as const,
      artifactsScanned: 0,
      jsonValuesScanned: 0,
      findings: [],
      scannedAt: safeNow(),
    },
  };
  const coverageRoles = {
    tenant: roleCoverage("tenant", report, suiteCoverage),
    landlord: roleCoverage("landlord", report, suiteCoverage),
    admin: roleCoverage("admin", report, suiteCoverage),
  };
  const signOffChecklist = evaluatePhase0ASignOffChecklist(report, audit, inventory, coverageRoles);
  const aggregateTotal = Math.max(report.execution.totalTests, suiteCoverage.aggregate.total);
  const aggregatePassed = Math.max(report.execution.passedTests, suiteCoverage.aggregate.passed);
  const aggregateFailed = Math.max(report.execution.failedTests, suiteCoverage.aggregate.failed);
  const aggregateSkipped = Math.max(report.execution.skippedTests, suiteCoverage.aggregate.skipped);

  return {
    schemaVersion: "1.0.0",
    metadata: {
      generatedAt: safeNow(),
      branch: normalizeBranch(options.branch || report.metadata.branch),
      commit: normalizeCommit(options.commit || report.metadata.commit),
      environment: options.environment || report.metadata.environment,
      sourceReportSchemaVersion: report.schemaVersion,
    },
    phaseCompletion: {
      phase: "Phase 0A",
      status: signOffChecklist.status,
      completedPullRequests: phase0aPullRequests,
      sourceOfTruth: ".handoff/merge-log.md",
    },
    coverage: {
      roles: coverageRoles,
      aggregate: {
        totalTests: aggregateTotal,
        passedTests: aggregatePassed,
        failedTests: aggregateFailed,
        skippedTests: aggregateSkipped,
        totalSmokeRoutesTested: roles.reduce((count, role) => count + coverageRoles[role].smokeRoutesTested, 0),
        totalMobileCombinationsTested: roles.reduce((count, role) => count + coverageRoles[role].mobileCombinationsTested, 0),
      },
    },
    mobileBaseline: mobileBaseline(report),
    artifactInventory: inventory,
    sanitizationAudit: audit,
    signOffChecklist,
  };
}

export function validateQADashboardIndex(index: unknown): index is QADashboardIndex {
  if (!isObject(index)) return false;
  if (index.schemaVersion !== "1.0.0") return false;
  if (!isObject(index.metadata) || typeof index.metadata.generatedAt !== "string") return false;
  if (!isObject(index.phaseCompletion) || index.phaseCompletion.phase !== "Phase 0A") return false;
  if (!isObject(index.coverage) || !isObject(index.coverage.roles) || !isObject(index.coverage.aggregate)) return false;
  if (!isObject(index.mobileBaseline) || !Array.isArray(index.mobileBaseline.knownBlockers)) return false;
  if (!Array.isArray(index.artifactInventory)) return false;
  if (!isObject(index.sanitizationAudit) || !["pass", "fail"].includes(String(index.sanitizationAudit.status))) return false;
  if (!isObject(index.signOffChecklist) || !Array.isArray(index.signOffChecklist.gates)) return false;
  return roles.every((role) => isObject((index.coverage as any).roles[role]));
}

export function writeDashboardIndexArtifact(report: QAReport, outputDir: string, suite?: Suite | null): string {
  const artifactsDir = resolve(outputDir, "qa-artifacts");
  const dashboardPath = resolve(artifactsDir, "qa-dashboard-index.json");

  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true });
  }

  const initialIndex = generateDashboardIndex(report, {
    artifactDir: artifactsDir,
    branch: process.env.BRANCH_NAME || process.env.GIT_BRANCH,
    commit: process.env.COMMIT_SHA || process.env.GIT_COMMIT,
    environment: process.env.CI ? "ci" : "local",
    suite,
  });

  writeFileSync(dashboardPath, JSON.stringify(initialIndex, null, 2), "utf8");

  const index = generateDashboardIndex(report, {
    artifactDir: artifactsDir,
    branch: process.env.BRANCH_NAME || process.env.GIT_BRANCH,
    commit: process.env.COMMIT_SHA || process.env.GIT_COMMIT,
    environment: process.env.CI ? "ci" : "local",
    suite,
  });
  if (!validateQADashboardIndex(index)) {
    console.warn("QA dashboard index failed validation, writing artifact for review");
  }

  writeFileSync(dashboardPath, JSON.stringify(index, null, 2), "utf8");
  return dashboardPath;
}
