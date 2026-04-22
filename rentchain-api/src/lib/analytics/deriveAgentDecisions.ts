import type {
  AnalyticsDeltaValue,
  LandlordAgentDecision,
  LandlordAgentDecisions,
  LandlordAgentDecisionPriority,
  LandlordAgentDecisionSupportingSignal,
  LandlordAgentDecisionType,
  LandlordBenchmarkInsight,
  LandlordDecisionActionKey,
  LandlordDecisionWorkflowCategory,
  LandlordPortfolioBenchmarking,
  LandlordPredictiveMetric,
} from "./analyticsTypes";
import type { AnalyticsAlert } from "./alertTypes";

type AgentDecisionInput = {
  filters: {
    propertyId: string | null;
  };
  deltas: {
    summary: {
      vacancyRate: AnalyticsDeltaValue;
      applicationConversionRate: AnalyticsDeltaValue;
      activeApplications: AnalyticsDeltaValue;
      openWorkOrders: AnalyticsDeltaValue;
      maintenanceCostCents: AnalyticsDeltaValue;
      estimatedScheduledRentCents: AnalyticsDeltaValue;
      leasesEndingSoon: AnalyticsDeltaValue;
    };
    applications: {
      submitted: AnalyticsDeltaValue;
      conversionRate: AnalyticsDeltaValue;
    };
  };
  alerts: AnalyticsAlert[];
  predictiveMetrics: LandlordPredictiveMetric[];
  benchmarking: LandlordPortfolioBenchmarking;
};

const PRIORITY_WEIGHT: Record<LandlordAgentDecisionPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const DECISION_ORDER: Record<LandlordAgentDecisionType, number> = {
  reduce_vacancy_risk: 0,
  review_lease_renewals: 1,
  address_maintenance_backlog: 2,
  improve_application_conversion: 3,
  review_revenue_pressure: 4,
  focus_highest_risk_property: 5,
};

function getPredictiveMetric(metrics: LandlordPredictiveMetric[], key: LandlordPredictiveMetric["key"]) {
  return metrics.find((metric) => metric.key === key) || null;
}

function getBenchmarkInsight(insights: LandlordBenchmarkInsight[], type: LandlordBenchmarkInsight["type"]) {
  return insights.find((insight) => insight.type === type) || null;
}

function derivePriority(base: Array<LandlordAgentDecisionPriority | null | undefined>) {
  const values = base.filter(Boolean) as LandlordAgentDecisionPriority[];
  if (!values.length) return null;
  return values.sort((a, b) => PRIORITY_WEIGHT[b] - PRIORITY_WEIGHT[a])[0];
}

function bumpPriority(priority: LandlordAgentDecisionPriority | null, amount: number) {
  if (!priority) return null;
  const nextWeight = Math.min(3, PRIORITY_WEIGHT[priority] + amount);
  return (Object.entries(PRIORITY_WEIGHT).find(([, weight]) => weight === nextWeight)?.[0] || priority) as LandlordAgentDecisionPriority;
}

function priorityFromAlert(alerts: AnalyticsAlert[]) {
  return derivePriority(alerts.map((alert) => alert.severity));
}

function priorityFromPredictive(metric: LandlordPredictiveMetric | null) {
  if (!metric || metric.status !== "supported" || !metric.riskLevel) return null;
  return metric.riskLevel;
}

function supportFromAlert(alert: AnalyticsAlert): LandlordAgentDecisionSupportingSignal {
  return {
    source: "alert",
    key: alert.type,
    label: alert.title,
    propertyId: alert.propertyId || null,
    value: alert.metricValue ?? null,
  };
}

function supportFromPredictive(metric: LandlordPredictiveMetric): LandlordAgentDecisionSupportingSignal {
  return {
    source: "predictive_metric",
    key: metric.key,
    label: metric.label,
    propertyId:
      typeof metric.supportingValues?.topPropertyId === "string" ? String(metric.supportingValues.topPropertyId) : null,
    value:
      metric.supportingValues?.vacancyRate ??
      metric.supportingValues?.leasesEndingSoon ??
      metric.supportingValues?.openWorkOrders ??
      metric.supportingValues?.relativeDelta ??
      null,
  };
}

function supportFromBenchmark(insight: LandlordBenchmarkInsight): LandlordAgentDecisionSupportingSignal {
  return {
    source: "benchmarking_insight",
    key: insight.type,
    label: insight.message,
    propertyId: insight.propertyId || null,
  };
}

