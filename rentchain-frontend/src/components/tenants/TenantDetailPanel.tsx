// rentchain-frontend/src/components/tenants/TenantDetailPanel.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantDetail } from "../../hooks/useTenantDetail";
import { downloadTenantReport } from "@/api/tenantsApi";
import { getTenantSignals, type TenantSignals } from "@/api/tenantSignals";
import { useLedgerV2 } from "@/hooks/useLedgerV2";
import { LedgerTimeline } from "../ledger/LedgerTimeline";
import { LedgerEventDrawer } from "../ledger/LedgerEventDrawer";
import { RecordTenantEventModal } from "./RecordTenantEventModal";
import { useToast } from "../ui/ToastProvider";
import { colors, radius, spacing, text, shadows } from "../../styles/tokens";

interface TenantDetailPanelProps {
  tenantId: string | null;
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

export const TenantDetailPanel: React.FC<TenantDetailPanelProps> = ({ tenantId }) => {
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

  return <TenantDetailLayout bundle={bundle as any} tenantId={tenantId} />;
};

interface LayoutProps {
  bundle: any;
  tenantId: string;
}

const TenantDetailLayout: React.FC<LayoutProps> = ({ bundle, tenantId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const tenant = bundle.tenant || bundle;
  const lease = bundle.lease;

  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const { items: ledgerItems, refresh: refreshLedger } = useLedgerV2({
    tenantId,
    limit: 10,
  });

  const [signals, setSignals] = useState<TenantSignals | null>(null);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSignalsError(null);
    getTenantSignals(tenantId)
      .then((resp) => {
        if (cancelled) return;
        setSignals(resp?.signals ?? null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setSignalsError(err?.message || "Failed to load signals");
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const riskLevel = signals?.riskLevel || tenant.riskLevel || "LOW";
  const riskBg = riskBgMap[riskLevel] || riskBgMap.LOW;
  const riskBorder = riskBorderMap[riskLevel] || riskBorderMap.LOW;

  const isLandlord = String(tenant?.role || "").toLowerCase() !== "tenant";

  const handleViewInLedger = () => {
    navigate(`/ledger?tenantId=${tenantId}`);
  };

  const handleDownloadReport = async () => {
    try {
      const report = await downloadTenantReport(tenantId);
      if (report && typeof report === "object") {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tenant-report-${tenantId}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      showToast({
        message: "Report downloaded",
        description: "Tenant report has been saved.",
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

  return (
    <div
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
            {tenant.status ? (
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
                {tenant.status}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: "0.9rem", color: text.muted }}>
            {(tenant.propertyName || lease?.propertyName || "Property")} • Unit {tenant.unit || lease?.unit || "—"}
          </div>
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
              onClick={handleDownloadReport}
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
              <span role="img" aria-label="file">
                📄
              </span>
              <span>Download report (JSON)</span>
            </button>
            {isLandlord ? (
              <button
                type="button"
                onClick={() => setRecordOpen(true)}
                style={{
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.border}`,
                  padding: "6px 10px",
                  background: colors.primary,
                  color: "white",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  boxShadow: shadows.sm,
                }}
              >
                <span role="img" aria-label="plus">
                  ＋
                </span>
                <span>Record event</span>
              </button>
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
        <DetailField label="Email" value={tenant.email ?? "—"} />
        <DetailField label="Phone" value={tenant.phone ?? "—"} />
        <DetailField label="Lease Start" value={tenant.leaseStart ?? lease?.leaseStart ?? "—"} />
        <DetailField label="Lease End" value={tenant.leaseEnd ?? lease?.leaseEnd ?? "—"} />
        <DetailField
          label="Monthly Rent"
          value={
            monthlyRent
              ? `$${Number(monthlyRent).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"
          }
        />
        <DetailField
          label="Current Balance"
          value={
            tenant.balance != null ? `$${Number(tenant.balance).toLocaleString()}` : "$0"
          }
        />
        <DetailField label="Status" value={tenant.status ?? "—"} />
      </div>

      {/* Ledger quick actions */}
      <div
        style={{
          marginTop: "0.5rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
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
          View all ledger events →
        </button>
      </div>

      {/* Signals block */}
      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
          background: colors.panel,
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

      {/* Ledger timeline */}
      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.panel,
          border: `1px solid ${colors.border}`,
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
          <span>Ledger timeline</span>
        </div>
        <LedgerTimeline
          items={ledgerItems || []}
          loading={false}
          onSelect={(id) => setSelectedLedgerId(id)}
          emptyText="No ledger events yet for this tenant."
        />
        {selectedLedgerId ? (
          <LedgerEventDrawer eventId={selectedLedgerId} onClose={() => setSelectedLedgerId(null)} />
        ) : null}
      </div>

      <RecordTenantEventModal
        open={recordOpen}
        tenantId={tenant.id}
        tenantName={tenant.fullName || tenant.name}
        onClose={() => setRecordOpen(false)}
        onCreated={() => {
          refreshLedger?.();
          setRecordOpen(false);
        }}
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
