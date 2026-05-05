import React from "react";
import { useSearchParams } from "react-router-dom";
import { createPortfolioScoreSnapshot, fetchPortfolioScoreTrend, type PortfolioScoreTrendV1 } from "../../api/portfolioScoreHistoryApi";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import PortfolioScoreTrendHeader from "../../components/portfolioScoreHistory/PortfolioScoreTrendHeader";
import PortfolioScoreMoverList from "../../components/portfolioScoreHistory/PortfolioScoreMoverList";
import PortfolioScoreHistoryTable from "../../components/portfolioScoreHistory/PortfolioScoreHistoryTable";

export default function PortfolioScoreHistoryPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [portfolioId, setPortfolioId] = React.useState(searchParams.get("portfolioId") || "");
  const [trend, setTrend] = React.useState<PortfolioScoreTrendV1 | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [snapshotLoading, setSnapshotLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const hasHandledInitialSearch = React.useRef(false);

  const load = React.useCallback(
    async (nextPortfolioId: string) => {
      const safePortfolioId = String(nextPortfolioId || "").trim();
      if (!safePortfolioId) {
        setTrend(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetchPortfolioScoreTrend(safePortfolioId, 12);
        setTrend(response.trend);
        setSearchParams({ portfolioId: safePortfolioId });
      } catch (err: any) {
        const message = err?.message || "Failed to load portfolio score history";
        setTrend(null);
        setError(message);
        showToast({
          message: "Failed to load portfolio score history",
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
    if (initialPortfolioId && (!hasHandledInitialSearch.current || initialPortfolioId !== portfolioId)) {
      hasHandledInitialSearch.current = true;
      setPortfolioId(initialPortfolioId);
      void load(initialPortfolioId);
      return;
    }
    hasHandledInitialSearch.current = true;
  }, [load, portfolioId, searchParams]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void load(portfolioId);
  };

  const handleCreateSnapshot = async () => {
    const safePortfolioId = String(portfolioId || "").trim();
    if (!safePortfolioId) return;
    try {
      setSnapshotLoading(true);
      await createPortfolioScoreSnapshot(safePortfolioId);
      await load(safePortfolioId);
    } catch (err: any) {
      showToast({
        message: "Failed to create score snapshot",
        description: err?.message || "Unknown error",
        variant: "error",
      });
    } finally {
      setSnapshotLoading(false);
    }
  };

  return (
    <MacShell title="Admin · Portfolio Score History">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Portfolio Score™ History + Trend</h1>
            <div style={{ color: "#475569", maxWidth: 820 }}>
              Internal, admin-only history layer for tracking how a portfolio score moves over time and which components changed most.
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
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button type="submit" disabled={loading}>
                {loading ? "Loading..." : "Load history"}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCreateSnapshot} disabled={snapshotLoading || !portfolioId.trim()}>
                {snapshotLoading ? "Creating..." : "Create snapshot"}
              </Button>
            </div>
          </form>
        </Card>

        {loading ? <Card>Loading portfolio score history…</Card> : null}
        {!loading && !error && !trend ? (
          <Card>Enter a portfolio ID to inspect score history, trend direction, and component movers.</Card>
        ) : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load portfolio score history: {error}</Card> : null}

        {!loading && !error && trend ? (
          <>
            <PortfolioScoreTrendHeader trend={trend} />
            <PortfolioScoreMoverList movers={trend.movers} />
            <PortfolioScoreHistoryTable history={trend.history} />
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
