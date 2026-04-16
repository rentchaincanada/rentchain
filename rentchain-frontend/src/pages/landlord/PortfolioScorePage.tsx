import React from "react";
import { fetchLandlordPortfolioScore, type PortfolioScoreExternalV1 } from "../../api/landlordPortfolioScoreApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import PortfolioScoreHeader from "../../components/portfolioScoreExternal/PortfolioScoreHeader";
import PortfolioScoreComponentList from "../../components/portfolioScoreExternal/PortfolioScoreComponentList";
import PortfolioScoreTrustPanel from "../../components/portfolioScoreExternal/PortfolioScoreTrustPanel";

export default function PortfolioScorePage() {
  const { showToast } = useToast();
  const [portfolioScore, setPortfolioScore] = React.useState<PortfolioScoreExternalV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLandlordPortfolioScore();
        if (!mounted) return;
        setPortfolioScore(response.portfolioScore);
      } catch (err: any) {
        if (!mounted) return;
        const message = err?.message || "Failed to load portfolio score";
        setError(message);
        showToast({
          message: "Failed to load portfolio score",
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
    <MacShell title="Portfolio score">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Portfolio Score™</h1>
            <div style={{ color: "#475569", maxWidth: 820 }}>
              A structured view of how consistently your portfolio operations are performing over time.
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading portfolio score…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load portfolio score: {error}</Card> : null}

        {!loading && !error && portfolioScore ? (
          <>
            <PortfolioScoreHeader portfolioScore={portfolioScore} />
            <PortfolioScoreComponentList components={portfolioScore.components} />
            <PortfolioScoreTrustPanel trust={portfolioScore.trust} />
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
