import React from "react";
import { fetchLandlordPortfolioHealth, type LandlordPortfolioHealthSummaryV1 } from "../../api/landlordPortfolioHealthApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import PortfolioHealthStatusCard from "../../components/portfolioHealth/PortfolioHealthStatusCard";
import PortfolioHealthDimensionList from "../../components/portfolioHealth/PortfolioHealthDimensionList";
import PortfolioHealthNextFocusList from "../../components/portfolioHealth/PortfolioHealthNextFocusList";

export default function PortfolioHealthSummaryPage() {
  const { showToast } = useToast();
  const [summary, setSummary] = React.useState<LandlordPortfolioHealthSummaryV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLandlordPortfolioHealth();
        if (!mounted) return;
        setSummary(response.portfolioHealth);
      } catch (err: any) {
        if (!mounted) return;
        const message = err?.message || "Failed to load portfolio health summary";
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
  }, [showToast]);

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

        {loading ? <Card>Loading portfolio health…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load portfolio health: {error}</Card> : null}

        {!loading && !error && summary ? (
          <>
            <PortfolioHealthStatusCard summary={summary} />
            <PortfolioHealthDimensionList dimensions={summary.dimensions} />
            <PortfolioHealthNextFocusList nextFocus={summary.nextFocus} />
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
