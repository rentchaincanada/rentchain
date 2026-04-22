import React from "react";
import { useLocation } from "react-router-dom";
import { fetchLandlordPortfolioHealth, type LandlordPortfolioHealthSummaryV1 } from "../../api/landlordPortfolioHealthApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import { resolveRequiredPlanLabel } from "@/lib/upgradePrompt";
import PortfolioHealthStatusCard from "../../components/portfolioHealth/PortfolioHealthStatusCard";
import PortfolioHealthDimensionList from "../../components/portfolioHealth/PortfolioHealthDimensionList";
import PortfolioHealthNextFocusList from "../../components/portfolioHealth/PortfolioHealthNextFocusList";
import PortfolioFeedbackSummary from "../../components/portfolioHealth/PortfolioFeedbackSummary";

export default function PortfolioHealthSummaryPage() {
  const location = useLocation();
  const { showToast } = useToast();
  const {
    loading: entitlementLoading,
    canViewPortfolioHealthSummary,
    canViewPortfolioScore,
    canViewActionRecommendations,
  } = useEntitlements();
  const [summary, setSummary] = React.useState<LandlordPortfolioHealthSummaryV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const entryParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const entry = entryParams.get("entry");
  const entryPropertyId = entryParams.get("propertyId");
  const entryMessage =
    entry === "lease-renewals"
      ? entryPropertyId
        ? "Opened from decisions to review lease-renewal pressure for a specific property."
        : "Opened from decisions to review lease-renewal pressure."
      : null;

  React.useEffect(() => {
    if (entitlementLoading || !canViewPortfolioHealthSummary) return;

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLandlordPortfolioHealth();
        if (!mounted) return;
        setSummary(response.portfolioHealth);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error && err.message ? err.message : "Failed to load portfolio health summary";
        setError(message);
        showToast({
          message: "Failed to load portfolio health summary",
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
  }, [canViewPortfolioHealthSummary, entitlementLoading, showToast]);

  const scorePlanLabel = resolveRequiredPlanLabel("portfolio_score") || "Pro";
  const recommendationsPlanLabel =
    resolveRequiredPlanLabel("portfolio_action_recommendations") || "Elite";

  return (
    <MacShell title="Portfolio health">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Portfolio health</h1>
            <div style={{ color: "#475569", maxWidth: 820 }}>
              A high-level view of overall portfolio health, recent direction, and where follow-through may help most.
            </div>
          </div>
        </Section>

        {entryMessage ? (
          <Card style={{ borderColor: "#99f6e4", background: "#f0fdfa", color: "#115e59" }}>{entryMessage}</Card>
        ) : null}

        {entitlementLoading ? <Card>Loading portfolio health…</Card> : null}
        {!entitlementLoading && !canViewPortfolioHealthSummary ? (
          <Card style={{ color: "#b91c1c" }}>Portfolio health is currently unavailable for this account.</Card>
        ) : null}
        {!entitlementLoading && canViewPortfolioHealthSummary && loading ? <Card>Loading portfolio health…</Card> : null}
        {!entitlementLoading && canViewPortfolioHealthSummary && !loading && error ? (
          <Card style={{ color: "#b91c1c" }}>Failed to load portfolio health: {error}</Card>
        ) : null}

        {!entitlementLoading && canViewPortfolioHealthSummary && !loading && !error && summary ? (
          <>
            <PortfolioHealthStatusCard summary={summary} />
            <PortfolioHealthDimensionList dimensions={summary.dimensions} />
            <PortfolioFeedbackSummary summaries={summary.feedback?.summaries || []} />
            <PortfolioHealthNextFocusList nextFocus={summary.nextFocus} />
            {!canViewPortfolioScore ? (
              <FeatureTeaser
                featureKey="portfolio_score"
                eyebrow={`${scorePlanLabel} intelligence`}
                title={`Unlock Portfolio Score™ on ${scorePlanLabel}`}
                description="Move from a high-level health view into a structured portfolio score with grade, trend, and component-level context."
                ctaLabel={`Upgrade to ${scorePlanLabel}`}
              />
            ) : null}
            {canViewPortfolioScore && !canViewActionRecommendations ? (
              <FeatureTeaser
                featureKey="portfolio_action_recommendations"
                eyebrow={`${recommendationsPlanLabel} intelligence`}
                title={`Unlock recommended actions on ${recommendationsPlanLabel}`}
                description="Add prioritized landlord-safe next steps so your portfolio health and score turn into clearer daily follow-through."
                ctaLabel={`Upgrade to ${recommendationsPlanLabel}`}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
