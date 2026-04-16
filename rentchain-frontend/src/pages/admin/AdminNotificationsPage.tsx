import React from "react";
import { fetchNotifications, markNotificationRead, type AdminNotificationV1 } from "../../api/adminNotificationApi";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import NotificationList from "../../components/adminNotifications/NotificationList";

export default function AdminNotificationsPage() {
  const { showToast } = useToast();
  const [notifications, setNotifications] = React.useState<AdminNotificationV1[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = React.useState(true);
  const [watchedOnly, setWatchedOnly] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchNotifications({
        unreadOnly,
        watchedOnly,
        limit: 25,
      });
      setNotifications(response.notifications || []);
    } catch (err: any) {
      const message = err?.message || "Failed to load notifications";
      setError(message);
      showToast({
        message: "Failed to load notifications",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, unreadOnly, watchedOnly]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRead = async (notification: AdminNotificationV1) => {
    await markNotificationRead(notification.id, { read: true });
    await load();
  };

  return (
    <MacShell title="Admin · Notifications">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Admin Notifications</h1>
                <Pill tone="accent">Delivery</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 820 }}>
                Pull-based internal delivery for alerts, SLA pressure, triage-worthy issues, and portfolio score changes.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <Card>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                aria-label="Unread only"
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
              />
              Unread only
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                aria-label="Watched only"
                type="checkbox"
                checked={watchedOnly}
                onChange={(event) => setWatchedOnly(event.target.checked)}
              />
              Watched only
            </label>
          </div>
        </Card>

        {loading ? <Card>Loading notifications…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load notifications: {error}</Card> : null}
        {!loading && !error ? (
          <NotificationList notifications={notifications} onMarkRead={handleMarkRead} />
        ) : null}
      </div>
    </MacShell>
  );
}
