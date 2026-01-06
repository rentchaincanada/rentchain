import React from "react";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { KpiStrip } from "../components/dashboard/KpiStrip";
import { ActionRequiredPanel } from "../components/dashboard/ActionRequiredPanel";
import { RecentEventsCard } from "../components/dashboard/RecentEventsCard";

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString();
  }
}

const DashboardPage: React.FC = () => {
  const { data, loading, error, refetch, lastUpdatedAt } = useDashboardSummary();

  const kpis = data?.kpis;
  const actions = data?.actions ?? [];
  const events = data?.events ?? [];

  const showEmptyCTA = !loading && !error && (kpis?.propertiesCount ?? 0) === 0;

  return (
    <MacShell title="RentChain · Dashboard">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
          padding: `${spacing.md}px ${spacing.lg}px`,
        }}
      >
        {error ? (
          <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
            <div style={{ fontWeight: 800, color: colors.danger, marginBottom: 8 }}>Couldn’t load dashboard</div>
            <div style={{ marginBottom: 12 }}>{error}</div>
            <Button onClick={refetch}>Retry</Button>
          </Card>
        ) : null}

        {showEmptyCTA ? (
          <Card
            style={{
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              background: colors.card,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>No properties yet</div>
            <div style={{ color: text.muted, marginBottom: 12 }}>
              Create your first property to start tracking tenants, rent, and records.
            </div>
            <Button onClick={() => { window.location.assign("/properties"); }}>Create property</Button>
          </Card>
        ) : null}

        <KpiStrip kpis={kpis} loading={loading} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: spacing.md,
          }}
        >
          <ActionRequiredPanel
            items={actions}
            loading={loading}
            viewAllEnabled={false}
          />
          <RecentEventsCard
            events={events}
            loading={loading}
            openLedgerEnabled={false}
          />
        </div>

        <Section>
          <div style={{ color: text.muted, fontSize: 12, textAlign: "right" }}>
            Last updated: {formatDate(lastUpdatedAt)}
          </div>
        </Section>
      </div>
    </MacShell>
  );
};

export default DashboardPage;
