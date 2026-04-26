import React from "react";
import { fetchLandlordAnalyticsSnapshot, type LandlordAnalyticsSnapshot } from "../../api/landlordAnalyticsApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import { resolveRequiredPlanLabel } from "@/lib/upgradePrompt";
import AgentDecisionPanel from "../../components/analytics/AgentDecisionPanel";
import DecisionQueueSummary from "../../components/analytics/DecisionQueueSummary";
import DecisionOutcomeAnalyticsPanel from "../../components/analytics/DecisionOutcomeAnalyticsPanel";
import {
  filterDecisionsByExecutionState,
  prioritizeDecisions,
  type DecisionExecutionFilter,
} from "../../components/analytics/decisionExecutionAggregation";

const EMPTY_DECISIONS: LandlordAnalyticsSnapshot["decisions"]["items"] = [];

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load decision inbox";
}

export default function ActionRecommendationsPage() {
  const { showToast } = useToast();
  const {
    loading: entitlementLoading,
    canViewPortfolioScore,
    canViewActionRecommendations,
    hasCapability,
  } = useEntitlements();
  const [snapshot, setSnapshot] = React.useState<LandlordAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [executionFilter, setExecutionFilter] = React.useState<DecisionExecutionFilter>("all");
  const canViewAnalyticsDecisions = canViewPortfolioScore && hasCapability("portfolio_analytics");
  const canViewDecisionInbox = canViewActionRecommendations && canViewAnalyticsDecisions;
  const decisions = snapshot?.decisions?.items ?? EMPTY_DECISIONS;
  const filteredDecisions = React.useMemo(
    () => filterDecisionsByExecutionState(decisions, executionFilter),
    [decisions, executionFilter]
  );
  const prioritizedDecisions = React.useMemo(() => prioritizeDecisions(filteredDecisions), [filteredDecisions]);

  React.useEffect(() => {
    if (entitlementLoading || !canViewDecisionInbox) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLandlordAnalyticsSnapshot();
        if (!mounted) return;
        setSnapshot(response);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = errorMessage(err);
        setError(message);
        showToast({
          message: "Failed to load recommended actions",
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
  }, [canViewDecisionInbox, entitlementLoading, showToast]);

  const recommendationsPlanLabel =
    resolveRequiredPlanLabel("portfolio_action_recommendations") || "Elite";
  const analyticsPlanLabel = resolveRequiredPlanLabel("portfolio_analytics") || "Elite";

  return (
    <MacShell title="Recommended actions">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Recommended actions</h1>
            <div style={{ color: "#475569", maxWidth: 820 }}>
              A centralized decision inbox that turns current portfolio signals into the next actions worth reviewing now.
            </div>
          </div>
        </Section>

        {entitlementLoading ? <Card>Loading recommended actions…</Card> : null}
        {!entitlementLoading && !canViewPortfolioScore ? (
          <LockedFeature
            featureKey="portfolio_action_recommendations"
            title={`Unlock recommended actions on ${recommendationsPlanLabel}`}
            description="Recommended actions build on RentChain's portfolio intelligence and surface a centralized inbox of prioritized next steps."
            hint="Portfolio health remains available now, while portfolio score, analytics, and decision inbox access unlock as you move up the intelligence ladder."
            ctaLabel={`Upgrade to ${recommendationsPlanLabel}`}
          />
        ) : null}
        {!entitlementLoading && canViewPortfolioScore && !hasCapability("portfolio_analytics") ? (
          <FeatureTeaser
            featureKey="portfolio_analytics"
            eyebrow={`${analyticsPlanLabel} analytics`}
            title={`Unlock decision inbox on ${analyticsPlanLabel}`}
            description="Decision inbox is powered by the same analytics snapshot that drives portfolio decisions, so analytics access is required to view these actions."
            ctaLabel={`Upgrade to ${analyticsPlanLabel}`}
          />
        ) : null}
        {!entitlementLoading && canViewAnalyticsDecisions && !canViewActionRecommendations ? (
          <FeatureTeaser
            featureKey="portfolio_action_recommendations"
            title={`Unlock recommended actions on ${recommendationsPlanLabel}`}
            eyebrow={`${recommendationsPlanLabel} intelligence`}
            description="Recommended actions turn current analytics decisions into a centralized inbox for day-to-day follow-through."
            ctaLabel={`Upgrade to ${recommendationsPlanLabel}`}
          />
        ) : null}
        {!entitlementLoading && canViewDecisionInbox && loading ? <Card>Loading recommended actions…</Card> : null}
        {!entitlementLoading && canViewDecisionInbox && !loading && error ? (
          <Card style={{ color: "#b91c1c" }}>Failed to load recommended actions: {error}</Card>
        ) : null}
        {!entitlementLoading && canViewDecisionInbox && !loading && !error ? (
          <>
            <DecisionOutcomeAnalyticsPanel analytics={snapshot?.decisionOutcomeAnalytics} />
            <DecisionQueueSummary
              decisions={decisions}
              filter={executionFilter}
              onFilterChange={setExecutionFilter}
            />
            <AgentDecisionPanel
              decisions={prioritizedDecisions}
              title="Decision inbox"
              description="Review the next landlord actions surfaced directly from your current analytics snapshot."
              emptyMessage="No prioritized landlord actions are surfaced for this view right now."
              period="90d"
            />
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
