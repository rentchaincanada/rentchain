import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import { KpiStrip } from "../components/dashboard/KpiStrip";
import { ActionRequiredPanel } from "../components/dashboard/ActionRequiredPanel";
import { RecentEventsCard } from "../components/dashboard/RecentEventsCard";
import { debugApiBase } from "@/api/baseUrl";
import { fetchDashboardSummary } from "../api/dashboard";
import { fetchProperties } from "../api/propertiesApi";
import { unitsForProperty } from "../lib/propertyCounts";
import { useApplications } from "../hooks/useApplications";
import { useOnboardingState } from "../hooks/useOnboardingState";
import { useTenants } from "../hooks/useTenants";
import { listTenantInvites } from "../api/tenantInvites";
import { track } from "../lib/analytics";
import { useAuth } from "../context/useAuth";
import { useToast } from "../components/ui/ToastProvider";
import { buildOnboardingSteps } from "../lib/onboardingSteps";

const StarterOnboardingPanel = React.lazy(
  () => import("../components/dashboard/StarterOnboardingPanel")
);

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
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null);
  const { applications, loading: applicationsLoading } = useApplications();
  const { tenants, loading: tenantsLoading } = useTenants();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const apiBase = debugApiBase();
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const [properties, setProperties] = React.useState<any[]>([]);
  const [propsLoading, setPropsLoading] = React.useState(false);
  const [invitesCount, setInvitesCount] = React.useState(0);
  const [invitesLoading, setInvitesLoading] = React.useState(false);
  const onboarding = useOnboardingState();
  const prevDerivedRef = React.useRef({
    propertyAdded: false,
    unitAdded: false,
    tenantInvited: false,
    applicationCreated: false,
  });
  const nudgeReadyRef = React.useRef(false);
  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await fetchDashboardSummary();
      setData(summary);
      setLastUpdatedAt(Date.now());
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);
  const refetch = React.useCallback(() => {
    void loadDashboard();
  }, [loadDashboard]);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
    let alive = true;
    const loadInvites = async () => {
      try {
        setInvitesLoading(true);
        const res = await listTenantInvites();
        if (alive) {
          setInvitesCount(Array.isArray(res?.items) ? res.items.length : 0);
        }
      } catch {
        if (alive) setInvitesCount(0);
      } finally {
        if (alive) setInvitesLoading(false);
      }
    };
    void loadInvites();
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
        loadingSummary: loading,
        applicationsLoading,
        propsLoading,
        propertiesCount: properties?.length ?? null,
        applicationsCount: applications?.length ?? null,
      });
    }
  }, [loading, applicationsLoading, propsLoading, properties, applications]);

  const derivedPropertiesCount = properties.length;
  const derivedUnitsCount = properties.reduce((sum, p) => sum + unitsForProperty(p), 0);
  const applicationsCount = applications.length;
  const tenantCount = tenants.length;
  const kpis = {
    propertiesCount: derivedPropertiesCount,
    unitsCount: derivedUnitsCount,
    tenantsCount: data?.kpis?.tenantsCount ?? 0,
    openActionsCount: data?.kpis?.openActionsCount ?? 0,
    delinquentCount: data?.kpis?.delinquentCount ?? 0,
  };
  const actions = data?.actions ?? [];
  const events = data?.events ?? [];

  const dataReady =
    !loading && !propsLoading && !applicationsLoading && !tenantsLoading && !invitesLoading && !error;
  const countsReady = !propsLoading && !applicationsLoading && !tenantsLoading && !invitesLoading;
  const hasNoProperties = dataReady && (kpis?.propertiesCount ?? 0) === 0;
  const hasNoApplications = dataReady && applicationsCount === 0;
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const showEmptyCTA = hasNoProperties;
  const progressLoading = !dataReady || onboarding.loading;
  const showOnboardingSkeleton = onboarding.loading && !isAdmin;
  const showStarterOnboarding = !onboarding.loading && !onboarding.dismissed;
  const showAdvancedCollapsed = showStarterOnboarding;

  const derivedSteps = {
    propertyAdded: derivedPropertiesCount > 0,
    unitAdded: derivedUnitsCount > 0,
    tenantInvited: tenantCount > 0 || invitesCount > 0,
    applicationCreated: applicationsCount > 0,
  };

  React.useEffect(() => {
    if (progressLoading || !countsReady) return;
    (Object.keys(derivedSteps) as Array<keyof typeof derivedSteps>).forEach((key) => {
      if (derivedSteps[key] && !onboarding.steps[key]) {
        onboarding.markStepComplete(key, "derived");
      }
    });
  }, [derivedSteps, onboarding, progressLoading, countsReady]);

  React.useEffect(() => {
    if (progressLoading || !countsReady) return;
    if (!nudgeReadyRef.current) {
      nudgeReadyRef.current = true;
      prevDerivedRef.current = {
        propertyAdded: derivedSteps.propertyAdded,
        unitAdded: derivedSteps.unitAdded,
        tenantInvited: derivedSteps.tenantInvited,
        applicationCreated: derivedSteps.applicationCreated,
      };
      return;
    }
    const prev = prevDerivedRef.current;
    if (!prev.propertyAdded && derivedSteps.propertyAdded) {
      showToast({ message: "Nice — add units next.", variant: "success" });
    } else if (!prev.unitAdded && derivedSteps.unitAdded) {
      showToast({ message: "Great — invite a tenant next.", variant: "success" });
    } else if (!prev.tenantInvited && derivedSteps.tenantInvited) {
      showToast({ message: "Invite sent — create an application next.", variant: "success" });
    } else if (!prev.applicationCreated && derivedSteps.applicationCreated) {
      showToast({ message: "Application started — preview export next.", variant: "success" });
    }
    prevDerivedRef.current = {
      propertyAdded: derivedSteps.propertyAdded,
      unitAdded: derivedSteps.unitAdded,
      tenantInvited: derivedSteps.tenantInvited,
      applicationCreated: derivedSteps.applicationCreated,
    };
  }, [derivedSteps, progressLoading, showToast, countsReady]);

  React.useEffect(() => {
    if (!showStarterOnboarding || onboarding.loading) return;
    track("onboarding_viewed");
  }, [showStarterOnboarding, onboarding.loading]);

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

        {!dataReady && !error ? (
          <Card
            style={{
              padding: spacing.md,
              border: `1px solid ${colors.border}`,
              background: colors.card,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Loading your dashboard...</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ height: 12, borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
              <div style={{ height: 12, width: "80%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
              <div style={{ height: 12, width: "60%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
              <div style={{ height: 180, borderRadius: 12, background: "rgba(15,23,42,0.05)" }} />
            </div>
          </Card>
        ) : null}

        {showOnboardingSkeleton ? (
          <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Get started</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ height: 12, borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
              <div style={{ height: 12, width: "70%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
              <div style={{ height: 12, width: "85%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
              <div style={{ height: 12, width: "55%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
            </div>
          </Card>
        ) : null}

        {showStarterOnboarding && !isAdmin ? (
          <>
            <React.Suspense
              fallback={
                <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Get started</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ height: 12, borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
                    <div style={{ height: 12, width: "70%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
                    <div style={{ height: 12, width: "85%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
                    <div style={{ height: 12, width: "55%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
                  </div>
                </Card>
              }
            >
              <StarterOnboardingPanel
                steps={buildOnboardingSteps({
                  onboarding,
                  navigate,
                  track,
                  propertiesCount: derivedPropertiesCount,
                  unitsCount: derivedUnitsCount,
                })}
                loading={progressLoading}
                onDismiss={() => onboarding.dismissOnboarding()}
              />
            </React.Suspense>
            <Card style={{ padding: spacing.md }}>
              <div style={{ fontWeight: 700, marginBottom: spacing.sm }}>Quick actions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
                <Button
                  onClick={() => navigate("/properties")}
                  aria-label="Add property"
                  disabled={progressLoading}
                >
                  Add property
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (derivedPropertiesCount === 0) {
                      track("onboarding_step_clicked", {
                        stepKey: "applicationCreated",
                        blockedBy: "no_property",
                        source: "dashboard_quick_action",
                      });
                      navigate("/properties?focus=addProperty");
                      return;
                    }
                    if (derivedUnitsCount === 0) {
                      track("onboarding_step_clicked", {
                        stepKey: "applicationCreated",
                        blockedBy: "no_units",
                        source: "dashboard_quick_action",
                      });
                      navigate("/properties?openAddUnit=1");
                      return;
                    }
                    track("onboarding_step_clicked", {
                      stepKey: "applicationCreated",
                      source: "dashboard_quick_action",
                    });
                    navigate("/applications?openSendApplication=1");
                  }}
                  aria-label="Create application"
                  disabled={progressLoading}
                >
                  Create application
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/site/legal")}
                  aria-label="View templates"
                  disabled={progressLoading}
                >
                  View templates
                </Button>
              </div>
            </Card>
          </>
        ) : null}

        {!progressLoading && onboarding.dismissed && !isAdmin ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: text.muted }}>
            <span>Onboarding hidden.</span>
            <button
              type="button"
              onClick={() => onboarding.showOnboarding()}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                color: colors.accent,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Show onboarding
            </button>
          </div>
        ) : null}

        {dataReady && showEmptyCTA ? (
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

        {dataReady &&
        !showStarterOnboarding &&
        derivedSteps.propertyAdded &&
        derivedSteps.unitAdded &&
        derivedSteps.tenantInvited ? (
          <Card style={{ padding: spacing.md }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Your portfolio is set up 🎉</div>
            <div style={{ color: text.muted, marginBottom: 12 }}>
              Next up: create your first application.
            </div>
            <Button onClick={() => navigate("/applications?openSendApplication=1")}>Create application</Button>
          </Card>
        ) : null}

        {dataReady && !showEmptyCTA && hasNoApplications ? (
          <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Next: create an application</div>
            <div style={{ color: text.muted, marginBottom: 12 }}>
              Invite a tenant or start an application to begin screening.
            </div>
            <Button onClick={() => navigate("/applications?openSendApplication=1")}>Create application</Button>
          </Card>
        ) : null}

        {dataReady ? <KpiStrip kpis={kpis} loading={loading} /> : null}

        {dataReady && showAdvancedCollapsed ? (
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
        ) : dataReady ? (
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
        ) : null}

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
