import { describe, expect, it } from "vitest";
import type { AnalyticsAlert } from "@/api/landlordAnalyticsAlertsApi";
import type {
  LandlordAgentDecision,
  LandlordAnalyticsInsight,
  LandlordPredictiveMetric,
} from "@/api/landlordAnalyticsApi";
import {
  analyticsAlertNextStepCopy,
  decisionNextStepCopy,
  deriveAlertTheme,
  deriveDecisionTheme,
  deriveInsightTheme,
  formatPredictiveSupportingValues,
  insightNextStepCopy,
  predictiveMetricNextReviewCopy,
  shouldRenderInsightCard,
} from "./analyticsInsightCopy";

function buildMetric(overrides?: Partial<LandlordPredictiveMetric>): LandlordPredictiveMetric {
  return {
    key: "projected_vacancy_risk",
    label: "Projected vacancy risk",
    riskLevel: "medium",
    status: "supported",
    explanation: "Vacancy pressure is present in the current view.",
    supportingValues: {
      vacancyRate: 0.2,
      topPropertyId: "prop-2",
      vacantUnits: 1,
    },
    ...overrides,
  };
}

function buildAlert(overrides?: Partial<AnalyticsAlert>): AnalyticsAlert {
  return {
    id: "alert-1",
    type: "lease_expiry",
    severity: "medium",
    status: "active",
    title: "Leases ending soon",
    message: "1 lease ends within 30 days.",
    detectedAt: "2026-04-20T00:00:00.000Z",
    lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
    notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
    ...overrides,
  };
}

function buildDecision(overrides?: Partial<LandlordAgentDecision>): LandlordAgentDecision {
  return {
    id: "review_lease_renewals",
    decisionType: "review_lease_renewals",
    priority: "medium",
    explanation: "Several leases are approaching renewal windows and need attention.",
    supportingSignals: [],
    recommendedAction: "Review renewals",
    actionKey: "open_lease_renewals_flow",
    actionLabel: "Open renewals focus",
    destination: "/portfolio-health",
    automationEligible: false,
    automationState: "manual_only",
    automationReason: null,
    executionMappingState: "none",
    executionMapping: null,
    executionInputState: "none",
    executionInputReason: null,
    executionInputMissingFields: [],
    executionInput: null,
    executionOutcomeStatus: "none",
    executionOutcomeAt: null,
    executionOutcomeReason: null,
    state: "pending",
    ...overrides,
  };
}

describe("analyticsInsightCopy", () => {
  it("formats predictive supporting values into landlord-readable lines and hides raw IDs", () => {
    const result = formatPredictiveSupportingValues(buildMetric());

    expect(result).toContain("Current vacancy: 20%");
    expect(result).toContain("Vacant units: 1");
    expect(result).not.toContain("topPropertyId");
    expect(result).not.toContain("prop-2");
  });

  it("limits predictive support output to two readable lines", () => {
    const result = formatPredictiveSupportingValues(
      buildMetric({
        supportingValues: {
          submittedCurrent: 1,
          submittedPrior: 4,
          conversionCurrent: 0.2,
          conversionPrior: 0.5,
        },
        key: "projected_application_slowdown_risk",
      })
    );

    expect(result).toBe("Current submitted applications: 1 • Prior submitted applications: 4");
  });

  it("suppresses low-value duplicate operational insights when alerts or decisions already cover the same theme", () => {
    const insight: LandlordAnalyticsInsight = {
      type: "lease_expiry",
      severity: "medium",
      message: "1 lease ends within 30 days.",
    };

    expect(
      shouldRenderInsightCard({
        insight,
        alerts: [buildAlert()],
        decisions: [buildDecision()],
      })
    ).toBe(false);
  });

  it("preserves comparative leader insights even when other signals exist", () => {
    const insight: LandlordAnalyticsInsight = {
      type: "vacancy_leader",
      severity: "low",
      message: "Alpha currently has the lowest vacancy rate in your portfolio.",
    };

    expect(
      shouldRenderInsightCard({
        insight,
        alerts: [buildAlert({ type: "high_vacancy" })],
        decisions: [buildDecision({ decisionType: "reduce_vacancy_risk" })],
      })
    ).toBe(true);
  });

  it("classifies alert, decision, and insight themes deterministically", () => {
    expect(deriveAlertTheme(buildAlert({ type: "maintenance_cost_spike" }))).toBe("maintenance");
    expect(deriveDecisionTheme(buildDecision({ decisionType: "review_revenue_pressure" }))).toBe("revenue");
    expect(
      deriveInsightTheme({
        type: "applications_drop",
        severity: "low",
        message: "Applications dropped compared with the previous period.",
      })
    ).toBe("applications");
  });

  it("derives deterministic next-step copy by alert, metric, insight, and decision theme", () => {
    expect(analyticsAlertNextStepCopy(buildAlert({ type: "high_vacancy" }))).toContain("pricing");
    expect(predictiveMetricNextReviewCopy(buildMetric({ key: "projected_application_slowdown_risk" }))).toContain(
      "submitted applications"
    );
    expect(
      insightNextStepCopy({
        type: "maintenance_cost_increase",
        severity: "medium",
        message: "Maintenance costs increased compared with the previous period.",
      })
    ).toContain("work orders");
    expect(decisionNextStepCopy(buildDecision({ decisionType: "review_revenue_pressure" }))).toContain(
      "revenue pressure"
    );
  });
});
