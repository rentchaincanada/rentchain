// rentchain-frontend/src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { DashboardKpiStrip } from "../components/dashboard/DashboardKpiStrip";
import { DashboardPropertyTable } from "../components/dashboard/DashboardPropertyTable";
import { DashboardAlertsPanel } from "../components/dashboard/DashboardAlertsPanel";
import { DashboardAiInsights } from "../components/dashboard/DashboardAiInsights";
import { DashboardRentCollectionChart } from "../components/dashboard/DashboardRentCollectionChart";
import { DashboardApplicationsChart } from "../components/dashboard/DashboardApplicationsChart";
import { DashboardPaymentBreakdownChart } from "../components/dashboard/DashboardPaymentBreakdownChart";
import { AiPortfolioDrawer } from "../components/dashboard/AiPortfolioDrawer";
import { useBlockchainVerify } from "../hooks/useBlockchainVerify";
import { DashboardActivityPanel } from "../components/dashboard/DashboardActivityPanel";
import { OnboardingWizard } from "../components/onboarding/OnBoardingWizard";
import { SoftLaunchChecklist } from "../components/dashboard/SoftLaunchChecklist";
import { PortfolioAiSummaryCard } from "../components/dashboard/PortfolioAiSummaryCard";
import { spacing, colors, text } from "../styles/tokens";
import { Card, Section, Button } from "../components/ui/Ui";
import { useAuth } from "../context/useAuth";
import { fetchOnboarding } from "../api/onboardingApi";
import { fetchMe } from "../api/meApi";
import { fetchAccountLimits, type AccountLimits } from "../api/accountApi";
import { setOnboardingStep } from "../api/onboardingApi";
import { useToast } from "../components/ui/ToastProvider";
import MicroLiveActivationPanel from "../components/MicroLiveActivationPanel";
import { useLedgerV2 } from "../hooks/useLedgerV2";
import { LedgerTimeline } from "../components/ledger/LedgerTimeline";
import { LedgerEventDrawer } from "../components/ledger/LedgerEventDrawer";

