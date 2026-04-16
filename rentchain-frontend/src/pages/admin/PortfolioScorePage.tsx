import React from "react";
import { useSearchParams } from "react-router-dom";
import { fetchPortfolioScore, type PortfolioScoreV1 } from "../../api/portfolioScoreApi";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import PortfolioScoreHeader from "../../components/portfolioScore/PortfolioScoreHeader";
import PortfolioScoreComponentsTable from "../../components/portfolioScore/PortfolioScoreComponentsTable";
import PortfolioScoreMetrics from "../../components/portfolioScore/PortfolioScoreMetrics";

export default function PortfolioScorePage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [portfolioId, setPortfolioId] = React.useState(searchParams.get("portfolioId") || "");
  const [portfolioScore, setPortfolioScore] = React.useState<PortfolioScoreV1 | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (nextPortfolioId: string) => {
      const safePortfolioId = String(nextPortfolioId || "").trim();
      if (!safePortfolioId) {
        setPortfolioScore(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetchPortfolioScore(safePortfolioId);
        setPortfolioScore(response.portfolioScore);
        setSearchParams({ portfolioId: safePortfolioId });
      } catch (err: any) {
        const message = err?.message || "Failed to load portfolio score";
        setPortfolioScore(null);
        setError(message);
        showToast({
          message: "Failed to load portfolio score",
          description: message,
          variant: "error",
        });
      } finally {
        setLoading(false);
      }
    },
    [setSearchParams, showToast]
  );

  React.useEffect(() => {
    const initialPortfolioId = searchParams.get("portfolioId") || "";
    if (initialPortfolioId) {
      setPortfolioId(initialPortfolioId);
      void load(initialPortfolioId);
    }
  }, [load, searchParams]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void load(portfolioId);
  };

  return (
    <MacShell title="Admin · Portfolio Score">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Portfolio Score™ Foundation</h1>
            <div style={{ color: "#475569", maxWidth: 820 }}>
              Internal, admin-only scoring foundation built from portfolio-level operational signals. Scores stay deterministic, explainable, and read-only in v1.
            </div>
          </div>
        </Section>

        <Card>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>Portfolio ID</span>
              <input
                aria-label="Portfolio ID"
                value={portfolioId}
                onChange={(event) => setPortfolioId(event.target.value)}
                placeholder="portfolio-123"
              />
            </label>
            <div>
              <Button type="submit" disabled={loading}>
                {loading ? "Loading..." : "Load portfolio score"}
              </Button>
            </div>
          </form>
        </Card>

        {loading ? <Card>Loading portfolio score…</Card> : null}
        {!loading && !error && !portfolioScore ? (
          <Card>Enter a portfolio ID to inspect the score, component breakdown, and operational metrics.</Card>
        ) : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load portfolio score: {error}</Card> : null}

        {!loading && !error && portfolioScore ? (
          <>
            <PortfolioScoreHeader portfolioScore={portfolioScore} />
            <PortfolioScoreComponentsTable components={portfolioScore.components} />
            <PortfolioScoreMetrics metrics={portfolioScore.metrics} />
          </>
        ) : null}
      </div>
    </MacShell>
  );
}

