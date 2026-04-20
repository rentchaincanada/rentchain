import React from "react";
import { fetchLandlordAnalyticsSnapshot, type AnalyticsPeriod, type LandlordAnalyticsSnapshot } from "../../api/landlordAnalyticsApi";
import {
  fetchLandlordAnalyticsAlerts,
  type LandlordAnalyticsAlertsResponse,
} from "../../api/landlordAnalyticsAlertsApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import AnalyticsAlertsPanel from "../../components/analytics/AnalyticsAlertsPanel";
import AnalyticsFiltersBar from "../../components/analytics/AnalyticsFiltersBar";
import AnalyticsKpiGrid from "../../components/analytics/AnalyticsKpiGrid";
import AnalyticsSectionPanel from "../../components/analytics/AnalyticsSectionPanel";
import InsightCardsPanel from "../../components/analytics/InsightCardsPanel";

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

function useAnalyticsState(enabled: boolean, period: AnalyticsPeriod, propertyId: string) {
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = React.useState<LandlordAnalyticsSnapshot | null>(null);
  const [alerts, setAlerts] = React.useState<LandlordAnalyticsAlertsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [analyticsResponse, alertsResponse] = await Promise.all([
          fetchLandlordAnalyticsSnapshot({
            period,
            propertyId: propertyId || null,
          }),
          fetchLandlordAnalyticsAlerts({
            period,
            propertyId: propertyId || null,
            status: "active",
          }),
        ]);
        if (!mounted) return;
        setSnapshot(analyticsResponse);
        setAlerts(alertsResponse);
      } catch (err: any) {
        if (!mounted) return;
        const message = err?.message || "Failed to load analytics";
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
  }, [enabled, period, propertyId, showToast]);

  return { snapshot, alerts, loading, error };
}

export default function LandlordAnalyticsPage() {
  const {
    loading: entitlementLoading,
    canViewPortfolioHealthSummary,
    canViewPortfolioScore,
    hasCapability,
  } = useEntitlements();
  const [period, setPeriod] = React.useState<AnalyticsPeriod>("90d");
  const [propertyId, setPropertyId] = React.useState("");
  const analyticsEnabled = !entitlementLoading && canViewPortfolioHealthSummary;
  const canViewAdvancedAnalytics = hasCapability("portfolio_analytics");
  const { snapshot, alerts, loading, error } = useAnalyticsState(analyticsEnabled, period, propertyId);

  const summaryItems = snapshot
    ? [
        {
          label: "Occupied units",
          value: String(snapshot.summary.occupiedUnits),
          hint: `${snapshot.leasing.totalUnits} total units in this view`,
        },
        {
          label: "Vacancy rate",
          value: formatPercent(snapshot.summary.vacancyRate),
          hint: `${snapshot.leasing.vacantUnits} vacant units`,
        },
        {
          label: "Active applications",
          value: String(snapshot.summary.activeApplications),
          hint: `${snapshot.applications.submitted} submitted in the period`,
        },
        {
          label: "Open work orders",
          value: String(snapshot.summary.openWorkOrders),
          hint: formatCurrency(snapshot.summary.maintenanceCostCents),
        },
        {
          label: "Scheduled rent",
          value: formatCurrency(snapshot.summary.estimatedScheduledRentCents),
          hint: "Estimated from active lease rent",
        },
        {
          label: "Leases ending soon",
          value: String(snapshot.summary.leasesEndingSoon),
          hint: "Within the next 30 days",
        },
      ]
    : [];

  return (
    <MacShell title="Analytics" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Analytics</h1>
            <div style={{ color: "#475569", maxWidth: 840 }}>
              A calm view of portfolio health, application activity, leasing pressure, maintenance burden, and rent signals.
            </div>
          </div>
        </Section>

        {entitlementLoading ? <Card>Loading analytics access…</Card> : null}
        {!entitlementLoading && !canViewPortfolioHealthSummary ? (
          <Card style={{ color: "#b91c1c" }}>Analytics is currently unavailable for this account.</Card>
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
            <AnalyticsAlertsPanel alerts={alerts?.alerts || []} summary={alerts?.summary || null} />
            <AnalyticsKpiGrid items={summaryItems} />

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
                    { label: "Started", value: String(snapshot.applications.started) },
                    { label: "Submitted", value: String(snapshot.applications.submitted) },
                    { label: "Approved", value: String(snapshot.applications.approved) },
                    { label: "Pending review", value: String(snapshot.applications.pendingReviewCount) },
                    { label: "Conversion rate", value: formatPercent(snapshot.applications.conversionRate) },
                  ]}
                />

                <AnalyticsSectionPanel
                  title="Leasing"
                  description="Watch occupancy, vacancy, and leases approaching expiry."
                  metrics={[
                    { label: "Total properties", value: String(snapshot.leasing.totalProperties) },
                    { label: "Occupied units", value: String(snapshot.leasing.occupiedUnits) },
                    { label: "Vacant units", value: String(snapshot.leasing.vacantUnits) },
                    { label: "Occupancy rate", value: formatPercent(snapshot.leasing.occupancyRate) },
                    { label: "Leases ending in 60 days", value: String(snapshot.leasing.leasesEndingIn60Days) },
                  ]}
                />

                <AnalyticsSectionPanel
                  title="Maintenance"
                  description="See how much operational drag maintenance is creating in this period."
                  emptyMessage="No maintenance activity in this period."
                  metrics={[
                    { label: "Open work orders", value: String(snapshot.maintenance.openWorkOrders) },
                    { label: "Completed work orders", value: String(snapshot.maintenance.completedWorkOrders) },
                    { label: "Reopened work orders", value: String(snapshot.maintenance.reopenedWorkOrders) },
                    { label: "Maintenance cost", value: formatCurrency(snapshot.maintenance.maintenanceCostCents) },
                    {
                      label: "Average cost per completed order",
                      value: formatCurrency(snapshot.maintenance.averageCostPerCompletedWorkOrderCents),
                    },
                  ]}
                />

                <AnalyticsSectionPanel
                  title="Revenue signal"
                  description="A non-accounting view of scheduled rent based on active leases."
                  metrics={[
                    { label: "Estimated scheduled rent", value: formatCurrency(snapshot.revenue.estimatedScheduledRentCents) },
                    {
                      label: "Average rent per occupied unit",
                      value: formatCurrency(snapshot.revenue.averageRentPerOccupiedUnitCents),
                    },
                    {
                      label: "Application conversion",
                      value: formatPercent(snapshot.summary.applicationConversionRate),
                      hint: "Helpful context when assessing demand quality",
                    },
                  ]}
                />
              </div>
            ) : null}

            {!canViewPortfolioScore ? (
              <FeatureTeaser
                featureKey="portfolio_score"
                eyebrow="Pro analytics"
                title="Unlock deeper analytics on Pro"
                description="Move from a summary overview into detailed application, leasing, maintenance, and revenue panels."
                ctaLabel="Upgrade to Pro"
              />
            ) : null}

            {canViewPortfolioScore && !canViewAdvancedAnalytics ? (
              <FeatureTeaser
                featureKey="portfolio_analytics"
                eyebrow="Elite analytics"
                title="Unlock attention-worthy insights on Elite"
                description="Surface more actionable analytics signals across vacancies, maintenance burden, and application changes."
                ctaLabel="Upgrade to Elite"
              />
            ) : null}

            {canViewPortfolioScore && canViewAdvancedAnalytics ? (
              <InsightCardsPanel insights={snapshot.insights} />
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
