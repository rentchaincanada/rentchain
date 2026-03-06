import { useEffect, useMemo, useState } from "react";
import { fetchPublicStatus, type PublicStatusPayload } from "./api/statusApi";
import StatusBadge from "./components/StatusBadge";
import StatusComponentCard from "./components/StatusComponentCard";
import IncidentList from "./components/IncidentList";

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PublicStatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPublicStatus();
        if (!cancelled) setPayload(data);
      } catch (err: any) {
        if (!cancelled) setError(String(err?.message || "status_unavailable"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    const id = window.setInterval(() => {
      void run();
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const lastUpdated = useMemo(() => {
    if (!payload?.updatedAtMs) return "n/a";
    return new Date(payload.updatedAtMs).toLocaleString();
  }, [payload?.updatedAtMs]);

  return (
    <main className="page">
      <section className="hero card">
        <h1>RentChain Status</h1>
        <p className="muted">Current platform health and incident updates</p>
        {payload ? <StatusBadge status={payload.overallStatus} /> : null}
      </section>

      {loading ? <section className="card muted">Loading status...</section> : null}
      {error ? <section className="card error">Unable to load status right now ({error}).</section> : null}

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

      <footer className="footer muted">Last updated: {lastUpdated}</footer>
    </main>
  );
}

export default App;
