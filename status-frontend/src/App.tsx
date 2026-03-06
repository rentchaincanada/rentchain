import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicStatus,
  readAdminToken,
  refreshAllStatusComponents,
  type PublicStatusPayload,
} from "./api/statusApi";
import StatusBadge from "./components/StatusBadge";
import StatusComponentCard from "./components/StatusComponentCard";
import IncidentList from "./components/IncidentList";

function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [payload, setPayload] = useState<PublicStatusPayload | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const adminToken = useMemo(() => readAdminToken(), []);
  const canAdminRefresh = Boolean(adminToken);

  const loadStatus = async (cancelledRef?: { value: boolean }) => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await fetchPublicStatus();
      if (!cancelledRef?.value) setPayload(data);
    } catch (err: any) {
      if (!cancelledRef?.value) setLoadError(String(err?.message || "status_unavailable"));
    } finally {
      if (!cancelledRef?.value) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelledRef = { value: false };
    void loadStatus(cancelledRef);
    const id = window.setInterval(() => {
      void loadStatus(cancelledRef);
    }, 60000);
    return () => {
      cancelledRef.value = true;
      window.clearInterval(id);
    };
  }, []);

  const lastUpdated = useMemo(() => {
    if (!payload?.updatedAtMs) return "n/a";
    return new Date(payload.updatedAtMs).toLocaleString();
  }, [payload?.updatedAtMs]);

  const onRefreshAll = async () => {
    if (!adminToken) return;
    try {
      setRefreshingAll(true);
      setConfirmation(null);
      setActionBanner(null);
      await refreshAllStatusComponents(adminToken);
      await loadStatus();
      setConfirmation("All components marked operational.");
    } catch (err: any) {
      const code = String(err?.message || "");
      if (code === "ACTIVE_INCIDENT_PRESENT") {
        setActionBanner(
          "An active incident exists. Resolve the incident before resetting component statuses."
        );
      } else {
        setActionBanner("Unable to reset all components right now.");
      }
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <main className="page">
      <section className="hero card">
        <h1>RentChain Status</h1>
        <p className="muted">Current platform health and incident updates</p>
        {payload ? <StatusBadge status={payload.overallStatus} /> : null}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <span className="muted">Last updated: {lastUpdated}</span>
          {canAdminRefresh ? (
            <button
              type="button"
              onClick={onRefreshAll}
              disabled={refreshingAll}
              style={{
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 12px",
                fontWeight: 700,
                cursor: refreshingAll ? "not-allowed" : "pointer",
                opacity: refreshingAll ? 0.65 : 1,
              }}
            >
              {refreshingAll ? "Resetting..." : "Reset All Components"}
            </button>
          ) : null}
        </div>
        {confirmation ? <div className="muted" style={{ marginTop: 8 }}>{confirmation}</div> : null}
      </section>

      {loading ? <section className="card muted">Loading status...</section> : null}
      {loadError ? <section className="card error">Unable to load status right now ({loadError}).</section> : null}
      {actionBanner ? <section className="card error">{actionBanner}</section> : null}

      {payload?.activeBanner ? (
        <section className="card banner banner-incident">
          <strong>{payload.activeBanner.title || "Active Incident"}</strong>
          <p>{payload.activeBanner.message}</p>
        </section>
      ) : null}

      {payload?.maintenanceBanner ? (
        <section className="card banner banner-maintenance">
          <strong>{payload.maintenanceBanner.title || "Scheduled Maintenance"}</strong>
          <p>{payload.maintenanceBanner.message}</p>
        </section>
      ) : null}

      <section className="components-grid">
        {(payload?.components || []).map((component) => (
          <StatusComponentCard key={component.key} component={component} />
        ))}
      </section>

      <IncidentList incidents={payload?.incidents || []} />

      <footer className="footer muted">Public status feed updates every 60 seconds.</footer>
    </main>
  );
}

export default App;
