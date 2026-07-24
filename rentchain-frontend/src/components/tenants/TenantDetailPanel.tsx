// rentchain-frontend/src/components/tenants/TenantDetailPanel.tsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantDetail } from "../../hooks/useTenantDetail";
import { downloadTenantReport } from "@/api/tenantsApi";
import {
  fetchTenantFinancialActivity,
  updateTenantMoveInReadiness,
  type FinancialProjectionRow,
  type MoveInReadiness,
} from "@/api/tenantDetail";
import { getTenantSignals, type TenantSignals } from "@/api/tenantSignals";
import { fetchLedger } from "@/api/ledgerApi";
import { fetchLeaseLedger, type LeaseLedgerEntry } from "@/api/leaseLedgerApi";
import { LedgerTimeline } from "../ledger/LedgerTimeline";
import { VerifyLedgerButton } from "../ledger/VerifyLedgerButton";
import { RecordTenantEventModal } from "./RecordTenantEventModal";
import { CreateNoticeModal } from "./CreateNoticeModal";
import { LeasePackWizardModal } from "./LeasePackWizardModal";
import { useToast } from "../ui/ToastProvider";
import { colors, radius, spacing, text, shadows } from "../../styles/tokens";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useUpgrade } from "@/context/UpgradeContext";
import { upgradeStarterButtonStyle } from "../../lib/upgradeButtonStyles";
import { useAuth } from "@/context/useAuth";
import { CredibilityInsightsCard } from "./CredibilityInsightsCard";
import { MoveInReadinessPanel } from "./MoveInReadinessPanel";
import { TenantActivityPanel } from "./TenantActivityPanel";
import { FinancialActivityPanel } from "./FinancialActivityPanel";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { printSummaryDocument } from "@/utils/printSummary";

interface TenantDetailPanelProps {
  tenantId: string | null;
  activityRefreshKey?: number;
}

const riskBgMap: Record<string, string> = {
  LOW: "rgba(34,197,94,0.12)",
  MEDIUM: "rgba(234,179,8,0.14)",
  HIGH: "rgba(239,68,68,0.14)",
};

const riskBorderMap: Record<string, string> = {
  LOW: "1px solid rgba(34,197,94,0.5)",
  MEDIUM: "1px solid rgba(234,179,8,0.55)",
  HIGH: "1px solid rgba(239,68,68,0.55)",
};

const RECENT_LEASE_LEDGER_ENTRY_LIMIT = 10;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const tenantProfileTheme = {
  card: "#fffaf1",
  cardStrong: "#fff6e8",
  border: "rgba(91, 70, 48, 0.16)",
  borderStrong: "rgba(91, 70, 48, 0.3)",
  pine: "#245842",
  pineSoft: "rgba(36, 88, 66, 0.12)",
  charcoal: "#211c17",
  muted: "#63594d",
};

function formatDateLabel(value?: string | number | null) {
  if (!value) return "--";
  if (typeof value === "string") {
    const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value.trim());
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  const parsed = new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLeaseStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "--";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatCoherenceToken(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatNoticeResponse(value?: string | null, noResponse?: boolean) {
  if (noResponse) return "No Response";
  const normalized = String(value || "pending").trim().toLowerCase();
  if (normalized === "renew") return "Renewed";
  if (normalized === "quit") return "Quitting";
  if (normalized === "pending") return "Pending";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export const TenantDetailPanel: React.FC<TenantDetailPanelProps> = ({ tenantId, activityRefreshKey = 0 }) => {
  const { bundle, loading, error } = useTenantDetail(tenantId ?? null);

  if (!tenantId) {
    return (
      <div style={{ opacity: 0.7, fontSize: "0.9rem", color: text.muted }}>
        Select a tenant from the list to view details.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ opacity: 0.8, fontSize: "0.9rem", color: text.muted }}>
        Loading tenant details...
      </div>
    );
  }

  if (error || !bundle || !bundle.tenant) {
    return (
      <div
        style={{
          fontSize: "0.85rem",
          padding: "0.75rem 1rem",
          borderRadius: radius.md,
          backgroundColor: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.4)",
          color: text.primary,
        }}
      >
        {error || "No detail data found for this tenant."}
      </div>
    );
  }

  return <TenantDetailLayout bundle={bundle as any} tenantId={tenantId} activityRefreshKey={activityRefreshKey} />;
};

