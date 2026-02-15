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
import { useCapabilities } from "../hooks/useCapabilities";
import { useUpgrade } from "../context/UpgradeContext";
import { buildOnboardingSteps } from "../lib/onboardingSteps";
import { getApplicationPrereqState } from "../lib/applicationPrereqs";
import { CreatePropertyFirstModal } from "../components/properties/CreatePropertyFirstModal";
import { buildCreatePropertyUrl, buildReturnTo } from "../lib/propertyGate";
import { SendScreeningInviteModal } from "../components/screening/SendScreeningInviteModal";
import { SendApplicationModal } from "../components/properties/SendApplicationModal";
import { useUnitsForProperty } from "../hooks/useUnitsForProperty";
import { listReferrals } from "../api/referralsApi";
import { hasTier, normalizeTier } from "@/billing/requireTier";

const StarterOnboardingPanel = React.lazy(
  () => import("../components/dashboard/StarterOnboardingPanel")
);

class OnboardingErrorBoundary extends React.Component<
  { onError: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  private didLog = false;
  constructor(props: { onError: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    if (!this.didLog) {
      this.didLog = true;
      console.error("[onboarding] render crashed");
    }
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Get started</div>
          <div style={{ color: text.muted, marginBottom: 12 }}>
            Something went wrong while loading onboarding.
          </div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="ghost" onClick={() => window.location.assign("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}

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
  const { user, ready: authReady, isLoading: authLoading } = useAuth();
  const { caps } = useCapabilities();
  const { openUpgrade } = useUpgrade();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const apiBase = debugApiBase();
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const isMobile =
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false;
  const meLoaded = authReady && !authLoading && Boolean(user?.id);
  const roleLower = String(user?.role || "").toLowerCase();
  const isAdmin = roleLower === "admin";
  const isLandlord = roleLower === "landlord";
  const userTier = normalizeTier((caps?.plan as string) || user?.plan || null);
  const canUseProFeatures = isAdmin || hasTier(userTier, "pro");
  const canUseReferrals = isLandlord || isAdmin;
  const [properties, setProperties] = React.useState<any[]>([]);
  const [propsLoading, setPropsLoading] = React.useState(false);
  const [invitesCount, setInvitesCount] = React.useState(0);
  const [invitesLoading, setInvitesLoading] = React.useState(false);
  const [propertyGateOpen, setPropertyGateOpen] = React.useState(false);
  const [pendingPropertyAction, setPendingPropertyAction] = React.useState<"create_application" | null>(null);
  const [screeningInviteOpen, setScreeningInviteOpen] = React.useState(false);
  const [sendApplicationOpen, setSendApplicationOpen] = React.useState(false);
  const [modalPropertyId, setModalPropertyId] = React.useState<string | null>(null);
  const [modalUnitId, setModalUnitId] = React.useState<string | null>(null);
  const [onboardingChunkError, setOnboardingChunkError] = React.useState(false);
  const [referralsCount, setReferralsCount] = React.useState(0);
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
    let active = true;
    const loadReferrals = async () => {
      if (!meLoaded || !canUseReferrals) return;
      try {
        const rows = await listReferrals();
        if (active) setReferralsCount(rows.length);
      } catch {
        if (active) setReferralsCount(0);
      }
    };
    void loadReferrals();
    return () => {
      active = false;
    };
  }, [meLoaded, canUseReferrals]);

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
      console.debug("[onboarding]", {
        authReady,
        meLoaded,
        planLoaded: Boolean(user?.plan),
        isMobile,
      });
    }
  }, [authReady, meLoaded, user?.plan, isMobile]);

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
    screeningsCount: data?.kpis?.screeningsCount ?? 0,
  };
  const events = Array.isArray(data?.events) ? data.events : [];
  const fallbackActions = React.useMemo(() => {
    const items: Array<{ id: string; title: string; severity: "info"; href: string }> = [];
    if (userTier === "starter") {
      items.push({
        id: "upgrade-pro",
        title: "Upgrade to Pro to unlock screening",
        severity: "info",
        href: "/billing",
      });
      return items;
    }
    if ((kpis.screeningsCount ?? 0) === 0) {
      items.push({
        id: "run-first-screening",
        title: "Run your first screening",
        severity: "info",
        href: "/applications",
      });
    }
    if (tenantCount === 0) {
      items.push({
        id: "invite-tenant",
        title: "Invite a tenant",
        severity: "info",
        href: "/tenants",
      });
    }
    if (derivedPropertiesCount === 0) {
      items.push({
        id: "add-property",
        title: "Add a property",
        severity: "info",
        href: "/properties",
      });
    }
    return items;
  }, [derivedPropertiesCount, kpis.screeningsCount, tenantCount, userTier]);
  const actions = Array.isArray(data?.actions) && data.actions.length > 0 ? data.actions : fallbackActions;

  const dataReady =
    !loading && !propsLoading && !applicationsLoading && !tenantsLoading && !invitesLoading && !error;
  const countsReady = !propsLoading && !applicationsLoading && !tenantsLoading && !invitesLoading;
  const hasNoProperties = dataReady && (kpis?.propertiesCount ?? 0) === 0;
  const hasNoApplications = dataReady && applicationsCount === 0;
  const showEmptyCTA = hasNoProperties;
  const progressLoading = !dataReady || onboarding.loading;
  const showOnboardingSkeleton = onboarding.loading && !isAdmin;
  const showStarterOnboarding =
    meLoaded &&
    !onboarding.loading &&
    !onboarding.dismissed &&
    !onboardingChunkError;
  const showAdvancedCollapsed = showStarterOnboarding;

  const handleCreateApplicationClick = () => {
    const prereq = getApplicationPrereqState({
      propertiesCount: derivedPropertiesCount,
      unitsCount: derivedUnitsCount,
    });
    if (prereq.missingProperty) {
      track("onboarding_step_clicked", {
        stepKey: "applicationCreated",
        blockedBy: "no_property",
        source: "dashboard",
      });
      setPendingPropertyAction("create_application");
      setPropertyGateOpen(true);
      return;
    }
    track("onboarding_step_clicked", {
      stepKey: "applicationCreated",
      source: "dashboard",
    });
    setModalPropertyId(propertyOptions[0]?.id || null);
    setModalUnitId(null);
    setSendApplicationOpen(true);
  };

  const handleOpenScreeningInvite = () => {
    if (!canUseProFeatures) {
      track("gating_blocked", { featureName: "screening", requiredTier: "pro", userTier });
      openUpgrade({
        reason: "screening",
        plan: userTier,
        ctaLabel: "Upgrade to Pro",
        copy: {
          title: "Upgrade to Pro",
          body: "Screening is available on Pro plans. Upgrade to run screenings.",
        },
      });
      return;
    }
    setScreeningInviteOpen(true);
  };

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

  const propertyOptions = React.useMemo(
    () =>
      properties.map((p) => ({
        id: String(p?.id || p?.propertyId || ""),
        name: p?.name || p?.address || "Property",
      })).filter((p) => p.id),
    [properties]
  );

  const {
    units: modalUnits,
    loading: modalUnitsLoading,
    error: modalUnitsError,
    refetch: refetchModalUnits,
  } = useUnitsForProperty(modalPropertyId, sendApplicationOpen);

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
              <OnboardingErrorBoundary onError={() => setOnboardingChunkError(true)}>
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
              </OnboardingErrorBoundary>
            </React.Suspense>
            <Card style={{ padding: spacing.md }}>
              <div style={{ fontWeight: 700, marginBottom: spacing.sm }}>Quick actions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/properties")}
                  aria-label="Add property"
                  disabled={progressLoading}
                >
                  Add property
                </Button>
                <Button
                  variant="primary"
                  onClick={handleOpenScreeningInvite}
                  aria-label="Send screening invite"
                  disabled={progressLoading}
                >
                  Send screening invite
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const prereq = getApplicationPrereqState({
                      propertiesCount: derivedPropertiesCount,
                      unitsCount: derivedUnitsCount,
                    });
                    if (prereq.missingProperty) {
                      track("onboarding_step_clicked", {
                        stepKey: "applicationCreated",
                        blockedBy: "no_property",
                        source: "dashboard_quick_action",
                      });
                      setPendingPropertyAction("create_application");
                      setPropertyGateOpen(true);
                      return;
                    }
                    if (prereq.missingUnit) {
                      track("onboarding_step_clicked", {
                        stepKey: "applicationCreated",
                        blockedBy: "no_units",
                        source: "dashboard_quick_action",
                      });
                      // Units are optional for screening; don't block create application.
                    }
                    track("onboarding_step_clicked", {
                      stepKey: "applicationCreated",
                      source: "dashboard_quick_action",
                    });
                    handleCreateApplicationClick();
                  }}
                  aria-label="Send application link"
                  disabled={progressLoading}
                >
                  Send application link
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
            <Button onClick={handleCreateApplicationClick}>
              Send application link
            </Button>
          </Card>
        ) : null}

        {dataReady && !showEmptyCTA && hasNoApplications ? (
          <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Next: create an application</div>
            <div style={{ color: text.muted, marginBottom: 12 }}>
              Invite a tenant or start an application to begin screening.
            </div>
            <Button onClick={handleCreateApplicationClick}>
              Send application link
            </Button>
          </Card>
        ) : null}

        {dataReady && canUseReferrals ? (
          <Card style={{ padding: spacing.md, border: `1px solid ${colors.border}` }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Invite another landlord</div>
            <div style={{ color: text.muted, marginBottom: 12 }}>
              Referrals sent: {referralsCount}
            </div>
            <Button onClick={() => navigate("/referrals")}>Refer a landlord</Button>
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
              <ActionRequiredPanel
                items={actions}
                loading={loading}
                viewAllEnabled={false}
                title="Next actions"
                emptyLabel="No next actions right now."
              />
              <RecentEventsCard
                events={events}
                loading={loading}
                openLedgerEnabled={false}
                title="Recent activity"
                emptyLabel="No recent activity yet."
              />
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
            <ActionRequiredPanel
              items={actions}
              loading={loading}
              viewAllEnabled={false}
              title="Next actions"
              emptyLabel="No next actions right now."
            />
            <RecentEventsCard
              events={events}
              loading={loading}
              openLedgerEnabled={false}
              title="Recent activity"
              emptyLabel="No recent activity yet."
            />
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
      <CreatePropertyFirstModal
        open={propertyGateOpen}
        onClose={() => setPropertyGateOpen(false)}
        onCreate={() => {
          const returnTo = buildReturnTo(pendingPropertyAction || "create_application");
          navigate(buildCreatePropertyUrl(returnTo));
          setPropertyGateOpen(false);
        }}
      />
      <SendScreeningInviteModal
        open={screeningInviteOpen}
        onClose={() => setScreeningInviteOpen(false)}
        returnTo="/dashboard"
      />
      <SendApplicationModal
        open={sendApplicationOpen}
        onClose={() => setSendApplicationOpen(false)}
        properties={propertyOptions}
        propertyId={modalPropertyId}
        units={modalUnits}
        unitsLoading={modalUnitsLoading}
        unitsError={modalUnitsError}
        onUnitsRetry={refetchModalUnits}
        initialUnitId={modalUnitId}
        onPropertyChange={(nextId) => {
          setModalPropertyId(nextId);
          setModalUnitId(null);
        }}
        onUnitChange={(nextId) => setModalUnitId(nextId)}
      />
    </MacShell>
  );
};

export default DashboardPage;
