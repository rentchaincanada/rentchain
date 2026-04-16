import React from "react";
import { fetchLandlordActionRecommendations, type LandlordActionRecommendationV1 } from "../../api/landlordActionRecommendationsApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import RecommendationList from "../../components/actionRecommendations/RecommendationList";

export default function ActionRecommendationsPage() {
  const { showToast } = useToast();
  const [recommendations, setRecommendations] = React.useState<LandlordActionRecommendationV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
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
  }, [showToast]);

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

        {loading ? <Card>Loading recommended actions…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load recommended actions: {error}</Card> : null}
        {!loading && !error ? <RecommendationList recommendations={recommendations} /> : null}
      </div>
    </MacShell>
  );
}
