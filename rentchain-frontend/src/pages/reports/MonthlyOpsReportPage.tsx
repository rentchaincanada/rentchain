// rentchain-frontend/src/pages/reports/MonthlyOpsReportPage.tsx
import React from "react";
import { getMonthlyOpsSnapshot, type OpsMonthlySnapshot } from "../../api/opsSnapshot";
import { TenantScorePill } from "../../components/tenant/TenantScorePill";

const TENANT_DETAIL_PATH = (tenantId: string) => `/tenants/${tenantId}`;

function qsInt(name: string, fallback: number, min: number, max: number) {
  const v = new URLSearchParams(window.location.search).get(name);
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function setQuery(next: Record<string, string>) {
  const u = new URL(window.location.href);
  Object.entries(next).forEach(([k, v]) => u.searchParams.set(k, v));
  window.location.assign(u.toString());
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

function fmtShort(msAny: any) {
  if (!msAny) return "";
  const ms = typeof msAny === "number"
    ? msAny
    : msAny?.toMillis
    ? msAny.toMillis()
    : msAny?.seconds
    ? msAny.seconds * 1000
    : null;
  if (!ms) return "";
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function pillButton(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    background: active ? "#F3F4F6" : "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function metric(label: string, value: React.ReactNode) {
  return (
    <div style={{ padding: 12, border: "1px solid #E5E7EB", borderRadius: 12, background: "#FFFFFF" }}>
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
    <div style={{ padding: 24, background: "#F9FAFB", minHeight: "100vh" }}>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .page { padding: 0 !important; background: white !important; }
          .card { break-inside: avoid; page-break-inside: avoid; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>

      <div className="page" style={{ maxWidth: 980, margin: "0 auto" }}>
        <div className="card" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Monthly Ops Snapshot</div>
              <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginTop: 2 }}>
                Window: {windowDays} days • Generated: {generatedAt}
              </div>
              {data?.usingActiveWindow ? (
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Using active-tenant window</div>
              ) : null}
            </div>

            <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF", fontWeight: 900, cursor: "pointer" }}
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

          {/* Window selector */}
          <div className="no-print" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Window</div>
            <button type="button" onClick={() => setQuery({ windowDays: "30", topN: String(topN) })} style={pillButton(windowDays === 30)}>
              30d
            </button>
            <button type="button" onClick={() => setQuery({ windowDays: "60", topN: String(topN) })} style={pillButton(windowDays === 60)}>
              60d
            </button>
            <button type="button" onClick={() => setQuery({ windowDays: "90", topN: String(topN) })} style={pillButton(windowDays === 90)}>
              90d
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>RentChain • Board-grade operational health summary</div>
        </div>

        {error ? (
          <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid #FCA5A5", background: "#FEF2F2" }}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Couldn’t load report</div>
            <div style={{ opacity: 0.9 }}>{error}</div>
          </div>
        ) : null}

        {loading && !data ? <div style={{ marginTop: 12, opacity: 0.7 }}>Loading…</div> : null}

        {totals ? (
          <>
            <div className="card" style={{ marginTop: 12, background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 16, padding: 14 }}>
              <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 10 }}>Portfolio health</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                {metric("Tenants", totals.totalTenants)}
                {metric("Avg score", totals.avgScore ?? "—")}
                {metric("At risk (watch+risk)", totals.atRiskCount)}
                {metric("Late (90d)", totals.totalLate90d)}
                {metric("Notices (12m)", totals.totalNotices12m)}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.8 }}>Tier distribution</div>
                <div style={{ fontSize: 12, fontWeight: 850, opacity: 0.85 }}>
                  excellent: {totals.tierCounts.excellent} • good: {totals.tierCounts.good} • watch: {totals.tierCounts.watch} • risk: {totals.tierCounts.risk}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 12, background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 16, padding: 14 }}>
              <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 10 }}>Top risk tenants</div>

              {data?.topRisk?.length ? (
                <div style={{ border: "1px solid #EEF2F7", borderRadius: 14, overflow: "hidden", background: "#FFFFFF" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 0.9fr 0.8fr 0.9fr 0.8fr 0.9fr",
                      gap: 8,
                      padding: 10,
                      borderBottom: "1px solid #EEF2F7",
                      background: "#F8FAFC",
                      fontSize: 12,
                      fontWeight: 950,
                      opacity: 0.8,
                    }}
                  >
                    <div>Tenant</div>
                    <div>Score</div>
                    <div>Late(90d)</div>
                    <div>Notices(12m)</div>
                    <div>Streak</div>
                    <div>Last activity</div>
                  </div>

                  {data.topRisk.map((t) => (
                    <div
                      key={t.tenantId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 0.9fr 0.8fr 0.9fr 0.8fr 0.9fr",
                        gap: 8,
                        padding: 10,
                        borderBottom: "1px solid #F3F4F6",
                        alignItems: "center",
                        fontSize: 12,
                      }}
                    >
                      <a
                        href={TENANT_DETAIL_PATH(t.tenantId)}
                        style={{ fontWeight: 950, color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
                      >
                        {t.tenantId}
                      </a>
                      <TenantScorePill score={t.scoreV1} tier={t.tierV1} compact />
                      <div style={{ fontWeight: 900 }}>{t.signals?.lateCount90d ?? 0}</div>
                      <div style={{ fontWeight: 900 }}>{t.signals?.notices12m ?? 0}</div>
                      <div style={{ fontWeight: 900 }}>{t.signals?.onTimeStreak ?? 0}</div>
                      <div style={{ fontWeight: 900, opacity: 0.85 }}>{fmtShort(t.lastEventAt)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 12, borderRadius: 14, border: "1px dashed #E5E7EB", background: "#FAFAFA", opacity: 0.85 }}>
                  No scored tenants found yet.
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 11, opacity: 0.6 }}>
              Score v1 is rule-based and explainable. Data sourced from tenant summary snapshots.
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
