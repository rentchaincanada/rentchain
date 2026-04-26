import React from "react";
import { Link } from "react-router-dom";
import {
  fetchLandlordInbox,
  type LandlordInboxItem,
  type LandlordInboxResponse,
} from "../../api/landlordAnalyticsApi";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load landlord inbox";
}

function priorityTone(priority: LandlordInboxItem["priority"]) {
  if (priority === "high") return { color: "#991b1b", background: "rgba(239, 68, 68, 0.12)" };
  if (priority === "medium") return { color: "#92400e", background: "rgba(245, 158, 11, 0.14)" };
  return { color: "#075985", background: "rgba(14, 165, 233, 0.12)" };
}

function readinessTone(readiness: NonNullable<LandlordInboxItem["trustSummary"]>["readiness"]) {
  if (readiness === "strong") return { color: "#166534", background: "#dcfce7" };
  if (readiness === "ready") return { color: "#0f766e", background: "#ccfbf1" };
  if (readiness === "emerging") return { color: "#1d4ed8", background: "#dbeafe" };
  return { color: "#9a3412", background: "#ffedd5" };
}

function nextActionLabel(action: LandlordInboxItem["nextAction"]) {
  switch (action) {
    case "request_info":
      return "Request information";
    case "review_documents":
      return "Review supporting records";
    case "review_screening":
      return "Review screening";
    case "prepare_lease":
      return "Open lease workflow";
    case "no_action":
      return "No action needed";
    case "review_application":
    default:
      return "Review application";
  }
}

function sectionLabel(status: LandlordInboxItem["status"]) {
  if (status === "action_required") return "Action required";
  if (status === "pending") return "Pending";
  return "Completed";
}

function groupItems(items: LandlordInboxResponse["items"]) {
  return items.reduce<Record<LandlordInboxItem["status"], LandlordInboxItem[]>>((acc, item) => {
    acc[item.status].push(item);
    return acc;
  }, {
    action_required: [],
    pending: [],
    completed: [],
  });
}

function InboxItemCard({ item }: { item: LandlordInboxItem }) {
  const priority = priorityTone(item.priority);
  const trustTone = item.trustSummary ? readinessTone(item.trustSummary.readiness) : null;

  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span
          style={{
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: "0.78rem",
            fontWeight: 700,
            color: priority.color,
            background: priority.background,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {item.priority}
        </span>
        <span style={{ color: "#64748b", fontSize: "0.82rem", textTransform: "capitalize" }}>{item.type.replace(/_/g, " ")}</span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.title}</div>
        <div style={{ color: "#475569", lineHeight: 1.6 }}>{item.description}</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {item.trustSummary ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: "0.78rem",
                fontWeight: 700,
                color: trustTone?.color,
                background: trustTone?.background,
              }}
            >
              {item.trustSummary.readiness.replace(/_/g, " ")}
            </span>
            <span style={{ color: "#64748b", fontSize: "0.82rem" }}>
              Verification: {item.trustSummary.verificationLevel.replace(/_/g, " ")}
            </span>
          </div>
        ) : null}
        {item.credibilitySummary ? (
          <div style={{ color: "#64748b", fontSize: "0.82rem" }}>
            Credibility completeness: {item.credibilitySummary.completenessLevel}
          </div>
        ) : null}
      </div>
      <div>
        {item.nextActionHref && item.nextAction !== "no_action" ? (
          <Link to={item.nextActionHref}>{nextActionLabel(item.nextAction)}</Link>
        ) : (
          <span style={{ color: "#64748b", fontSize: "0.9rem" }}>{nextActionLabel(item.nextAction)}</span>
        )}
      </div>
    </Card>
  );
}

export default function LandlordInboxPage() {
  const { showToast } = useToast();
  const [data, setData] = React.useState<LandlordInboxResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLandlordInbox();
        if (!mounted) return;
        setData(response);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = errorMessage(err);
        setError(message);
        showToast({
          message: "Failed to load landlord inbox",
          description: message,
          variant: "error",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const groups = groupItems(data?.items || []);

  return (
    <MacShell title="Landlord inbox">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Landlord inbox</h1>
            <div style={{ color: "#475569", maxWidth: 860 }}>
              A consolidated view of current landlord-safe application and lease follow-through, derived from existing review and workflow signals.
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading landlord inbox…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load landlord inbox: {error}</Card> : null}

        {!loading && !error && data ? (
          <>
            <Section style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Inbox summary</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "#475569" }}>
                <span>Action required: {data.summary.actionRequired}</span>
                <span>Pending: {data.summary.pending}</span>
                <span>Completed: {data.summary.completed}</span>
              </div>
            </Section>

            {(["action_required", "pending", "completed"] as const).map((status) => (
              <div key={status} style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{sectionLabel(status)}</div>
                {groups[status].length ? (
                  groups[status].map((item) => <InboxItemCard key={item.id} item={item} />)
                ) : (
                  <Card style={{ color: "#64748b" }}>No {sectionLabel(status).toLowerCase()} items are visible right now.</Card>
                )}
              </div>
            ))}
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