function supportFromDelta(key: string, label: string, delta: AnalyticsDeltaValue): LandlordAgentDecisionSupportingSignal | null {
  if (delta.direction === "flat" || delta.direction === "insufficient_data") return null;
  return {
    source: "delta",
    key,
    label,
    direction: delta.direction,
    value: delta.absoluteDelta,
  };
}

function actionHref(type: LandlordAgentDecisionType, propertyId?: string | null) {
  if (type === "review_lease_renewals") return "/portfolio-health";
  if (type === "improve_application_conversion") return "/applications";
  if (type === "address_maintenance_backlog") return "/work-orders";
  if (type === "reduce_vacancy_risk" || type === "review_revenue_pressure" || type === "focus_highest_risk_property") {
    return propertyId ? `/analytics?propertyId=${encodeURIComponent(propertyId)}` : "/analytics";
  }
  return undefined;
}

function decisionId(decisionType: LandlordAgentDecisionType, propertyId?: string | null) {
  return propertyId ? `${decisionType}:${propertyId}` : decisionType;
}

function dedupeSignals(signals: Array<LandlordAgentDecisionSupportingSignal | null | undefined>) {
  const seen = new Set<string>();
  const result: LandlordAgentDecisionSupportingSignal[] = [];

  for (const signal of signals) {
    if (!signal) continue;
    const key = `${signal.source}:${signal.key}:${signal.propertyId || ""}:${signal.direction || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(signal);
  }

  return result;
}

function highSeverityCount(alerts: AnalyticsAlert[]) {
  return alerts.filter((alert) => alert.severity === "high").length;
}

function buildDecision(params: {
  decisionType: LandlordAgentDecisionType;
  priority: LandlordAgentDecisionPriority | null;
  explanation: string;
  recommendedAction: string;
  propertyId?: string | null;
  signals: Array<LandlordAgentDecisionSupportingSignal | null | undefined>;
}) {
  if (!params.priority) return null;
  const supportingSignals = dedupeSignals(params.signals);
  if (params.priority === "low" && supportingSignals.length < 2) return null;
  const hook = deriveActionHook(params.decisionType, params.propertyId || null);
  return {
    id: decisionId(params.decisionType, params.propertyId || null),
    decisionType: params.decisionType,
    priority: params.priority,
    explanation: params.explanation,
    supportingSignals,
    recommendedAction: params.recommendedAction,
    href: hook.destination,
    state: "pending",
    reviewedAt: null,
  } satisfies LandlordAgentDecision;
}

function deriveLeaseRenewalDecision(input: AgentDecisionInput) {
  const alerts = input.alerts.filter((alert) => alert.status === "active" && alert.type === "lease_expiry");
  const predictive = getPredictiveMetric(input.predictiveMetrics, "projected_lease_expiry_concentration");
  const priority = derivePriority([priorityFromAlert(alerts), priorityFromPredictive(predictive)]);
  if (!priority) return null;

  const deltaSignal = supportFromDelta(
    "summary.leasesEndingSoon",
    "Near-term lease expiries",
    input.deltas.summary.leasesEndingSoon
  );

  return buildDecision({
    decisionType: "review_lease_renewals",
    priority:
      deltaSignal && input.deltas.summary.leasesEndingSoon.direction === "worse" ? bumpPriority(priority, 1) : priority,
    explanation:
      predictive?.status === "supported"
        ? `${predictive.explanation} Review renewals and turnover plans before those leases roll.`
        : `${alerts[0]?.message || "Leases are ending soon in the current view."} Review renewals and turnover plans now.`,
    recommendedAction: "Review renewals",
    propertyId: alerts[0]?.propertyId || null,
    signals: [...alerts.map(supportFromAlert), predictive ? [supportFromPredictive(predictive), deltaSignal] : [deltaSignal]].flat(),
  });
}

function deriveVacancyDecision(input: AgentDecisionInput) {
  const alerts = input.alerts.filter(
    (alert) => alert.status === "active" && (alert.type === "high_vacancy" || alert.type === "vacancy_increase")
  );
  const predictive = getPredictiveMetric(input.predictiveMetrics, "projected_vacancy_risk");
  const benchmark = getBenchmarkInsight(input.benchmarking.insights, "vacancy_risk");
  const priority = derivePriority([priorityFromAlert(alerts), priorityFromPredictive(predictive), benchmark?.severity]);
  if (!priority) return null;

  const deltaSignal = supportFromDelta("summary.vacancyRate", "Vacancy trend", input.deltas.summary.vacancyRate);
  const propertyId =
    benchmark?.propertyId ||
    alerts.find((alert) => alert.propertyId)?.propertyId ||
    (typeof predictive?.supportingValues?.topPropertyId === "string" ? String(predictive.supportingValues.topPropertyId) : null);

  return buildDecision({
    decisionType: "reduce_vacancy_risk",
    priority:
      highSeverityCount(alerts) > 0 || (alerts.length >= 2 && deltaSignal) ? bumpPriority(priority, 1) : priority,
    explanation:
      benchmark?.propertyId && benchmark.message
        ? `${benchmark.message} Focus leasing attention there first to limit further vacancy drag.`
        : predictive?.status === "supported"
          ? `${predictive.explanation} Shift attention to pricing, listing quality, and lead follow-up now.`
          : `${alerts[0]?.message || "Vacancy pressure is elevated in the current view."} Shift leasing attention there now.`,
    recommendedAction: propertyId ? "View property analytics" : "Reduce vacancy risk",
    propertyId,
    signals: [
      ...alerts.map(supportFromAlert),
      predictive ? supportFromPredictive(predictive) : null,
      benchmark ? supportFromBenchmark(benchmark) : null,
      deltaSignal,
    ],
  });
}

function deriveApplicationDecision(input: AgentDecisionInput) {
  const alerts = input.alerts.filter(
    (alert) =>
      alert.status === "active" &&
      (alert.type === "low_application_activity" ||
        alert.type === "application_conversion_drop" ||
        alert.type === "application_drop")
  );
  const predictive = getPredictiveMetric(input.predictiveMetrics, "projected_application_slowdown_risk");
  const priority = derivePriority([priorityFromAlert(alerts), priorityFromPredictive(predictive)]);
  if (!priority) return null;

  const submittedDelta = supportFromDelta("applications.submitted", "Submitted applications trend", input.deltas.applications.submitted);
  const conversionDelta = supportFromDelta(
    "summary.applicationConversionRate",
    "Conversion rate trend",
    input.deltas.summary.applicationConversionRate
  );

  return buildDecision({
    decisionType: "improve_application_conversion",
    priority:
      alerts.some((alert) => alert.type === "application_conversion_drop") && submittedDelta ? bumpPriority(priority, 1) : priority,
    explanation:
      predictive?.status === "supported"
        ? `${predictive.explanation} Review lead handling and conversion friction before leasing demand softens further.`
        : `${alerts[0]?.message || "Application demand has weakened in the current view."} Review lead handling and conversion friction now.`,
    recommendedAction: "Review applications",
    signals: [...alerts.map(supportFromAlert), predictive ? supportFromPredictive(predictive) : null, submittedDelta, conversionDelta],
  });
}

function deriveMaintenanceDecision(input: AgentDecisionInput) {
  const alerts = input.alerts.filter(
    (alert) =>
      alert.status === "active" &&
      (alert.type === "maintenance_cost_spike" || alert.type === "work_order_concentration")
  );
  const predictive = getPredictiveMetric(input.predictiveMetrics, "projected_maintenance_burden_risk");
  const benchmark = getBenchmarkInsight(input.benchmarking.insights, "maintenance_concentration");
  const priority = derivePriority([priorityFromAlert(alerts), priorityFromPredictive(predictive), benchmark?.severity]);
  if (!priority) return null;

  const deltaSignal = supportFromDelta(
    "summary.maintenanceCostCents",
    "Maintenance cost trend",
    input.deltas.summary.maintenanceCostCents
  );
  const propertyId = benchmark?.propertyId || alerts.find((alert) => alert.propertyId)?.propertyId || null;

  return buildDecision({
    decisionType: "address_maintenance_backlog",
    priority:
      alerts.some((alert) => alert.type === "work_order_concentration") && benchmark?.severity === "high"
        ? bumpPriority(priority, 1)
        : priority,
    explanation:
      benchmark?.propertyId && benchmark.message
        ? `${benchmark.message} Clear the backlog there before costs and resident disruption compound.`
        : predictive?.status === "supported"
          ? `${predictive.explanation} Clear high-friction work orders before they create more drag.`
          : `${alerts[0]?.message || "Maintenance pressure is elevated in the current view."} Clear the highest-friction work orders first.`,
    recommendedAction: "Review work orders",
    propertyId,
    signals: [
      ...alerts.map(supportFromAlert),
      predictive ? supportFromPredictive(predictive) : null,
      benchmark ? supportFromBenchmark(benchmark) : null,
      deltaSignal,
    ],
  });
}

function deriveRevenueDecision(input: AgentDecisionInput) {
  const predictive = getPredictiveMetric(input.predictiveMetrics, "projected_revenue_pressure_signal");
  const priority = priorityFromPredictive(predictive);
  if (!priority) return null;

  const deltaSignal = supportFromDelta(
    "summary.estimatedScheduledRentCents",
    "Scheduled rent trend",
    input.deltas.summary.estimatedScheduledRentCents
  );

  return buildDecision({
    decisionType: "review_revenue_pressure",
    priority:
      deltaSignal && input.deltas.summary.estimatedScheduledRentCents.direction === "worse" ? bumpPriority(priority, 1) : priority,
    explanation: `${predictive!.explanation} Review near-term rent exposure before portfolio revenue softens further.`,
    recommendedAction: "Review revenue pressure",
    propertyId:
      typeof predictive?.supportingValues?.topPropertyId === "string" ? String(predictive.supportingValues.topPropertyId) : null,
    signals: [predictive ? supportFromPredictive(predictive) : null, deltaSignal],
  });
}

function derivePropertyFocusDecision(input: AgentDecisionInput, decisions: LandlordAgentDecision[]) {
  if (input.filters.propertyId) return null;

  const propertyScores = new Map<string, number>();
  const propertyReasons = new Map<string, string[]>();

  for (const decision of decisions) {
    for (const signal of decision.supportingSignals) {
      const propertyId = signal.propertyId || null;
      if (!propertyId) continue;
      propertyScores.set(propertyId, (propertyScores.get(propertyId) || 0) + PRIORITY_WEIGHT[decision.priority]);
      if (!propertyReasons.has(propertyId)) propertyReasons.set(propertyId, []);
      propertyReasons.get(propertyId)!.push(decision.recommendedAction);
    }
  }

  const strongestBenchmark =
    input.benchmarking.insights.find((insight) => insight.severity === "high" && insight.propertyId) ||
    input.benchmarking.insights.find((insight) => insight.propertyId) ||
    null;
  if (strongestBenchmark?.propertyId) {
    propertyScores.set(strongestBenchmark.propertyId, (propertyScores.get(strongestBenchmark.propertyId) || 0) + PRIORITY_WEIGHT[strongestBenchmark.severity]);
    if (!propertyReasons.has(strongestBenchmark.propertyId)) propertyReasons.set(strongestBenchmark.propertyId, []);
    propertyReasons.get(strongestBenchmark.propertyId)!.push(strongestBenchmark.type.replace(/_/g, " "));
  }

  const ranked = Array.from(propertyScores.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const top = ranked[0];
  if (!top || top[1] < 3) return null;

  const comparison = input.benchmarking.comparisons.find((item) => item.propertyId === top[0]) || null;
  const propertyName = comparison?.propertyName || top[0];
  const reasons = Array.from(new Set(propertyReasons.get(top[0]) || [])).slice(0, 2);
  const priority: LandlordAgentDecisionPriority = top[1] >= 5 ? "high" : "medium";

  return buildDecision({
    decisionType: "focus_highest_risk_property",
    priority,
    explanation:
      reasons.length > 0
        ? `${propertyName} carries the most concentrated portfolio pressure right now across ${reasons.join(" and ").toLowerCase()}.`
        : `${propertyName} carries the most concentrated portfolio pressure right now.`,
    recommendedAction: "View property analytics",
    propertyId: top[0],
    signals: strongestBenchmark ? [supportFromBenchmark(strongestBenchmark)] : [],
  });
}

export function deriveAgentDecisions(input: AgentDecisionInput): LandlordAgentDecisions {
  const decisions = [
    deriveVacancyDecision(input),
    deriveLeaseRenewalDecision(input),
    deriveMaintenanceDecision(input),
    deriveApplicationDecision(input),
    deriveRevenueDecision(input),
  ].filter(Boolean) as LandlordAgentDecision[];

  const propertyFocus = derivePropertyFocusDecision(input, decisions);
  if (propertyFocus) decisions.push(propertyFocus);

  return {
    items: decisions
      .sort((a, b) => {
        if (PRIORITY_WEIGHT[b.priority] !== PRIORITY_WEIGHT[a.priority]) {
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }
        const signalDelta = b.supportingSignals.length - a.supportingSignals.length;
        if (signalDelta !== 0) return signalDelta;
        return DECISION_ORDER[a.decisionType] - DECISION_ORDER[b.decisionType];
      })
      .slice(0, 5),
  };
}