interface LayoutProps {
  bundle: any;
  tenantId: string;
  activityRefreshKey: number;
}

function formatCurrencyCents(value: number) {
  return (value / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

const TenantDetailLayout: React.FC<LayoutProps> = ({ bundle, tenantId, activityRefreshKey }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const entitlements = useEntitlements();
  const { openUpgrade } = useUpgrade();
  const features = entitlements.capabilities;
  const capsLoading = entitlements.loading;
  const ledgerEnabled = features?.ledger !== false;

  const tenant = bundle.tenant || bundle;
  const lease = bundle.currentLease || bundle.lease;
  const lifecycle = bundle.lifecycle || tenant.lifecycle || null;
  const stateCoherence = bundle.stateCoherence || null;
  const property = bundle.property || null;
  const unit = bundle.unit || null;
  const activeOccupantWithoutLease = !lease && [unit?.status, unit?.occupancyStatus].some((value) =>
    String(value || "").trim().toLowerCase() === "occupied"
  );
  const latestLeaseNoticeSummary = bundle.latestLeaseNoticeSummary || null;
  const credibilityInsights = bundle.credibilityInsights || null;
  const [moveInReadiness, setMoveInReadiness] = useState<MoveInReadiness | null>(bundle.moveInReadiness || null);
  const [readinessSaving, setReadinessSaving] = useState(false);

  const [ledgerItems, setLedgerItems] = useState<any[]>([]);
  const [leaseLedgerItems, setLeaseLedgerItems] = useState<LeaseLedgerEntry[]>([]);
  const [ledgerMode, setLedgerMode] = useState<"lease" | "tenant">("tenant");
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [financialActivityRows, setFinancialActivityRows] = useState<FinancialProjectionRow[]>([]);
  const [financialActivityLoading, setFinancialActivityLoading] = useState(false);
  const [financialActivityError, setFinancialActivityError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const [signals, setSignals] = useState<TenantSignals | null>(null);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [leasePackOpen, setLeasePackOpen] = useState(false);

  useEffect(() => {
    setMoveInReadiness(bundle.moveInReadiness || null);
  }, [bundle.moveInReadiness]);

  useEffect(() => {
    cancelledRef.current = false;
    setSignalsError(null);
    getTenantSignals(tenantId)
      .then((resp) => {
        if (cancelledRef.current) return;
        setSignals(resp?.signals ?? null);
      })
      .catch((err: any) => {
        if (cancelledRef.current) return;
        setSignalsError(err?.message || "Failed to load signals");
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [tenantId]);

  const riskLevel = signals?.riskLevel || tenant.riskLevel || "LOW";
  const riskBg = riskBgMap[riskLevel] || riskBgMap.LOW;
  const riskBorder = riskBorderMap[riskLevel] || riskBorderMap.LOW;

  const viewerRole = String(user?.actorRole || user?.role || "").toLowerCase();
  const isLandlord = viewerRole === "landlord" || viewerRole === "admin";
  const canExportPdf = entitlements.canExportPdf;
  const hasMoveInReadiness = entitlements.hasMoveInReadiness;

  const handleViewInLedger = () => {
    const leaseId = String(lease?.id || tenant?.currentLeaseId || tenant?.leaseId || "").trim();
    if (leaseId) {
      navigate(`/leases/${encodeURIComponent(leaseId)}/ledger`);
      return;
    }
    showToast({
      message: "No lease ledger is available yet",
      description: "Recent tenant events are still available in the timeline below.",
      variant: "info",
    });
  };

  const loadLedger = React.useCallback(async () => {
    const currentLeaseId = String(lease?.id || tenant?.currentLeaseId || tenant?.leaseId || "").trim();
    if (!tenantId) {
      setLedgerItems([]);
      setLeaseLedgerItems([]);
      return;
    }
    if (!ledgerEnabled) {
      setLedgerItems([]);
      setLeaseLedgerItems([]);
      return;
    }
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      if (currentLeaseId) {
        const ledger = await fetchLeaseLedger(currentLeaseId);
        if (!cancelledRef.current) {
          setLedgerMode("lease");
          setLeaseLedgerItems(Array.isArray(ledger.entries) ? ledger.entries : []);
          setLedgerItems([]);
        }
      } else {
        const items = await fetchLedger({ tenantId, limit: 50 });
        if (!cancelledRef.current) {
          setLedgerMode("tenant");
          setLedgerItems(items || []);
          setLeaseLedgerItems([]);
        }
      }
    } catch (err: any) {
      if (!cancelledRef.current) setLedgerError(err?.message || "Failed to load ledger");
    } finally {
      if (!cancelledRef.current) setLedgerLoading(false);
    }
  }, [lease?.id, ledgerEnabled, tenant?.currentLeaseId, tenant?.leaseId, tenantId]);

  useEffect(() => {
    cancelledRef.current = false;
    void loadLedger();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadLedger]);

  useEffect(() => {
    let cancelled = false;

    async function loadFinancialActivity() {
      if (!tenantId) {
        setFinancialActivityRows([]);
        setFinancialActivityLoading(false);
        setFinancialActivityError(null);
        return;
      }

      try {
        setFinancialActivityLoading(true);
        setFinancialActivityError(null);
        const rows = await fetchTenantFinancialActivity(tenantId);
        if (!cancelled) {
          setFinancialActivityRows(Array.isArray(rows) ? rows : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setFinancialActivityRows([]);
          setFinancialActivityError(err?.message || "Failed to load financial activity");
        }
      } finally {
        if (!cancelled) {
          setFinancialActivityLoading(false);
        }
      }
    }

    void loadFinancialActivity();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const downloadTenantReportFallback = async () => {
    const report = await downloadTenantReport(tenantId);
    const url = URL.createObjectURL(report.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = report.filename || "tenant-summary.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrintOrSaveReport = async () => {
    if (!canExportPdf) {
      openUpgrade({
        reason: "exports",
        plan: user?.plan || "free",
        ctaLabel: "Upgrade to Pro",
        copy: {
          title: "Upgrade for tenant PDF exports",
          body: "Downloadable tenant summaries are available on Pro plans so you can share cleaner landlord-ready records.",
        },
      });
      return;
    }
    try {
      if (typeof window !== "undefined" && typeof window.print === "function") {
        await printSummaryDocument("summary");
        return;
      }
      await downloadTenantReportFallback();
      showToast({
        message: "Tenant summary downloaded",
        description: "Browser print was unavailable, so the PDF summary has been saved.",
        variant: "success",
      });
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("PDF_REPORTING_DISABLED") || msg.includes("Not Implemented") || msg.includes("501")) {
        showToast({
          message: "Coming soon",
          description: "Tenant reports are coming soon.",
          variant: "info",
        });
        return;
      }
      showToast({
        message: "Failed to download report",
        description: "Please try again.",
        variant: "error",
      });
    }
  };

  const monthlyRent = lease?.monthlyRent ?? tenant?.monthlyRent ?? null;
  const propertyLabel = property?.name || tenant.propertyName || lease?.propertyName || "Unknown Property";
  const propertyAddress = [property?.addressLine1, property?.city, property?.province].filter(Boolean).join(", ");
  const unitLabel = unit?.unitNumber || tenant.unit || lease?.unit || "N/A";

  const handleReadinessUpdate = React.useCallback(
    async (update: {
      key: string;
      status: any;
      note?: string | null;
      blockerReason?: string | null;
    }) => {
      try {
        setReadinessSaving(true);
        const next = await updateTenantMoveInReadiness(tenantId, [update as any]);
        setMoveInReadiness(next);
        showToast({
          message: "Move-in readiness updated",
          description: "The readiness checklist has been refreshed.",
          variant: "success",
        });
      } catch (err: any) {
        showToast({
          message: "Unable to update readiness",
          description: err?.message || "Please try again.",
          variant: "error",
        });
      } finally {
        setReadinessSaving(false);
      }
    },
    [showToast, tenantId]
  );

  return (
    <div
      className="rc-tenant-profile-content"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
        color: text.primary,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              color: text.primary,
              display: "flex",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            {tenant.fullName || tenant.name || tenant.email || "Tenant"}
            {lifecycle?.lifecycleLabel ? (
              <span
                style={{
                  padding: "0.15rem 0.45rem",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  border: `1px solid ${colors.border}`,
                  color: text.primary,
                }}
              >
                {lifecycle.lifecycleLabel}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: "0.9rem", color: text.muted }}>
            {propertyLabel} • Unit {unitLabel}
          </div>
          {propertyAddress ? <div style={{ fontSize: "0.82rem", color: text.muted }}>{propertyAddress}</div> : null}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: spacing.xs,
          }}
        >
          <div
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: riskBg,
              border: riskBorder,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Risk: {riskLevel}
          </div>
          <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handlePrintOrSaveReport}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                padding: "6px 10px",
                background: colors.panel,
                color: text.primary,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                boxShadow: shadows.sm,
              }}
            >
              <span aria-hidden="true">
                📄
              </span>
              <span>{canExportPdf ? "Print / Save PDF" : "Upgrade for Tenant PDF"}</span>
            </button>
            {isLandlord ? (
              <>
                <button
                  type="button"
                  onClick={() => setNoticeOpen(true)}
                  style={{
                    borderRadius: radius.pill,
                    border: `1px solid ${colors.border}`,
                    padding: "6px 10px",
                    background: colors.panel,
                    color: text.primary,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    boxShadow: shadows.sm,
                  }}
                >
                  <span>Create notice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeasePackOpen(true)}
                  style={{
                    borderRadius: radius.pill,
                    border: `1px solid ${colors.border}`,
                    padding: "6px 10px",
                    background: colors.panel,
                    color: text.primary,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    boxShadow: shadows.sm,
                  }}
                >
                  <span>Create Lease Pack</span>
                </button>
                {capsLoading || ledgerEnabled ? (
                  <button
                    type="button"
                    onClick={() => setRecordOpen(true)}
                    style={{
                      borderRadius: radius.pill,
                      border: `1px solid ${tenantProfileTheme.pine}`,
                      padding: "6px 10px",
                      background: tenantProfileTheme.pine,
                      color: "#fffaf1",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      boxShadow: shadows.sm,
                    }}
                  >
                    <span>Record tenant activity</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Contact + basics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: `${spacing.xs} ${spacing.lg}`,
          fontSize: "0.85rem",
        }}
      >
        <DetailField label="Email" value={tenant.email ?? "--"} />
        <DetailField label="Phone" value={tenant.phone ?? "--"} />
        <DetailField label="Property" value={propertyLabel} />
        <DetailField label="Unit" value={unitLabel} />
        <DetailField label="Lease Start" value={formatDateLabel(tenant.leaseStart ?? lease?.leaseStart)} />
        <DetailField label="Lease End" value={formatDateLabel(tenant.leaseEnd ?? lease?.leaseEnd)} />
        <DetailField
          label="Monthly Rent"
          value={
            monthlyRent || monthlyRent === 0
              ? `$${Number(monthlyRent).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "--"
          }
        />
        <DetailField
          label="Lease Status"
          value={lease?.status ? formatLeaseStatus(lease.status) : activeOccupantWithoutLease ? "Active occupant — no lease linked" : "--"}
        />
        <DetailField label="Lifecycle" value={lifecycle?.lifecycleLabel ?? "--"} />
        {stateCoherence ? (
          <DetailField
            label="State Coherence"
            value={
              stateCoherence.flags?.requiresReview
                ? `Needs review: ${formatCoherenceToken(stateCoherence.leaseOperationalState)} lease / ${formatCoherenceToken(
                    stateCoherence.occupancyState
                  )} occupancy`
                : stateCoherence.coherenceLabel
            }
          />
        ) : null}
        <DetailField
          label="Current Balance"
          value={
            tenant.balance != null ? `$${Number(tenant.balance).toLocaleString()}` : "$0"
          }
        />
        <DetailField label="Tenant Status" value={tenant.status ?? "--"} />
        {lifecycle?.flags?.hasStateConflict ? (
          <DetailField label="Lifecycle Review" value="Source status conflict detected" />
        ) : null}
      </div>

      <div className="print-only print-only-summary" aria-hidden="true">
        <section
          style={{
            display: "grid",
            gap: 12,
            color: "#0f172a",
            background: "#fff",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <header style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>
              Tenant summary
            </div>
            <h1 style={{ margin: 0, fontSize: 24 }}>{tenant.fullName || tenant.name || "Unnamed Tenant"}</h1>
            <div style={{ color: "#475569", fontSize: 14 }}>
              {propertyLabel} · Unit {unitLabel}
            </div>
            {propertyAddress ? <div style={{ color: "#475569", fontSize: 13 }}>{propertyAddress}</div> : null}
          </header>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <DetailField label="Email" value={tenant.email ?? "--"} />
            <DetailField label="Phone" value={tenant.phone ?? "--"} />
            <DetailField label="Current lease status" value={formatLeaseStatus(lease?.status)} />
            <DetailField
              label="Monthly rent"
              value={
                monthlyRent || monthlyRent === 0
                  ? `$${Number(monthlyRent).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "--"
              }
            />
            <DetailField label="Lease start" value={formatDateLabel(tenant.leaseStart ?? lease?.leaseStart)} />
            <DetailField label="Lease end" value={formatDateLabel(tenant.leaseEnd ?? lease?.leaseEnd)} />
            <DetailField label="Lifecycle" value={lifecycle?.lifecycleLabel ?? "--"} />
            <DetailField label="Risk level" value={riskLevel} />
          </div>
          <section style={{ display: "grid", gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Financial activity summary</h2>
            {financialActivityRows.length ? (
              financialActivityRows.slice(0, 6).map((row) => (
                <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                  <span>{row.displayLabel || row.sourceBadge || "Financial activity"}</span>
                  <span>
                    {Number(row.amount || 0).toLocaleString(undefined, {
                      style: "currency",
                      currency: "CAD",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ color: "#475569", fontSize: 13 }}>No financial activity rows loaded.</div>
            )}
          </section>
        </section>
      </div>

      <CredibilityInsightsCard insights={credibilityInsights} />

      <FeatureGate
        enabled={hasMoveInReadiness}
        fallback={
          <LockedFeature
            featureKey="move_in_readiness"
            title="Move-In Readiness is available on Starter"
            description="Track deposit, inspection, insurance, keys, and final move-in blockers in one operational checklist."
            hint="Upgrade to keep signed lease steps, key release readiness, and landlord updates in one place."
            ctaLabel="Upgrade to Starter"
          />
        }
      >
        <details
          style={{
            borderRadius: radius.xl,
            border: `1px solid ${tenantProfileTheme.border}`,
            background: tenantProfileTheme.card,
            boxShadow: shadows.sm,
          }}
        >
          <summary
            style={{
              alignItems: "center",
              cursor: "pointer",
              display: "flex",
              gap: spacing.md,
              justifyContent: "space-between",
              padding: spacing.md,
            }}
          >
            <span style={{ display: "grid", gap: 4 }}>
              <span style={{ color: tenantProfileTheme.charcoal, fontWeight: 850 }}>Move-in readiness</span>
              <span style={{ color: tenantProfileTheme.muted, fontSize: 13 }}>
                Open when you need the detailed lease, deposit, inspection, insurance, and key-release checklist.
              </span>
            </span>
            <span
              style={{
                border: `1px solid ${tenantProfileTheme.borderStrong}`,
                borderRadius: radius.pill,
                color: tenantProfileTheme.pine,
                flex: "0 0 auto",
                fontSize: 12,
                fontWeight: 800,
                padding: "5px 9px",
              }}
            >
              Details
            </span>
          </summary>
          <div style={{ borderTop: `1px solid ${tenantProfileTheme.border}`, padding: spacing.md }}>
            <MoveInReadinessPanel readiness={moveInReadiness} saving={readinessSaving} onUpdate={handleReadinessUpdate} />
          </div>
        </details>
      </FeatureGate>

      {latestLeaseNoticeSummary ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Lease Notice Status</div>
              <div style={{ color: text.muted, fontSize: "0.85rem" }}>
                {formatLeaseStatus(latestLeaseNoticeSummary.noticeType)}
              </div>
            </div>
            <div
              style={{
                padding: "4px 10px",
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              {formatNoticeResponse(latestLeaseNoticeSummary.tenantResponse, latestLeaseNoticeSummary.noResponse)}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: `${spacing.xs} ${spacing.lg}`,
              fontSize: "0.85rem",
            }}
          >
            <DetailField label="Sent" value={formatDateLabel(latestLeaseNoticeSummary.sentAt)} />
            <DetailField label="Viewed" value={formatDateLabel(latestLeaseNoticeSummary.tenantViewedAt)} />
            <DetailField label="Response Deadline" value={formatDateLabel(latestLeaseNoticeSummary.responseDeadlineAt)} />
            <DetailField label="Response" value={formatNoticeResponse(latestLeaseNoticeSummary.tenantResponse, latestLeaseNoticeSummary.noResponse)} />
            <DetailField label="Lease Outcome" value={formatLeaseStatus(latestLeaseNoticeSummary.leaseStatusAfterResponse || lease?.status)} />
          </div>
        </div>
      ) : null}

      {!capsLoading && !ledgerEnabled ? (
        <div
          style={{
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 12,
            padding: 12,
            background: "rgba(15,23,42,0.55)",
            color: "#e2e8f0",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Upgrade to manage your rentals</div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>
            RentChain Screening is free. Rental management starts on Starter.
          </div>
          <button
            type="button"
            onClick={() =>
              openUpgrade({
                reason: "screening",
                plan: "Screening",
                copy: {
                  title: "Upgrade to manage your rentals",
                  body: "RentChain Screening is free. Rental management starts on Starter.",
                },
                ctaLabel: "Upgrade to Starter",
              })
            }
            style={upgradeStarterButtonStyle}
          >
            Upgrade to Starter
          </button>
        </div>
      ) : (
        <>
          {/* Ledger quick actions */}
          <div
            style={{
              marginTop: "0.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: text.muted, fontSize: "0.8rem" }}>
              Use the current payment ledger to record charges and payments.
            </div>
            <button
              type="button"
              onClick={handleViewInLedger}
              style={{
                fontSize: "0.8rem",
                padding: "0.4rem 0.85rem",
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
                cursor: "pointer",
                boxShadow: shadows.sm,
              }}
            >
              Open payment ledger →
            </button>
          </div>

      {/* Signals block */}
      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          border: `1px solid ${tenantProfileTheme.border}`,
          background: tenantProfileTheme.cardStrong,
          boxShadow: shadows.sm,
          fontSize: "0.85rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Signals</div>
        {signalsError ? (
          <div style={{ color: colors.danger, fontSize: "0.85rem" }}>{signalsError}</div>
        ) : signals ? (
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <SignalField label="Risk level" value={signals.riskLevel} />
            <SignalField label="Late payments" value={signals.latePaymentsCount} />
            <SignalField label="NSF" value={signals.nsfCount} />
            <SignalField label="Missed" value={signals.missedPaymentsCount} />
            <SignalField label="Notices" value={signals.evictionNoticeCount} />
            <SignalField label="Positive notes" value={signals.positiveNotesCount} />
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>No signals yet.</div>
        )}
      </div>

      <FinancialActivityPanel
        rows={financialActivityRows}
        loading={financialActivityLoading}
        error={financialActivityError}
      />

      {/* Ledger timeline */}
      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: tenantProfileTheme.cardStrong,
          border: `1px solid ${tenantProfileTheme.border}`,
          boxShadow: shadows.sm,
          fontSize: "0.85rem",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            marginBottom: spacing.xs,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <span>Recent current lease ledger entries</span>
            <span style={{ color: text.muted, fontSize: "0.75rem", fontWeight: 400 }}>
              Showing the most recent charges and payments from the current lease ledger.
            </span>
            <span style={{ color: text.muted, fontSize: "0.75rem", fontWeight: 400 }}>
              Tenant activity is recorded separately and does not add charges or payments to the current lease ledger.
            </span>
            {ledgerMode === "lease" ? (
              <span style={{ color: text.muted, fontSize: "0.75rem", fontWeight: 400 }}>
                Showing the latest {RECENT_LEASE_LEDGER_ENTRY_LIMIT} entries here. Open payment ledger for the full history.
              </span>
            ) : null}
            {ledgerMode === "tenant" ? (
              <span style={{ color: text.muted, fontSize: "0.75rem", fontWeight: 400 }}>
                No current lease is linked, so this view is showing the existing tenant-level ledger source.
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setRecordOpen(true)}
              style={{
                padding: "6px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: tenantProfileTheme.card,
                color: tenantProfileTheme.charcoal,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.8rem",
              }}
            >
              Record tenant activity
            </button>
            {ledgerMode === "tenant" ? <VerifyLedgerButton onVerified={() => void loadLedger()} /> : null}
          </div>
        </div>
        {ledgerLoading ? (
          <div style={{ color: text.muted }}>Loading ledger...</div>
        ) : ledgerError ? (
          <div style={{ color: colors.danger, fontSize: "0.85rem" }}>{ledgerError}</div>
        ) : (
          ledgerMode === "lease" ? (
            leaseLedgerItems.length === 0 ? (
              <div style={{ color: text.muted }}>No ledger entries for the current lease yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {leaseLedgerItems.slice(0, RECENT_LEASE_LEDGER_ENTRY_LIMIT).map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      border: `1px solid ${tenantProfileTheme.border}`,
                      borderRadius: 10,
                      padding: 12,
                      background: tenantProfileTheme.card,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: text.primary }}>
                        {entry.entryType === "payment" ? "Payment" : "Charge"} · {entry.category}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: entry.entryType === "payment" ? "#047857" : text.primary,
                        }}
                      >
                        {entry.entryType === "payment" ? "-" : "+"}
                        {formatCurrencyCents(Math.abs(Number(entry.amountCents || 0)))}
                      </div>
                    </div>
                    <div style={{ color: text.muted, fontSize: "0.8rem" }}>
                      {formatDateLabel(entry.effectiveDate)} · Balance {formatCurrencyCents(Number(entry.balanceCents || 0))}
                    </div>
                    <div style={{ color: text.primary, fontSize: "0.82rem" }}>
                      {[entry.method, entry.reference].filter(Boolean).join(" · ") || entry.notes || "No additional details"}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <LedgerTimeline items={ledgerItems || []} compact />
          )
        )}
      </div>
      <TenantActivityPanel tenantId={tenantId} refreshKey={activityRefreshKey} />
        </>
      )}

      <RecordTenantEventModal
        open={recordOpen}
        tenantId={tenant.id}
        tenantName={tenant.fullName || tenant.name}
        onClose={() => setRecordOpen(false)}
        onCreated={() => {
          void loadLedger();
          setRecordOpen(false);
        }}
      />
      <CreateNoticeModal
        open={noticeOpen}
        tenantId={tenant.id}
        onClose={() => setNoticeOpen(false)}
        onCreated={() => {
          setNoticeOpen(false);
        }}
      />
      <LeasePackWizardModal
        open={leasePackOpen}
        onClose={() => setLeasePackOpen(false)}
        tenant={tenant}
        lease={lease}
        landlordName={String(user?.displayName || user?.name || user?.email || "Landlord")}
      />
    </div>
  );
};

const DetailField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ color: text.muted, marginBottom: "0.1rem" }}>{label}</div>
    <div style={{ color: text.primary }}>{value}</div>
  </div>
);

const SignalField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ color: text.muted, fontSize: "0.8rem" }}>{label}</div>
    <div style={{ color: text.primary, fontWeight: 600 }}>{value ?? "—"}</div>
  </div>
);

