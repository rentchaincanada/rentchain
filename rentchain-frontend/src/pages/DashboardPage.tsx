import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { KpiStrip } from "../components/dashboard/KpiStrip";
import { ActionRequiredPanel } from "../components/dashboard/ActionRequiredPanel";
import { RecentEventsCard } from "../components/dashboard/RecentEventsCard";
import { debugApiBase } from "@/api/baseUrl";
import { fetchProperties } from "../api/propertiesApi";
import { unitsForProperty } from "../lib/propertyCounts";
import { useApplications } from "../hooks/useApplications";
import { useSubscription } from "../context/SubscriptionContext";
import { planLabel } from "../lib/plan";
import StarterOnboardingPanel from "../components/dashboard/StarterOnboardingPanel";

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
  const { applications, loading: applicationsLoading } = useApplications();
  const { plan, loading: planLoading } = useSubscription();
  const navigate = useNavigate();
  const apiBase = debugApiBase();
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const [properties, setProperties] = React.useState<any[]>([]);
  const [propsLoading, setPropsLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const loadProps = async () => {
      try {
        setPropsLoading(true);
        const res: any = await fetchProperties();
        const list = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.properties)
          ? res.properties
          : Array.isArray(res)
          ? res
          : [];
        if (alive) setProperties(list);
      } catch {
        if (alive) setProperties([]);
      } finally {
        if (alive) setPropsLoading(false);
      }
    };
    void loadProps();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (showDebug) {
      console.log("[debug] apiBase", apiBase);
    }
  }, [showDebug, apiBase]);

  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[dashboard gates]", {
        plan,
        planLoading,
        loadingSummary: loading,
        applicationsLoading,
        propsLoading,
        propertiesCount: properties?.length ?? null,
        applicationsCount: applications?.length ?? null,
      });
    }
  }, [plan, planLoading, loading, applicationsLoading, propsLoading, properties, applications]);

  const derivedPropertiesCount = properties.length;
  const derivedUnitsCount = properties.reduce((sum, p) => sum + unitsForProperty(p), 0);
  const applicationsCount = applications.length;
  const screeningStartedCount = applications.filter((app) => app.screeningId || app.screeningRequestId).length;
  const kpis = {
    propertiesCount: derivedPropertiesCount,
    unitsCount: derivedUnitsCount,
    tenantsCount: data?.kpis?.tenantsCount ?? 0,
    openActionsCount: data?.kpis?.openActionsCount ?? 0,
    delinquentCount: data?.kpis?.delinquentCount ?? 0,
  };
  const actions = data?.actions ?? [];
  const events = data?.events ?? [];

  const planReady = !planLoading;
  const dataReady = !loading && !propsLoading && !applicationsLoading && !error;
  const isStarter = plan === "starter";
  const hasNoProperties = dataReady && (kpis?.propertiesCount ?? 0) === 0;
  const hasNoApplications = dataReady && applicationsCount === 0;
  const showEmptyCTA = planReady && hasNoProperties;
  const showStarterOnboarding = planReady && isStarter;
  const showAdvancedCollapsed = showStarterOnboarding;
  const planName = planLabel(plan);

  return (
    <MacShell title="RentChain · Dashboard" showTopNav={false}>
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
            <div style={{ fontWeight: 800, color: colors.danger, marginBottom: 8 }}>Couldn't load dashboard</div>
            <div style={{ marginBottom: 12 }}>{error}</div>
            <Button onClick={refetch}>Retry</Button>
          </Card>
        ) : null}

        {!planReady ? (
          <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Loading your dashboard…</div>
            <div style={{ color: text.muted }}>Preparing your plan and next steps.</div>
          </Card>
        ) : null}

        {showStarterOnboarding ? (
          <>
            <StarterOnboardingPanel
              planName={planName}
              propertiesCount={kpis.propertiesCount}
              applicationsCount={applicationsCount}
              screeningStartedCount={screeningStartedCount}
              onAddProperty={() => navigate("/properties")}
              onCreateApplication={() => navigate("/applications")}
              onStartScreening={() => navigate("/applications")}
              onUpgrade={() => navigate("/pricing")}
            />
            <Card style={{ padding: spacing.md }}>
              <div style={{ fontWeight: 700, marginBottom: spacing.sm }}>Quick actions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
                <Button onClick={() => navigate("/properties")} aria-label="Add property">
                  Add property
                </Button>
                <Button variant="secondary" onClick={() => navigate("/applications")} aria-label="Start screening">
                  Start screening
                </Button>
                <Button variant="ghost" onClick={() => navigate("/site/legal")} aria-label="View templates">
                  View templates
                </Button>
              </div>
            </Card>
          </>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
              <Button onClick={() => navigate("/properties")}>Add property</Button>
              <Link to="/help/landlords" style={{ alignSelf: "center", color: colors.accent }}>
                Learn more
              </Link>
            </div>
          </Card>
        ) : null}

        {!showEmptyCTA && hasNoApplications ? (
          <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Next: create an application</div>
            <div style={{ color: text.muted, marginBottom: 12 }}>
              Invite a tenant or start an application to begin screening.
            </div>
            <Button onClick={() => navigate("/applications")}>Go to applications</Button>
          </Card>
        ) : null}

        <KpiStrip kpis={kpis} loading={loading} />

        {showAdvancedCollapsed ? (
          <details
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: spacing.md,
              background: colors.card,
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>More insights</summary>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: spacing.md,
                marginTop: spacing.md,
              }}
            >
              <ActionRequiredPanel items={actions} loading={loading} viewAllEnabled={false} />
              <RecentEventsCard events={events} loading={loading} openLedgerEnabled={false} />
            </div>
          </details>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: spacing.md,
            }}
          >
            <ActionRequiredPanel items={actions} loading={loading} viewAllEnabled={false} />
            <RecentEventsCard events={events} loading={loading} openLedgerEnabled={false} />
          </div>
        )}

        <Section>
          <div style={{ color: text.muted, fontSize: 12, textAlign: "right" }}>
            Last updated: {formatDate(lastUpdatedAt)}
          </div>
        </Section>

        {showDebug ? (
          <Section>
            <div style={{ color: text.muted, fontSize: 12 }}>
              API Base: {apiBase.normalized || "(relative)"}
            </div>
            <div style={{ color: text.muted, fontSize: 12 }}>
              API Base Raw: {apiBase.raw ?? "(unset)"}
            </div>
          </Section>
        ) : null}
      </div>
    </MacShell>
  );
};

export default DashboardPage;
