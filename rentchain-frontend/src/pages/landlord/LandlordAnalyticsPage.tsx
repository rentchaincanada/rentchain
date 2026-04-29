import React from "react";
import { useLocation } from "react-router-dom";
import { fetchLandlordAnalyticsSnapshot, type AnalyticsPeriod, type LandlordAnalyticsSnapshot } from "../../api/landlordAnalyticsApi";
import {
  fetchLandlordAnalyticsAlerts,
  type LandlordAnalyticsAlertsResponse,
} from "../../api/landlordAnalyticsAlertsApi";
import {
  fetchLandlordAnalyticsBenchmarking,
  type LandlordAnalyticsBenchmarkingResponse,
} from "../../api/landlordAnalyticsBenchmarkingApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import AnalyticsAlertsPanel from "../../components/analytics/AnalyticsAlertsPanel";
import AgentDecisionPanel from "../../components/analytics/AgentDecisionPanel";
import AnalyticsFiltersBar from "../../components/analytics/AnalyticsFiltersBar";
import AnalyticsKpiGrid from "../../components/analytics/AnalyticsKpiGrid";
import AnalyticsSectionPanel from "../../components/analytics/AnalyticsSectionPanel";
import DecisionQueueSummary from "../../components/analytics/DecisionQueueSummary";
import DecisionOutcomeAnalyticsPanel from "../../components/analytics/DecisionOutcomeAnalyticsPanel";
import InsightCardsPanel from "../../components/analytics/InsightCardsPanel";
import PortfolioBenchmarkingPanel from "../../components/analytics/PortfolioBenchmarkingPanel";
import PredictiveMetricsPanel from "../../components/analytics/PredictiveMetricsPanel";
import { printSummaryDocument } from "../../utils/printSummary";
import {
  filterDecisionsByExecutionState,
  prioritizeDecisions,
  type DecisionExecutionFilter,
} from "../../components/analytics/decisionExecutionAggregation";

const EMPTY_DECISIONS: LandlordAnalyticsSnapshot["decisions"]["items"] = [];
type AnalyticsWorkspaceTabId =
  | "analytics-alerts"
  | "portfolio-benchmarking"
  | "decision-outcomes"
  | "operator-queue"
  | "recommended-next-actions"
  | "actions-to-review"
  | "predictive-metrics"
  | "attention-worthy-insights"
  | "portfolio-execution-summary";

const ANALYTICS_WORKSPACE_TABS: Array<{ id: AnalyticsWorkspaceTabId; label: string }> = [
  { id: "analytics-alerts", label: "Analytics alerts" },
  { id: "portfolio-benchmarking", label: "Portfolio benchmarking" },
  { id: "decision-outcomes", label: "Decision outcomes" },
  { id: "operator-queue", label: "Operator queue" },
  { id: "recommended-next-actions", label: "Recommended next actions" },
  { id: "actions-to-review", label: "Actions to review" },
  { id: "predictive-metrics", label: "Predictive metrics" },
  { id: "attention-worthy-insights", label: "Attention-worthy insights" },
  { id: "portfolio-execution-summary", label: "Portfolio-level execution state summary" },
];

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load analytics";
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatCurrency(cents: number | null | undefined) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function formatCurrencyDelta(cents: number) {
  return formatCurrency(cents);
}

function formatCountDelta(value: number) {
  return String(Math.round(value));
}

function periodLabel(period: AnalyticsPeriod) {
  if (period === "30d") return "30 days";
  if (period === "90d") return "90 days";
  if (period === "365d") return "365 days";
  return "month to date";
}

function entryLabel(entry: string | null) {
  if (entry === "vacancy-readiness") return "Vacancy readiness";
  if (entry === "revenue-pressure") return "Revenue pressure";
  if (entry === "property-focus") return "Property focus";
  return null;
}

function workspaceTabIntro(tab: AnalyticsWorkspaceTabId) {
  if (tab === "actions-to-review") {
    return "This workspace keeps the focus on reviewable recommendations without changing the underlying decision queue behavior.";
  }
  if (tab === "portfolio-execution-summary") {
    return "This view summarizes how decisions are distributed across execution states so you can see what is ready, blocked, or already handled.";
  }
  return null;
}

