import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { acknowledgeAlert, fetchAdminAlerts, type AdminAlertV1 } from "../../api/adminAlertingApi";
import { createWatchlistEntry, fetchWatchlist, type WatchlistEntryV1, updateWatchlistEntry } from "../../api/adminWatchlistApi";
import AlertFilterBar from "../../components/adminAlerting/AlertFilterBar";
import AlertTable from "../../components/adminAlerting/AlertTable";
import WatchlistTable from "../../components/adminAlerting/WatchlistTable";

export default function AdminAlertingPage() {
  const { showToast } = useToast();
  const [alerts, setAlerts] = React.useState<AdminAlertV1[]>([]);
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryV1[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [resourceType, setResourceType] = React.useState("");
  const [watchedOnly, setWatchedOnly] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [alertsResponse, watchlistResponse] = await Promise.all([
        fetchAdminAlerts({
          category: category || null,
          severity: severity || null,
          resourceType: resourceType || null,
          activeOnly: true,
          watchedOnly,
          limit: 25,
        }),
        fetchWatchlist({ activeOnly: false, limit: 25 }),
      ]);
      setAlerts(alertsResponse.alerts || []);
      setWatchlist(watchlistResponse.watchlist || []);
    } catch (err: any) {
      const message = err?.message || "Failed to load admin alerts";
      setError(message);
      showToast({
        message: "Failed to load admin alerts",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [category, severity, resourceType, watchedOnly, showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleAcknowledge = async (alert: AdminAlertV1) => {
    await acknowledgeAlert(alert.id, { acknowledged: true });
    await load();
  };

  const handleToggleWatch = async (entry: WatchlistEntryV1) => {
    await updateWatchlistEntry(entry.id, { isActive: !entry.isActive });
    await load();
  };

  const handleWatchFromAlert = async (alert: AdminAlertV1) => {
    await createWatchlistEntry({
      targetType: alert.resource.type as "portfolio" | "application" | "maintenance" | "lease",
      targetId: alert.resource.id,
      portfolioId: alert.resource.portfolioId || null,
      notes: alert.reason.summary,
      tags: alert.tags || [],
    });
    await load();
  };

  return (
    <MacShell title="Admin · Alerts">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Admin Alerts + Watchlist</h1>
                <Pill tone="accent">Operations</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 820 }}>
                Admin-only operational alerting and watch visibility built from triage, resolution, and portfolio trend signals.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <AlertFilterBar
          category={category}
          severity={severity}
          resourceType={resourceType}
          watchedOnly={watchedOnly}
          onCategoryChange={setCategory}
          onSeverityChange={setSeverity}
          onResourceTypeChange={setResourceType}
          onWatchedOnlyChange={setWatchedOnly}
          onRefresh={() => void load()}
          loading={loading}
        />

        {loading ? <Card>Loading alerts…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load alerts: {error}</Card> : null}

        {!loading && !error ? (
          <>
            <Card>
              <div style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Active alerts</h2>
                <AlertTable alerts={alerts} onAcknowledge={handleAcknowledge} />
                {alerts.length ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {alerts.map((alert) => (
                      <button key={`watch-${alert.id}`} type="button" onClick={() => void handleWatchFromAlert(alert)}>
                        Watch {alert.resource.type} {alert.resource.id}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Watchlist</h2>
                <WatchlistTable watchlist={watchlist} onToggle={handleToggleWatch} />
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
