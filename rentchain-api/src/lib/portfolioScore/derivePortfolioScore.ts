import { PORTFOLIO_SCORE_COMPONENT_WEIGHTS, PORTFOLIO_SCORE_GRADE_BANDS, PORTFOLIO_SCORE_SPARSE_DATA_BASELINE, PORTFOLIO_SCORE_SPARSE_DATA_THRESHOLD, PORTFOLIO_SCORE_STATUS_BANDS } from "./portfolioScoreConfig";
import type { PortfolioScoreComponent, PortfolioScoreGrade, PortfolioScoreV1 } from "./portfolioScoreTypes";
import type { PortfolioScoreSignals } from "./loadPortfolioScoreSignals";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function applySparseDataDampening(score: number, sampleSize: number) {
  const confidence = clamp(sampleSize / PORTFOLIO_SCORE_SPARSE_DATA_THRESHOLD, 0, 1);
  return clamp(PORTFOLIO_SCORE_SPARSE_DATA_BASELINE + (score - PORTFOLIO_SCORE_SPARSE_DATA_BASELINE) * confidence);
}

function gradeFromScore(score: number): PortfolioScoreGrade {
  return PORTFOLIO_SCORE_GRADE_BANDS.find((band) => score >= band.minimumScore)?.grade || "E";
}

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function countCriticalReasons(values: Array<string | null | undefined>) {
  return values.filter((value) => /BLOCKED|FAILED|DUPLICATE|MISSING|MISMATCH/i.test(asString(value, 200))).length;
}

function createComponent(input: {
  key: PortfolioScoreComponent["key"];
  label: string;
  rawValue: number;
  normalizedScore: number;
  reasons: string[];
}): PortfolioScoreComponent {
  const weight = PORTFOLIO_SCORE_COMPONENT_WEIGHTS[input.key];
  const normalizedScore = clamp(round(input.normalizedScore));
  return {
    key: input.key,
    label: input.label,
    rawValue: round(input.rawValue),
    normalizedScore,
    weight,
    contribution: round(normalizedScore * weight),
    reasons: input.reasons,
  };
}

