// rentchain-frontend/src/pages/reports/MonthlyOpsReportPage.tsx
import React from "react";
import { getMonthlyOpsSnapshot, type OpsMonthlySnapshot } from "../../api/opsSnapshot";
import { TenantScorePill } from "../../components/tenant/TenantScorePill";

function qsInt(name: string, fallback: number, min: number, max: number) {
  const v = new URLSearchParams(window.location.search).get(name);
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function fmtDate(ms: number | null | undefined) {
  if (!ms) return "";
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metric(label: string, value: React.ReactNode) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        background: "#FFFFFF",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 950, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function MonthlyOpsReportPage() {
  const windowDays = qsInt("windowDays", 30, 7, 365);
  const topN = qsInt("topN", 5, 3, 25);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<OpsMonthlySnapshot | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const resp = await getMonthlyOpsSnapshot({ windowDays, topN });
      setData(resp);
    } catch (e: any) {
      setError(e?.message || "Failed to load report");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays, topN]);

  const totals = data?.totals;
  const generatedAt = data?.generatedAt ? fmtDate(data.generatedAt) : fmtDate(Date.now());

  return (
    <div
      style={{
        padding: 24,
        background: "#F9FAFB",
        minHeight: "100vh",
      }}
    >
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .page { padding: 0 !important; background: white !important; }
          .card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="page" style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div
          className="card"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Monthly Ops Snapshot</div>
              <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginTop: 2 }}>
                Window: {windowDays} days • Generated: {generatedAt}
              </div>
              {data?.usingActiveWindow ? (
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                  Using active-tenant window (recent activity present)
                </div>
              ) : null}
            </div>

            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontWeight: 900,
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
                  fontWeight: 900,
                  opacity: loading ? 0.65 : 1,
                  cursor: loading ? "default" : "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            RentChain • Board-grade operational health summary
          </div>
        </div>

        {/* States */}
        {error ? (
          <div
            className="card"
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid #FCA5A5",
              background: "#FEF2F2",
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Couldn’t load report</div>
            <div style={{ opacity: 0.9 }}>{error}</div>
          </div>
        ) : null}

        {loading && !data ? <div style={{ marginTop: 12, opacity: 0.7 }}>Loading…</div> : null}

        {/* Metrics */}
        {totals ? (
          <>
            <div
              className="card"
              style={{
                marginTop: 12,
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 10 }}>Portfolio health</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 10,
                }}
              >
                {metric("Tenants", totals.totalTenants)}
                {metric("Avg score", totals.avgScore ?? "—")}
                {metric("At risk (watch+risk)", totals.atRiskCount)}
                {metric("Late (90d)", totals.totalLate90d)}
                {metric("Notices (12m)", totals.totalNotices12m)}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.8 }}>Tier distribution</div>
                <div style={{ fontSize: 12, fontWeight: 850, opacity: 0.85 }}>
                  excellent: {totals.tierCounts.excellent} • good: {totals.tierCounts.good} • watch:{" "}
                  {totals.tierCounts.watch} • risk: {totals.tierCounts.risk}
                </div>
              </div>
            </div>

            {/* Top Risk */}
            <div
              className="card"
              style={{
                marginTop: 12,
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 10 }}>Top risk tenants</div>

              {data?.topRisk?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.topRisk.map((t) => (
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
                        <div style={{ fontWeight: 950, fontSize: 13 }}>{t.tenantId}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Late(90d): {t.signals?.lateCount90d ?? 0} • Notices(12m): {t.signals?.notices12m ?? 0} •
                          Streak: {t.signals?.onTimeStreak ?? 0}
                        </div>
                      </div>
                      <TenantScorePill score={t.scoreV1} tier={t.tierV1} compact />
                    </div>
                  ))}
                </div>
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

            {/* Footer note */}
            <div style={{ marginTop: 10, fontSize: 11, opacity: 0.6 }}>
              Score v1 is rule-based and explainable. Data sourced from tenant summary snapshots.
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
