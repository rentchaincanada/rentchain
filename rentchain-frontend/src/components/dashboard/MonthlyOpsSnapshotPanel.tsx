import React from "react";
import { getMonthlyOpsSnapshot, OpsMonthlySnapshot } from "../../api/opsSnapshot";
import { TenantScorePill } from "../tenant/TenantScorePill";

function metric(label: string, value: React.ReactNode) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #EEF2F7",
        borderRadius: 14,
        background: "#FFFFFF",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function MonthlyOpsSnapshotPanel() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<OpsMonthlySnapshot | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const resp = await getMonthlyOpsSnapshot({ windowDays: 30, topN: 5 });
      setData(resp);
    } catch (e: any) {
      setError(e?.message || "Failed to load snapshot");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const totals = data?.totals;

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        background: "#FFFFFF",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>Monthly Ops Snapshot</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {data ? `Window: ${data.windowDays} days` : "Window: 30 days"} • Snapshot-backed
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => window.open(`/reports/monthly-ops?windowDays=30&topN=5`, "_blank")}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Print / Save PDF
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontWeight: 800,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "default" : "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Couldn&apos;t load snapshot</div>
          <div style={{ opacity: 0.9 }}>{error}</div>
        </div>
      ) : null}

      {loading && !data ? <div style={{ marginTop: 12, opacity: 0.7 }}>Loading…</div> : null}

      {totals ? (
        <>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            {metric("Tenants", totals.totalTenants)}
            {metric("Avg score", totals.avgScore ?? "—")}
            {metric("At risk (watch+risk)", totals.atRiskCount)}
            {metric("Late (90d)", totals.totalLate90d)}
            {metric("Notices (12m)", totals.totalNotices12m)}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Tier distribution</span>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
              excellent: {totals.tierCounts.excellent} • good: {totals.tierCounts.good} • watch: {totals.tierCounts.watch} • risk: {totals.tierCounts.risk}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8 }}>Top risk tenants</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data?.topRisk?.length ? (
                data.topRisk.map((t) => (
                  <div
                    key={t.tenantId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid #EEF2F7",
                      background: "#FFFFFF",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{t.tenantId}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Late(90d): {t.signals?.lateCount90d ?? 0} • Notices(12m): {t.signals?.notices12m ?? 0} • Streak: {t.signals?.onTimeStreak ?? 0}
                      </div>
                    </div>
                    <TenantScorePill score={t.scoreV1} tier={t.tierV1} compact />
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px dashed #E5E7EB",
                    background: "#FAFAFA",
                    opacity: 0.85,
                  }}
                >
                  No scored tenants found yet.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
