import React from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import {
  fetchAdminLeaseLifecycleReviewQueue,
  updateAdminLeaseLifecycleReviewAcknowledgement,
  type AdminLeaseLifecycleReviewAcknowledgement,
  type AdminLeaseLifecycleReviewHistoryEvent,
  type AdminLeaseLifecycleReviewItem,
  type AdminLeaseLifecycleReviewSummary,
  type LeaseLifecycleReviewSeverity,
} from "../../api/adminLeaseLifecycleReviewApi";

const emptySummary: AdminLeaseLifecycleReviewSummary = {
  total: 0,
  critical: 0,
  warning: 0,
  info: 0,
};

const severityTone: Record<LeaseLifecycleReviewSeverity, React.CSSProperties> = {
  critical: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" },
  warning: { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" },
  info: { background: "#e0f2fe", color: "#075985", borderColor: "#bae6fd" },
};

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function reasonText(item: AdminLeaseLifecycleReviewItem) {
  return item.derivedLifecycleReasons?.length ? item.derivedLifecycleReasons.join(", ") : item.description;
}

function acknowledgementLabel(acknowledgement: AdminLeaseLifecycleReviewAcknowledgement | null) {
  if (!acknowledgement) return "open";
  if (acknowledgement.status === "snoozed" && acknowledgement.snoozedUntil) {
    return `snoozed until ${new Date(acknowledgement.snoozedUntil).toLocaleDateString()}`;
  }
  if (acknowledgement.status === "assigned" && acknowledgement.assignedTo) {
    return `assigned to ${acknowledgement.assignedTo}`;
  }
  return acknowledgement.status;
}

function formatHistoryTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value || "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function historyActor(event: AdminLeaseLifecycleReviewHistoryEvent) {
  return event.actorEmail || event.actorId || "Unknown admin";
}

function historyLine(event: AdminLeaseLifecycleReviewHistoryEvent) {
  const details = [
    event.assignedTo ? `assigned to ${event.assignedTo}` : null,
    event.snoozedUntil ? `snoozed until ${new Date(event.snoozedUntil).toLocaleDateString()}` : null,
  ].filter(Boolean);
  return details.length ? `${event.action.replace(/_/g, " ")} - ${details.join(", ")}` : event.action.replace(/_/g, " ");
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 700 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: "1.45rem", fontWeight: 800 }}>{value}</div>
    </Card>
  );
}