export function derivePortfolioScore(signals: PortfolioScoreSignals): PortfolioScoreV1 {
  const applicationInsights = signals.applicationInsights.filter(Boolean);
  const maintenanceInsights = signals.maintenanceInsights.filter(Boolean);
  const leaseInsights = signals.leaseInsights.filter(Boolean);
  const totalResourcesReviewed = signals.applications.length + signals.maintenanceRequests.length + signals.leases.length;

  const completedApplications = applicationInsights.filter(
    (insight) => insight?.summary.lifecycleState === "submitted" || insight?.summary.lifecycleState === "completed"
  ).length;
  const completedMaintenance = maintenanceInsights.filter(
    (insight) => insight?.summary.lifecycleState === "completed"
  ).length;
  const completedLeases = leaseInsights.filter((insight) => {
    const state = insight?.summary.lifecycleState;
    return state === "activated" || state === "notice_generated";
  }).length;
  const completionRatio =
    totalResourcesReviewed > 0
      ? (completedApplications + completedMaintenance + completedLeases) / totalResourcesReviewed
      : 0;
  const workflowCompletionScore = applySparseDataDampening(completionRatio * 100, totalResourcesReviewed);

  const screeningRelevant = signals.screeningReconciliations.filter(
    (item) => item.status !== "not_started"
  );
  const screeningStateScore: Record<string, number> = {
    fulfilled: 100,
    quoted: 85,
    checkout_created: 80,
    payment_pending: 75,
    expired: 60,
    blocked: 55,
    needs_review: 50,
    abandoned: 45,
    duplicate_risk: 25,
    paid_not_fulfilled: 15,
    mismatch: 10,
  };
  const screeningAverage =
    screeningRelevant.length > 0
      ? screeningRelevant.reduce(
          (sum, item) => sum + (screeningStateScore[item.status] ?? 65),
          0
        ) / screeningRelevant.length
      : 85;
  const screeningReliabilityScore = applySparseDataDampening(screeningAverage, screeningRelevant.length);

  const maintenanceReopenCount = maintenanceInsights.reduce(
    (sum, insight) => sum + Number(insight?.summary.reopenCount || 0),
    0
  );
  const maintenanceBlockedCount = maintenanceInsights.reduce(
    (sum, insight) => sum + Number(insight?.summary.blockedCount || 0),
    0
  );
  const stalledMaintenanceCount = maintenanceInsights.filter((insight) => {
    const state = asString(insight?.summary.lifecycleState, 80);
    const durationMs = Number(insight?.summary.durationMs || 0);
    return state && state !== "completed" && durationMs > 48 * 60 * 60 * 1000;
  }).length;
  const maintenancePenalty =
    maintenanceReopenCount * 12 + maintenanceBlockedCount * 15 + stalledMaintenanceCount * 10;
  const maintenanceBase =
    signals.maintenanceRequests.length > 0
      ? 100 - maintenancePenalty / Math.max(1, signals.maintenanceRequests.length)
      : 85;
  const maintenanceStabilityScore = applySparseDataDampening(
    clamp(maintenanceBase),
    signals.maintenanceRequests.length
  );

  const automationExecuted = signals.automationEvents.filter((event) => event.type === "automation.executed").length;
  const automationSkipped = signals.automationEvents.filter((event) => event.type === "automation.skipped").length;
  const criticalAutomationSkips = countCriticalReasons(
    signals.automationEvents
      .filter((event) => event.type === "automation.skipped")
      .map((event) => asString(event.metadata?.reason, 200))
  );
  const automationTotal = automationExecuted + automationSkipped;
  const automationBase =
    automationTotal > 0
      ? (automationExecuted / automationTotal) * 100 - criticalAutomationSkips * 8
      : 85;
  const automationHealthScore = applySparseDataDampening(
    clamp(automationBase),
    automationTotal || 1
  );

  const policyReviewCount = signals.policyEvents.filter(
    (event) => asString(event.metadata?.outcome || event.status, 80) === "review"
  ).length;
  const policyBlockCount = signals.policyEvents.filter(
    (event) => asString(event.metadata?.outcome || event.status, 80) === "block"
  ).length;
  const policyTotal = signals.policyEvents.length;
  const policyBase =
    policyTotal > 0
      ? 100 - ((policyReviewCount * 10 + policyBlockCount * 18) / policyTotal)
      : 90;
  const policyFrictionScore = applySparseDataDampening(clamp(policyBase), policyTotal || 1);

  const triageItemCount = signals.triageItems.length;
  const criticalTriageCount = signals.triageItems.filter((item) => item.severity === "critical").length;
  const highTriageCount = signals.triageItems.filter((item) => item.severity === "high").length;
  const exceptionBase =
    totalResourcesReviewed > 0
      ? 100 -
        ((criticalTriageCount * 30 + highTriageCount * 18 + triageItemCount * 6) /
          Math.max(1, totalResourcesReviewed))
      : 85;
  const exceptionBurdenScore = applySparseDataDampening(
    clamp(exceptionBase),
    totalResourcesReviewed || 1
  );

  const components: PortfolioScoreComponent[] = [
    createComponent({
      key: "workflow_completion",
      label: "Workflow completion",
      rawValue: completionRatio,
      normalizedScore: workflowCompletionScore,
      reasons: totalResourcesReviewed
        ? [`${completedApplications + completedMaintenance + completedLeases} of ${totalResourcesReviewed} reviewed resources reached a healthy completed state.`]
        : ["No portfolio resources were available yet, so workflow completion is held near the neutral baseline."],
    }),
    createComponent({
      key: "screening_reliability",
      label: "Screening reliability",
      rawValue: screeningRelevant.length
        ? screeningRelevant.filter((item) => item.status === "fulfilled").length / screeningRelevant.length
        : 0,
      normalizedScore: screeningReliabilityScore,
      reasons:
        screeningRelevant.length > 0
          ? [
              `${screeningRelevant.filter((item) => item.status === "fulfilled").length} of ${screeningRelevant.length} active screening flows reconciled cleanly.`,
              ...(screeningRelevant.some((item) => item.status === "paid_not_fulfilled" || item.status === "mismatch")
                ? ["High-severity screening exceptions reduced this component."]
                : []),
            ]
          : ["No active screening reconciliation records were found, so this component stays near a neutral score."],
    }),
    createComponent({
      key: "maintenance_stability",
      label: "Maintenance stability",
      rawValue: signals.maintenanceRequests.length
        ? 1 - Math.min(1, (maintenanceReopenCount + maintenanceBlockedCount + stalledMaintenanceCount) / signals.maintenanceRequests.length)
        : 0,
      normalizedScore: maintenanceStabilityScore,
      reasons:
        signals.maintenanceRequests.length > 0
          ? [
              `${maintenanceReopenCount} reopened, ${maintenanceBlockedCount} blocked, and ${stalledMaintenanceCount} stalled maintenance workflows were observed.`,
            ]
          : ["No maintenance requests were available yet, so stability remains near the neutral baseline."],
    }),
    createComponent({
      key: "automation_health",
      label: "Automation health",
      rawValue: automationTotal > 0 ? automationExecuted / automationTotal : 0,
      normalizedScore: automationHealthScore,
      reasons:
        automationTotal > 0
          ? [`${automationExecuted} automation executions and ${automationSkipped} skips were recorded.`]
          : ["No automation activity was recorded yet, so this component stays neutral instead of penalizing non-use."],
    }),
    createComponent({
      key: "policy_friction",
      label: "Policy friction",
      rawValue: policyTotal > 0 ? (policyReviewCount + policyBlockCount) / policyTotal : 0,
      normalizedScore: policyFrictionScore,
      reasons:
        policyTotal > 0
          ? [`${policyReviewCount} reviews and ${policyBlockCount} blocks were recorded across ${policyTotal} policy evaluations.`]
          : ["No policy evaluation history was recorded yet, so this component stays near the neutral baseline."],
    }),
    createComponent({
      key: "exception_burden",
      label: "Exception burden",
      rawValue: totalResourcesReviewed > 0 ? triageItemCount / totalResourcesReviewed : 0,
      normalizedScore: exceptionBurdenScore,
      reasons:
        triageItemCount > 0
          ? [`${triageItemCount} triage items are currently open, including ${criticalTriageCount} critical issues.`]
          : ["No triage burden is currently open for this portfolio."],
    }),
  ];

  const score = clamp(
    round(components.reduce((sum, component) => sum + component.contribution, 0))
  );
  const grade = gradeFromScore(score);

  const reconciliationIssueCount = signals.screeningReconciliations.filter((item) =>
    ["paid_not_fulfilled", "mismatch", "duplicate_risk", "needs_review", "abandoned", "blocked"].includes(item.status)
  ).length;
  const blockedWorkflowCount =
    signals.screeningReconciliations.filter((item) => item.status === "blocked").length +
    maintenanceBlockedCount +
    signals.policyEvents.filter((event) => asString(event.metadata?.outcome || event.status, 80) === "block").length;

  const notes: string[] = [];
  if (criticalTriageCount === 0) {
    notes.push("Critical triage burden is low.");
  } else {
    notes.push("Critical triage items are present and should be reviewed first.");
  }
  if (reconciliationIssueCount > 0) {
    notes.push("Screening reconciliation issues reduced the reliability component.");
  }
  if (maintenanceReopenCount === 0 && maintenanceBlockedCount === 0) {
    notes.push("Maintenance stability remains healthy.");
  }
  if (totalResourcesReviewed < PORTFOLIO_SCORE_SPARSE_DATA_THRESHOLD) {
    notes.push("Sparse portfolio data keeps scores closer to a neutral baseline.");
  }

  let status: PortfolioScoreV1["summary"]["status"] = "at_risk";
  if (score >= PORTFOLIO_SCORE_STATUS_BANDS.healthy && criticalTriageCount === 0) {
    status = "healthy";
  } else if (score >= PORTFOLIO_SCORE_STATUS_BANDS.watch) {
    status = "watch";
  }

  let headline = "Portfolio operations require attention due to elevated exception burden.";
  if (status === "healthy") {
    headline = "Portfolio operations look healthy with low exception burden.";
  } else if (reconciliationIssueCount > 0) {
    headline = "Portfolio is stable overall, but screening exceptions need attention.";
  } else if (maintenanceReopenCount > 0 || blockedWorkflowCount > 0) {
    headline = "Portfolio is watchful due to maintenance and workflow friction.";
  }

  return {
    version: "v1",
    portfolioId: signals.portfolioId,
    generatedAt: new Date().toISOString(),
    score,
    grade,
    summary: {
      status,
      headline,
      notes,
    },
    components,
    metrics: {
      totalResourcesReviewed,
      triageItemCount,
      criticalTriageCount,
      reconciliationIssueCount,
      automationSkipCount: automationSkipped,
      policyReviewCount,
      blockedWorkflowCount,
      maintenanceReopenCount,
    },
  };
}

