import React from "react";
import { getMonthlyOpsSnapshot, type OpsMonthlySnapshot } from "../../api/opsSnapshot";
import { TenantScorePill } from "../tenant/TenantScorePill";

const TENANT_DETAIL_PATH = (tenantId: string) => `/tenants/${tenantId}`;

function fmt(ms: any) {
  if (!ms) return "";
  const d = typeof ms === "number" ? new Date(ms) : new Date(ms?.seconds ? ms.seconds * 1000 : ms);
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
    <div style={{ padding: 12, border: "1px solid #EEF2F7", borderRadius: 14, background: "#FFFFFF" }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 950, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function MonthlyOpsSnapshotPanel() {
  const [windowDays, setWindowDays] = React.useState<30 | 60 | 90>(30);
  const topN = 5;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<OpsMonthlySnapshot | null>(null);

  async function load(nextWindowDays?: number) {
    const wd = (nextWindowDays ?? windowDays) as number;
    setLoading(true);
    setError(null);
    try {
      const resp = await getMonthlyOpsSnapshot({ windowDays: wd, topN });
      setData(resp);
    } catch (e: any) {
      setError(e?.message || "Failed to load snapshot");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(windowDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

  const totals = data?.totals;

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 16, background: "#FFFFFF", padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 14 }}>Monthly Ops Snapshot</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Window: {windowDays} days • Snapshot-backed
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => window.open(`/reports/monthly-ops?windowDays=${windowDays}&topN=${topN}`, "_blank")}
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
            onClick={() => load(windowDays)}
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

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Window</div>
        <button type="button" onClick={() => setWindowDays(30)} style={pillButton(windowDays === 30)}>
          30d
        </button>
        <button type="button" onClick={() => setWindowDays(60)} style={pillButton(windowDays === 60)}>
          60d
        </button>
        <button type="button" onClick={() => setWindowDays(90)} style={pillButton(windowDays === 90)}>
          90d
        </button>
        {data?.usingActiveWindow ? (
          <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>Using active tenants</span>
        ) : null}
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
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Couldn’t load snapshot</div>
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

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 950, fontSize: 13, marginBottom: 8 }}>Top risk tenants</div>

            {data?.topRisk?.length ? (
              <div
                style={{
                  border: "1px solid #EEF2F7",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#FFFFFF",
                }}
              >
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
                      title="Open tenant"
                    >
                      {t.tenantId}
                    </a>

                    <TenantScorePill score={t.scoreV1} tier={t.tierV1} compact />

                    <div style={{ fontWeight: 900 }}>{t.signals?.lateCount90d ?? 0}</div>
                    <div style={{ fontWeight: 900 }}>{t.signals?.notices12m ?? 0}</div>
                    <div style={{ fontWeight: 900 }}>{t.signals?.onTimeStreak ?? 0}</div>
                    <div style={{ fontWeight: 900, opacity: 0.85 }}>
                      {fmt(typeof t.lastEventAt?.toMillis === "function" ? t.lastEventAt.toMillis() : t.lastEventAt)}
                    </div>
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
        </>
      ) : null}
    </div>
  );
}