const DashboardPage: React.FC = () => {
  const { data, loading, error, refresh } = useBlockchainVerify();
  const { user } = useAuth();
  const [me, setMe] = useState<any | null>(null);
  const [limits, setLimits] = useState<AccountLimits | null>(null);
  const [onboarding, setOnboarding] = useState<any | null>(null);
  const {
    items: ledgerItems,
    loading: ledgerLoading,
    error: ledgerError,
    refresh: refreshLedger,
  } = useLedgerV2({ limit: 10 });
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("rentchain_onboarding_seen") === "true";
  });
  const navigate = useNavigate();
  const { showToast } = useToast();
  const limitsResp: any = limits ?? null;
  const limitsObj = limitsResp?.limits ?? limitsResp ?? {};
  const usageObj = limitsResp?.usage ?? limitsResp?.integrity?.after ?? {};
  const displayPlan = me?.plan ?? user?.plan ?? "starter"; // limits.plan is informational; do not override authenticated plan

  const unitsCount = usageObj?.units ?? 0;
  const propertiesCount = usageObj?.properties ?? 0;

  const unitsMax = limitsObj?.maxUnits ?? 0;
  const propertiesMax = limitsObj?.maxProperties ?? 0;

  const handleOpenOnboarding = () => {
    setShowOnboarding(true);
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    window.localStorage.setItem("rentchain_onboarding_seen", "true");
    setOnboardingSeen(true);
  };

  const handleLaunchAddPropertyFromWizard = () => {
    navigate("/properties?openAddProperty=1");
  };

  useEffect(() => {
    fetchOnboarding()
      .then(setOnboarding)
      .catch(() => setOnboarding(null));
  }, []);

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    fetchAccountLimits()
      .then(setLimits)
      .catch(() => setLimits(null));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const onboardingFlag = params.get("onboarding");
    if (onboardingFlag === "ready") {
      showToast({
        message: "Portfolio ready",
        description: "Dashboard KPIs are now live.",
        variant: "success",
      });
      void setOnboardingStep("viewDashboard", true).catch(() => {});
      params.delete("onboarding");
      const next = params.toString();
      const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState({}, "", url);
    }
  }, [showToast]);

  const integrityChip = useMemo(() => {
    if (loading) {
      return {
        label: "Integrity: checking…",
        color: text.muted,
        bg: colors.accentSoft,
        border: colors.border,
        tooltip:
          "Rebuilding the chain and comparing against the latest stored chain head snapshot.",
      };
    }

    if (error) {
      return {
        label: "Integrity: error",
        color: colors.danger,
        bg: "rgba(239,68,68,0.08)",
        border: colors.danger,
        tooltip: error,
      };
    }

    if (!data) {
      return {
        label: "Integrity: unknown",
        color: text.primary,
        bg: "#eef2f7",
        border: colors.border,
        tooltip:
          "No verification data yet. Use the Integrity page to run a full check.",
      };
    }

    if (data.ok && data.message?.includes("No chain head")) {
      return {
        label: "Integrity: not initialized",
        color: "#b45309",
        bg: "rgba(251,191,36,0.12)",
        border: "rgba(251,191,36,0.6)",
        tooltip:
          data.message ||
          "No chain head snapshots are stored yet. Record a payment to create the first snapshot.",
      };
    }

    if (data.ok) {
      return {
        label: "Integrity: verified ✓",
        color: "#15803d",
        bg: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.6)",
        tooltip:
          data.message ||
          "The recomputed chain head matches the stored snapshot for the latest tenant.",
      };
    }

    // ok === false
    const baseTooltip =
      data.reason ||
      data.message ||
      "The blockchain verification reported a mismatch.";
    const mismatchDetail =
      data.expected && data.actual
        ? `${baseTooltip} Expected hash ${data.expected.slice(
            0,
            12
          )}…, got ${data.actual.slice(0, 12)}….`
        : baseTooltip;

    return {
      label: "Integrity: mismatch ⚠",
      color: colors.danger,
      bg: "rgba(239,68,68,0.12)",
      border: colors.danger,
      tooltip: mismatchDetail,
    };
  }, [data, loading, error]);

  const usageIntegrityChip = useMemo(() => {
    const integ: any = (limits as any)?.integrity;

    if (!integ) {
      return {
        label: "Usage: N/A",
        border: "rgba(148,163,184,0.35)",
        bg: "rgba(148,163,184,0.10)",
        color: "#e2e8f0",
        tooltip: "No integrity data.",
      };
    }

    if (integ.ok === true) {
      return {
        label: "Integrity: OK",
        border: "rgba(34,197,94,0.45)",
        bg: "rgba(34,197,94,0.12)",
        color: "#15803d",
        tooltip: "Usage matches Firestore source-of-truth.",
      };
    }

    const before = integ.before;
    const after = integ.after;
    const tooltip = `Auto-corrected usage drift. Before: ${before?.properties ?? "?"} props, ${
      before?.units ?? "?"
    } units, ${before?.screeningsThisMonth ?? "?"} screenings → After: ${
      after?.properties ?? "?"
    } props, ${after?.units ?? "?"
    } units, ${after?.screeningsThisMonth ?? "?"} screenings`;

    return {
      label: "Integrity mismatch (auto-corrected)",
      border: "rgba(239,68,68,0.45)",
      bg: "rgba(239,68,68,0.12)",
      color: "#dc2626",
      tooltip,
    };
  }, [limits]);

  return (
    <MacShell title="RentChain · Dashboard">
      <div
        className="page-content"
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Plan: {displayPlan}</div>
          {limits ? (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.35)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Units: {unitsCount}/{unitsMax} · Properties: {propertiesCount}/{propertiesMax}
            </div>
          ) : null}
          {limits ? (
            <div
              title={usageIntegrityChip.tooltip}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${usageIntegrityChip.border}`,
                background: usageIntegrityChip.bg,
                color: usageIntegrityChip.color,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {usageIntegrityChip.label}
            </div>
          ) : null}
        </div>
        {onboarding?.completed && (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid #d1fae5",
              background: "#ecfdf5",
            }}
          >
            <strong>You’re Live.</strong> RentChain is now tracking your portfolio activity.
          </div>
        )}
        <Card elevated>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: 0,
                  color: text.primary,
                }}
              >
                Portfolio overview
              </h1>
              <div
                style={{
                  marginTop: "0.1rem",
                  fontSize: "0.95rem",
                  color: text.muted,
                }}
              >
                High-level health across properties, tenants, and collections.
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={refresh}
              title={integrityChip.tooltip}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                border: `1px solid ${integrityChip.border}`,
                backgroundColor: integrityChip.bg,
                color: integrityChip.color,
                fontSize: "0.82rem",
                padding: "0.45rem 0.9rem",
                boxShadow: "none",
              }}
            >
              <span
                style={{
                  width: "0.55rem",
                  height: "0.55rem",
                  borderRadius: "999px",
                  backgroundColor: integrityChip.color,
                }}
              />
              <span>{integrityChip.label}</span>
            </Button>
            <div
              style={{
                alignSelf: "center",
                padding: "6px 10px",
                borderRadius: 12,
                border: "1px solid rgba(59,130,246,0.3)",
                background: "rgba(59,130,246,0.08)",
                color: text.primary,
                fontSize: "0.9rem",
              }}
            >
              Screening credits: {user?.screeningCredits ?? 0}
            </div>
          </div>

          {!onboardingSeen && (
            <Section
              style={{
                marginTop: spacing.md,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <div style={{ fontSize: 13, color: text.primary }}>
                Get set up in a few steps: pick a plan, add your first property,
                and start tracking tenants and payments.
              </div>
              <Button
                variant="secondary"
                onClick={handleOpenOnboarding}
                style={{ padding: "8px 14px" }}
              >
                Launch setup
              </Button>
            </Section>
          )}
        </Card>

        <Card elevated>
          <DashboardKpiStrip />
        </Card>

        <Section title="Recent Ledger Activity">
          <Card>
            {ledgerError ? (
              <p style={{ color: "red" }}>{ledgerError}</p>
            ) : ledgerLoading ? (
              <p>Loading timeline…</p>
            ) : (
              <LedgerTimeline
                items={ledgerItems}
                emptyText="No recent ledger activity"
                onSelect={(id) => setSelectedLedgerId(id)}
              />
            )}
          </Card>
        </Section>

        <MicroLiveActivationPanel />

        <SoftLaunchChecklist
          hasProperty={false}
          hasApplication={false}
          phoneVerified={false}
          referencesContacted={false}
          screeningRun={false}
          pdfDownloaded={false}
          billingViewed={false}
        />

        <PortfolioAiSummaryCard />

        <AiPortfolioDrawer />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: spacing.lg,
            alignItems: "stretch",
          }}
        >
          <Card
            elevated
            style={{
              height: "100%",
              minWidth: 0,
              maxHeight: 520,
              overflow: "auto",
            }}
          >
            <DashboardPropertyTable />
          </Card>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
              minWidth: 0,
            }}
          >
            <Section>
              <DashboardAlertsPanel />
            </Section>
            <Section>
              <DashboardAiInsights />
            </Section>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: spacing.lg,
          }}
        >
          <Section style={{ minWidth: 0 }}>
            <DashboardRentCollectionChart />
          </Section>
          <Section style={{ minWidth: 0 }}>
            <DashboardPaymentBreakdownChart />
          </Section>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: spacing.lg,
          }}
        >
          <Section style={{ minWidth: 0 }}>
            <DashboardApplicationsChart />
          </Section>
          <Section style={{ minWidth: 0 }}>
            <DashboardActivityPanel />
          </Section>
        </div>
      </div>
      {selectedLedgerId ? (
        <LedgerEventDrawer eventId={selectedLedgerId} onClose={() => setSelectedLedgerId(null)} />
      ) : null}

      <OnboardingWizard
        open={showOnboarding}
        onClose={handleCloseOnboarding}
        onLaunchAddProperty={handleLaunchAddPropertyFromWizard}
      />
    </MacShell>
  );

export default DashboardPage;