function useAnalyticsState(enabled: boolean, includeBenchmarking: boolean, period: AnalyticsPeriod, propertyId: string) {
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = React.useState<LandlordAnalyticsSnapshot | null>(null);
  const [alerts, setAlerts] = React.useState<LandlordAnalyticsAlertsResponse | null>(null);
  const [benchmarking, setBenchmarking] = React.useState<LandlordAnalyticsBenchmarkingResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setBenchmarking(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const requests: Array<
          Promise<
            LandlordAnalyticsSnapshot | LandlordAnalyticsAlertsResponse | LandlordAnalyticsBenchmarkingResponse
          >
        > = [
          fetchLandlordAnalyticsSnapshot({
            period,
            propertyId: propertyId || null,
          }),
          fetchLandlordAnalyticsAlerts({
            period,
            propertyId: propertyId || null,
            status: "active",
          }),
        ];
        if (includeBenchmarking) {
          requests.push(
            fetchLandlordAnalyticsBenchmarking({
              period,
              propertyId: propertyId || null,
            })
          );
        }
        const [analyticsResponse, alertsResponse, benchmarkingResponse] = await Promise.all(requests);
        if (!mounted) return;
        setSnapshot(analyticsResponse);
        setAlerts(alertsResponse);
        setBenchmarking(includeBenchmarking ? benchmarkingResponse || null : null);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = errorMessage(err);
        setError(message);
        showToast({
          message: "Failed to load analytics",
          description: message,
          variant: "error",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [enabled, includeBenchmarking, period, propertyId, showToast]);

  return { snapshot, alerts, benchmarking, loading, error };
}

export default function LandlordAnalyticsPage() {
  const location = useLocation();
  const {
    loading: entitlementLoading,
    canViewPortfolioHealthSummary,
    canViewPortfolioScore,
    hasCapability,
  } = useEntitlements();
  const [period, setPeriod] = React.useState<AnalyticsPeriod>("90d");
  const [propertyId, setPropertyId] = React.useState("");
  const [executionFilter, setExecutionFilter] = React.useState<DecisionExecutionFilter>("all");
  const [activeTab, setActiveTab] = React.useState<AnalyticsWorkspaceTabId>("analytics-alerts");
  const urlParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const routedPropertyId = urlParams.get("propertyId");
  const routedEntryLabel = entryLabel(urlParams.get("entry"));

  React.useEffect(() => {
    if (!routedPropertyId || routedPropertyId === propertyId) return;
    setPropertyId(routedPropertyId);
  }, [propertyId, routedPropertyId]);

  const analyticsEnabled = !entitlementLoading && canViewPortfolioHealthSummary;
  const canViewAdvancedAnalytics = hasCapability("portfolio_analytics");
  const canViewBenchmarking = canViewPortfolioScore;
  const { snapshot, alerts, benchmarking, loading, error } = useAnalyticsState(
    analyticsEnabled,
    canViewBenchmarking,
    period,
    propertyId
  );
  const summaryDeltas = snapshot?.comparisons?.deltas?.summary;
  const applicationDeltas = snapshot?.comparisons?.deltas?.applications;
  const leasingDeltas = snapshot?.comparisons?.deltas?.leasing;
  const maintenanceDeltas = snapshot?.comparisons?.deltas?.maintenance;
  const revenueDeltas = snapshot?.comparisons?.deltas?.revenue;
  const decisions = snapshot?.decisions?.items ?? EMPTY_DECISIONS;
  const filteredDecisions = React.useMemo(
    () => filterDecisionsByExecutionState(decisions, executionFilter),
    [decisions, executionFilter]
  );
  const prioritizedDecisions = React.useMemo(() => prioritizeDecisions(filteredDecisions), [filteredDecisions]);
  const activeTabIntro = workspaceTabIntro(activeTab);
  const activeTabLabel = ANALYTICS_WORKSPACE_TABS.find((tab) => tab.id === activeTab)?.label || "Analytics alerts";
  const showPortfolioScoreTeaser = canViewPortfolioScore === false;
  const showAdvancedAnalyticsTeaser = canViewPortfolioScore && !canViewAdvancedAnalytics;

  const summaryItems = snapshot
    ? [
        {
          label: "Occupied units",
          value: String(snapshot.summary.occupiedUnits),
          hint: `${snapshot.leasing.totalUnits} total units in this view`,
          delta: summaryDeltas?.occupiedUnits,
          formatAbsoluteDelta: formatCountDelta,
        },
        {
          label: "Vacancy rate",
          value: formatPercent(snapshot.summary.vacancyRate),
          hint: `${snapshot.leasing.vacantUnits} vacant units`,
          delta: summaryDeltas?.vacancyRate,
          formatAbsoluteDelta: (value) => formatPercent(value),
        },
        {
          label: "Active applications",
          value: String(snapshot.summary.activeApplications),
          hint: `${snapshot.applications.submitted} submitted in the period`,
          delta: summaryDeltas?.activeApplications,
          formatAbsoluteDelta: formatCountDelta,
        },
        {
          label: "Open work orders",
          value: String(snapshot.summary.openWorkOrders),
          hint: formatCurrency(snapshot.summary.maintenanceCostCents),
          delta: summaryDeltas?.openWorkOrders,
          formatAbsoluteDelta: formatCountDelta,
        },
        {
          label: "Scheduled rent",
          value: formatCurrency(snapshot.summary.estimatedScheduledRentCents),
          hint: "Estimated from active lease rent",
          delta: summaryDeltas?.estimatedScheduledRentCents,
          formatAbsoluteDelta: formatCurrencyDelta,
        },
        {
          label: "Leases ending soon",
          value: String(snapshot.summary.leasesEndingSoon),
          hint: "Within the next 30 days",
          delta: summaryDeltas?.leasesEndingSoon,
          formatAbsoluteDelta: formatCountDelta,
        },
      ]
    : [];

  return (
    <MacShell title="Analytics" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Analytics</h1>
              <div style={{ color: "#475569", maxWidth: 840 }}>
                A calm view of portfolio health, application activity, leasing pressure, maintenance burden, and rent signals.
              </div>
              {routedEntryLabel ? (
                <div style={{ color: "#0f766e", fontWeight: 600, fontSize: "0.92rem" }}>
                  Focused from decisions: {routedEntryLabel}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="no-print"
              onClick={() => void printSummaryDocument("summary")}
              style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF", fontWeight: 900, cursor: "pointer" }}
            >
              Print / Save PDF
            </button>
          </div>
        </Section>

        {snapshot ? (
          <div className="print-only print-only-summary">
            <div className="printHeader">
              <div className="printTitle">Analytics summary</div>
              <div className="printMeta">
                <div>Period: {periodLabel(period)}</div>
                <div>Property filter: {propertyId || "All properties"}</div>
              </div>
            </div>
            <div className="printKpis">
              {summaryItems.slice(0, 4).map((item) => (
                <div key={item.label} className="printKpi">
                  <div className="printKpiLabel">{item.label}</div>
                  <div className="printKpiValue">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="printH3">Decision queue</div>
            <table className="printTable">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prioritizedDecisions.slice(0, 10).map((decision) => (
                  <tr key={decision.id}>
                    <td>{decision.title}</td>
                    <td>{decision.priority}</td>
                    <td>{decision.executionState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {entitlementLoading ? <Card>Loading analytics access…</Card> : null}
        {!entitlementLoading && !canViewPortfolioHealthSummary ? (
          <Card style={{ color: "#b91c1c" }}>Analytics is currently unavailable for this account.</Card>
        ) : null}

        {analyticsEnabled ? (
          <div
            role="tablist"
            aria-label="Analytics workspace sections"
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 4,
              scrollbarWidth: "thin",
            }}
          >
            {ANALYTICS_WORKSPACE_TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`analytics-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`analytics-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    borderRadius: 999,
                    border: selected ? "1px solid #0f172a" : "1px solid #cbd5e1",
                    background: selected ? "#0f172a" : "#fff",
                    color: selected ? "#fff" : "#334155",
                    fontWeight: 700,
                    padding: "8px 12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flex: "0 0 auto",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {analyticsEnabled ? (
          <AnalyticsFiltersBar
            period={period}
            propertyId={propertyId}
            properties={snapshot?.properties || []}
            disabled={loading}
            onPeriodChange={setPeriod}
            onPropertyChange={setPropertyId}
          />
        ) : null}

        {analyticsEnabled && loading ? <Card>Loading analytics…</Card> : null}
        {analyticsEnabled && !loading && error ? (
          <Card style={{ color: "#b91c1c" }}>Failed to load analytics: {error}</Card>
        ) : null}

        {analyticsEnabled && !loading && !error && snapshot ? (
          <>
            <AnalyticsKpiGrid items={summaryItems} periodLabel={periodLabel(period)} />

            {canViewPortfolioScore ? (
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                }}
              >
                <AnalyticsSectionPanel
                  title="Applications"
                  description="Track whether interest is turning into submitted and approved applications."
                  emptyMessage="No applications in the selected timeframe."
                  metrics={[
                    {
                      label: "Started",
                      value: String(snapshot.applications.started),
                      delta: applicationDeltas?.started,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Submitted",
                      value: String(snapshot.applications.submitted),
                      delta: applicationDeltas?.submitted,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Approved",
                      value: String(snapshot.applications.approved),
                      delta: applicationDeltas?.approved,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Pending review",
                      value: String(snapshot.applications.pendingReviewCount),
                      delta: applicationDeltas?.pendingReviewCount,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Conversion rate",
                      value: formatPercent(snapshot.applications.conversionRate),
                      delta: applicationDeltas?.conversionRate,
                      formatAbsoluteDelta: (value) => formatPercent(value),
                    },
                  ]}
                  periodLabel={periodLabel(period)}
                />

                <AnalyticsSectionPanel
                  title="Leasing"
                  description="Watch occupancy, vacancy, and leases approaching expiry."
                  metrics={[
                    { label: "Total properties", value: String(snapshot.leasing.totalProperties) },
                    {
                      label: "Occupied units",
                      value: String(snapshot.leasing.occupiedUnits),
                      delta: leasingDeltas?.occupiedUnits,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Vacant units",
                      value: String(snapshot.leasing.vacantUnits),
                      delta: leasingDeltas?.vacantUnits,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Occupancy rate",
                      value: formatPercent(snapshot.leasing.occupancyRate),
                      delta: leasingDeltas?.occupancyRate,
                      formatAbsoluteDelta: (value) => formatPercent(value),
                    },
                    {
                      label: "Leases ending in 60 days",
                      value: String(snapshot.leasing.leasesEndingIn60Days),
                      delta: leasingDeltas?.leasesEndingIn60Days,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                  ]}
                  periodLabel={periodLabel(period)}
                />

                <AnalyticsSectionPanel
                  title="Maintenance"
                  description="See how much operational drag maintenance is creating in this period."
                  emptyMessage="No maintenance activity in this period."
                  metrics={[
                    {
                      label: "Open work orders",
                      value: String(snapshot.maintenance.openWorkOrders),
                      delta: maintenanceDeltas?.openWorkOrders,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Completed work orders",
                      value: String(snapshot.maintenance.completedWorkOrders),
                      delta: maintenanceDeltas?.completedWorkOrders,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Reopened work orders",
                      value: String(snapshot.maintenance.reopenedWorkOrders),
                      delta: maintenanceDeltas?.reopenedWorkOrders,
                      formatAbsoluteDelta: formatCountDelta,
                    },
                    {
                      label: "Maintenance cost",
                      value: formatCurrency(snapshot.maintenance.maintenanceCostCents),
                      delta: maintenanceDeltas?.maintenanceCostCents,
                      formatAbsoluteDelta: formatCurrencyDelta,
                    },
                    {
                      label: "Average cost per completed order",
                      value: formatCurrency(snapshot.maintenance.averageCostPerCompletedWorkOrderCents),
                      delta: maintenanceDeltas?.averageCostPerCompletedWorkOrderCents,
                      formatAbsoluteDelta: formatCurrencyDelta,
                    },
                  ]}
                  periodLabel={periodLabel(period)}
                />

                <AnalyticsSectionPanel
                  title="Revenue signal"
                  description="A non-accounting view of scheduled rent based on active leases."
                  metrics={[
                    {
                      label: "Estimated scheduled rent",
                      value: formatCurrency(snapshot.revenue.estimatedScheduledRentCents),
                      delta: revenueDeltas?.estimatedScheduledRentCents,
                      formatAbsoluteDelta: formatCurrencyDelta,
                    },
                    {
                      label: "Average rent per occupied unit",
                      value: formatCurrency(snapshot.revenue.averageRentPerOccupiedUnitCents),
                      delta: revenueDeltas?.averageRentPerOccupiedUnitCents,
                      formatAbsoluteDelta: formatCurrencyDelta,
                    },
                    {
                      label: "Application conversion",
                      value: formatPercent(snapshot.summary.applicationConversionRate),
                      hint: "Helpful context when assessing demand quality",
                      delta: summaryDeltas?.applicationConversionRate,
                      formatAbsoluteDelta: (value) => formatPercent(value),
                    },
                  ]}
                  periodLabel={periodLabel(period)}
                />
              </div>
            ) : null}

            <div
              id={`analytics-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`analytics-tab-${activeTab}`}
              aria-label={activeTabLabel}
              style={{ display: "grid", gap: 12 }}
            >
              {activeTabIntro ? (
                <Card style={{ color: "#475569" }}>{activeTabIntro}</Card>
              ) : null}

              {activeTab === "analytics-alerts" ? (
                <AnalyticsAlertsPanel alerts={alerts?.alerts || []} summary={alerts?.summary || null} />
              ) : null}

              {activeTab === "portfolio-benchmarking" && canViewBenchmarking ? (
                <PortfolioBenchmarkingPanel benchmarking={benchmarking} />
              ) : null}

              {activeTab === "decision-outcomes" && canViewPortfolioScore && canViewAdvancedAnalytics ? (
                <DecisionOutcomeAnalyticsPanel analytics={snapshot.decisionOutcomeAnalytics} />
              ) : null}

              {(activeTab === "operator-queue" || activeTab === "portfolio-execution-summary") &&
              canViewPortfolioScore &&
              canViewAdvancedAnalytics ? (
                <DecisionQueueSummary
                  decisions={decisions}
                  filter={executionFilter}
                  onFilterChange={setExecutionFilter}
                />
              ) : null}

              {(activeTab === "recommended-next-actions" || activeTab === "actions-to-review") &&
              canViewPortfolioScore &&
              canViewAdvancedAnalytics ? (
                <AgentDecisionPanel
                  decisions={prioritizedDecisions}
                  period={period}
                  propertyId={propertyId}
                />
              ) : null}

              {activeTab === "predictive-metrics" && canViewPortfolioScore && canViewAdvancedAnalytics ? (
                <PredictiveMetricsPanel metrics={snapshot.predictive?.metrics || []} />
              ) : null}

              {activeTab === "attention-worthy-insights" && canViewPortfolioScore && canViewAdvancedAnalytics ? (
                <InsightCardsPanel
                  insights={snapshot.insights}
                  alerts={alerts?.alerts || []}
                  decisions={prioritizedDecisions}
                />
              ) : null}

              {activeTab !== "analytics-alerts" && !canViewPortfolioScore ? (
                <FeatureTeaser
                  featureKey="portfolio_score"
                  eyebrow="Pro analytics"
                  title="Unlock deeper analytics on Pro"
                  description="Move from a summary overview into detailed application, leasing, maintenance, and revenue panels."
                  ctaLabel="Upgrade to Pro"
                />
              ) : null}

              {activeTab !== "analytics-alerts" &&
              activeTab !== "portfolio-benchmarking" &&
              canViewPortfolioScore &&
              !canViewAdvancedAnalytics ? (
                <FeatureTeaser
                  featureKey="portfolio_analytics"
                  eyebrow="Elite analytics"
                  title="Unlock attention-worthy insights on Elite"
                  description="Surface more actionable analytics signals across vacancies, maintenance burden, and application changes."
                  ctaLabel="Upgrade to Elite"
                />
              ) : null}
            </div>

            {showPortfolioScoreTeaser ? (
              <FeatureTeaser
                featureKey="portfolio_score"
                eyebrow="Pro analytics"
                title="Unlock deeper analytics on Pro"
                description="Move from a summary overview into detailed application, leasing, maintenance, and revenue panels."
                ctaLabel="Upgrade to Pro"
              />
            ) : null}

            {showAdvancedAnalyticsTeaser ? (
              <FeatureTeaser
                featureKey="portfolio_analytics"
                eyebrow="Elite analytics"
                title="Unlock attention-worthy insights on Elite"
                description="Surface more actionable analytics signals across vacancies, maintenance burden, and application changes."
                ctaLabel="Upgrade to Elite"
              />
            ) : null}

            {!snapshot.properties.length &&
            snapshot.leasing.totalUnits === 0 &&
            snapshot.applications.started === 0 &&
            snapshot.maintenance.completedWorkOrders === 0 &&
            snapshot.maintenance.openWorkOrders === 0 ? (
              <Card>
                Analytics will become more useful as you add units, leases, applications, and maintenance activity.
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
