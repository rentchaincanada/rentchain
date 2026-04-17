import React from "react";
import { fetchLandlordActionRecommendations, type LandlordActionRecommendationV1 } from "../../api/landlordActionRecommendationsApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import { resolveRequiredPlanLabel } from "@/lib/upgradePrompt";
import RecommendationList from "../../components/actionRecommendations/RecommendationList";

export default function ActionRecommendationsPage() {
  const { showToast } = useToast();
  const {
    loading: entitlementLoading,
    canViewPortfolioScore,
    canViewActionRecommendations,
  } = useEntitlements();
  const [recommendations, setRecommendations] = React.useState<LandlordActionRecommendationV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (entitlementLoading || !canViewActionRecommendations) return;

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLandlordActionRecommendations();
        if (!mounted) return;
        setRecommendations(response.recommendations || []);
      } catch (err: any) {
        if (!mounted) return;
        const message = err?.message || "Failed to load recommended actions";
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
  }, [canViewActionRecommendations, entitlementLoading, showToast]);

  const recommendationsPlanLabel =
    resolveRequiredPlanLabel("portfolio_action_recommendations") || "Elite";

  return (
    <MacShell title="Recommended actions">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Recommended actions</h1>
            <div style={{ color: "#475569", maxWidth: 820 }}>
              A simple set of landlord-safe next steps based on your portfolio health, score, and recent direction.
            </div>
          </div>
        </Section>

        {entitlementLoading ? <Card>Loading recommended actions…</Card> : null}
        {!entitlementLoading && !canViewActionRecommendations && canViewPortfolioScore ? (
          <FeatureTeaser
            featureKey="portfolio_action_recommendations"
            eyebrow={`${recommendationsPlanLabel} intelligence`}
            title={`Unlock recommended actions on ${recommendationsPlanLabel}`}
            description="Recommended actions turn your portfolio health, score, and recent direction into prioritized next steps for daily follow-through."
            ctaLabel={`Upgrade to ${recommendationsPlanLabel}`}
          />
        ) : null}
        {!entitlementLoading && !canViewActionRecommendations && !canViewPortfolioScore ? (
          <LockedFeature
            featureKey="portfolio_action_recommendations"
            title={`Unlock recommended actions on ${recommendationsPlanLabel}`}
            description="Recommended actions sit on top of RentChain's higher-tier intelligence layer and add prioritized next steps based on your portfolio signals."
            hint="Portfolio health remains available now, while score and recommendations unlock as you move up the intelligence ladder."
            ctaLabel={`Upgrade to ${recommendationsPlanLabel}`}
          />
        ) : null}
        {!entitlementLoading && canViewActionRecommendations && loading ? <Card>Loading recommended actions…</Card> : null}
        {!entitlementLoading && canViewActionRecommendations && !loading && error ? (
          <Card style={{ color: "#b91c1c" }}>Failed to load recommended actions: {error}</Card>
        ) : null}
        {!entitlementLoading && canViewActionRecommendations && !loading && !error ? (
          <RecommendationList recommendations={recommendations} />
        ) : null}
      </div>
    </MacShell>
  );
}
