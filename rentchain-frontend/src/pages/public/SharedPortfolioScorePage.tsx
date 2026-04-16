import React from "react";
import { useParams } from "react-router-dom";
import { fetchSharedPortfolioScore, type PortfolioScoreSharedViewV1 } from "../../api/publicPortfolioScoreApi";
import { Card, Section } from "../../components/ui/Ui";
import PortfolioScoreHeader from "../../components/portfolioScoreExternal/PortfolioScoreHeader";
import PortfolioScoreComponentList from "../../components/portfolioScoreExternal/PortfolioScoreComponentList";
import PortfolioScoreTrustPanel from "../../components/portfolioScoreExternal/PortfolioScoreTrustPanel";

export default function SharedPortfolioScorePage() {
  const { token = "" } = useParams();
  const [portfolioScore, setPortfolioScore] = React.useState<PortfolioScoreSharedViewV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchSharedPortfolioScore(token);
        if (!mounted) return;
        setPortfolioScore(response.portfolioScore);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "This shared score is unavailable.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)", padding: 24 }}>
      <Section style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Shared Portfolio Score™</h1>
            <div style={{ color: "#475569" }}>
              A landlord-approved view of portfolio consistency and operational quality over time.
            </div>
          </div>

          {loading ? <Card>Loading shared portfolio score…</Card> : null}
          {!loading && error ? <Card style={{ color: "#b91c1c" }}>Shared score unavailable: {error}</Card> : null}

          {!loading && !error && portfolioScore ? (
            <>
              <PortfolioScoreHeader portfolioScore={portfolioScore} />
              <PortfolioScoreComponentList components={portfolioScore.components} />
              <PortfolioScoreTrustPanel trust={portfolioScore.trust} />
            </>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