function QueueItemRow({
  item,
  busy,
  onAcknowledge,
}: {
  item: AdminLeaseLifecycleReviewItem;
  busy: boolean;
  onAcknowledge: (
    item: AdminLeaseLifecycleReviewItem,
    payload: { status: "reviewed" | "snoozed" | "assigned"; assignedTo?: string | null; snoozedUntil?: string | null; note?: string | null }
  ) => void;
}) {
  return (
    <tr>
      <td style={{ padding: "12px 10px", verticalAlign: "top", borderBottom: "1px solid #e2e8f0" }}>
        <Pill style={severityTone[item.severity]}>{item.severity}</Pill>
      </td>
      <td style={{ padding: "12px 10px", verticalAlign: "top", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>{formatLabel(item.category)}</div>
        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>{formatLabel(item.derivedLifecycleState)}</div>
      </td>
      <td style={{ padding: "12px 10px", verticalAlign: "top", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <Link to={`/admin/leases?q=${encodeURIComponent(item.leaseId)}`}>{item.leaseId}</Link>
          <span style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Property {item.propertyId || "-"} - Unit {item.unitId || "-"}
          </span>
        </div>
      </td>
      <td style={{ padding: "12px 10px", verticalAlign: "top", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.title}</div>
        <div style={{ color: "#475569", marginTop: 4 }}>{item.description}</div>
        <div style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 6 }}>{reasonText(item)}</div>
      </td>
      <td style={{ padding: "12px 10px", verticalAlign: "top", borderBottom: "1px solid #e2e8f0" }}>
        <span style={{ color: "#0f172a", fontWeight: 700 }}>{item.recommendedAction}</span>
      </td>
      <td style={{ padding: "12px 10px", verticalAlign: "top", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <Pill>{acknowledgementLabel(item.acknowledgement)}</Pill>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => onAcknowledge(item, { status: "reviewed", note: "Reviewed from lease lifecycle queue" })}
            >
              Mark reviewed
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                onAcknowledge(item, {
                  status: "snoozed",
                  snoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  note: "Snoozed for follow-up",
                })
              }
            >
              Snooze
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => onAcknowledge(item, { status: "assigned", assignedTo: "operations", note: "Assigned from lease lifecycle queue" })}
            >
              Assign
            </Button>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>Recent history</div>
            {item.recentHistory?.length ? (
              item.recentHistory.map((event) => (
                <div key={event.historyId} style={{ color: "#475569", fontSize: 12, lineHeight: 1.35 }}>
                  <strong style={{ color: "#0f172a" }}>{historyLine(event)}</strong>
                  <div>
                    {historyActor(event)} · {formatHistoryTimestamp(event.createdAt)}
                  </div>
                  {event.note ? <div>{event.note}</div> : null}
                </div>
              ))
            ) : (
              <div style={{ color: "#64748b", fontSize: 12 }}>No history yet.</div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminLeaseLifecycleReviewPage() {
  const [items, setItems] = React.useState<AdminLeaseLifecycleReviewItem[]>([]);
  const [summary, setSummary] = React.useState<AdminLeaseLifecycleReviewSummary>(emptySummary);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyItemId, setBusyItemId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchAdminLeaseLifecycleReviewQueue({ limit: 100 });
      setItems(response.items || []);
      setSummary(response.summary || emptySummary);
    } catch (err: any) {
      setError(err?.message || "Failed to load lease lifecycle review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleAcknowledge = React.useCallback(
    async (
      item: AdminLeaseLifecycleReviewItem,
      payload: { status: "reviewed" | "snoozed" | "assigned"; assignedTo?: string | null; snoozedUntil?: string | null; note?: string | null }
    ) => {
      try {
        setBusyItemId(item.id);
        setError(null);
        const response = await updateAdminLeaseLifecycleReviewAcknowledgement(item.id, payload);
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  acknowledgement: response.acknowledgement,
                  recentHistory: [response.historyEvent, ...(candidate.recentHistory || [])].slice(0, 3),
                }
              : candidate
          )
        );
      } catch (err: any) {
        setError(err?.message || "Failed to update lease lifecycle acknowledgement");
      } finally {
        setBusyItemId(null);
      }
    },
    []
  );

  return (
    <MacShell title="Admin - Lease Lifecycle Review">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Lease Lifecycle Review</h1>
                <Pill tone="accent">Read only</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 820 }}>
                Operator queue for leases whose canonical lifecycle derivation needs review. This page does not mutate lease records or rewrite stored statuses.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="Critical" value={summary.critical} />
          <SummaryCard label="Warning" value={summary.warning} />
          <SummaryCard label="Info" value={summary.info} />
        </div>

        {loading ? <Card>Loading lease lifecycle review queue...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load lease lifecycle review queue: {error}</Card> : null}
        {!loading && !error && items.length === 0 ? (
          <Card>No lease lifecycle review items need attention right now.</Card>
        ) : null}
        {!loading && !error && items.length > 0 ? (
          <Card style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#475569", fontSize: "0.85rem" }}>
                  <th style={{ padding: "0 10px 10px" }}>Severity</th>
                  <th style={{ padding: "0 10px 10px" }}>Category</th>
                  <th style={{ padding: "0 10px 10px" }}>Lease</th>
                  <th style={{ padding: "0 10px 10px" }}>Reason</th>
                  <th style={{ padding: "0 10px 10px" }}>Recommended action</th>
                  <th style={{ padding: "0 10px 10px" }}>Acknowledgement</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <QueueItemRow key={item.id} item={item} busy={busyItemId === item.id} onAcknowledge={handleAcknowledge} />
                ))}
              </tbody>
            </table>
          </Card>
        ) : null}
      </div>
    </MacShell>
  );
}
