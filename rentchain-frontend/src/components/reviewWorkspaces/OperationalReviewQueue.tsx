import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Ui";
import { ReviewAssignmentStatusControls } from "./ReviewAssignmentStatusControls";

export type OperationalReviewQueueItem = {
  queueItemId: string;
  title: string;
  contextLabel: string;
  sourceLabel: string;
  destination: string;
  workspaceType: string;
  reviewStatus: string;
  reviewPriority: string;
  routingReason: string;
  assignmentLabel: string;
  workflowStatus: string;
  financialStatus?: string | null;
  sensitivityClass: string;
  visibilityClass: string;
  evidenceLabel: string;
  relatedResourceLabel: string;
  manualOnly: true;
  autonomousActionsEnabled: false;
};

function label(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeDisplayLabel(value: string, fallback: string) {
  const raw = String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  if (/^(Lease|Property|Tenant|Unit|Decision)\s+[A-Za-z0-9:_-]{12,}$/i.test(raw)) return fallback;
  return raw;
}

function metadata(labelText: string, value: string | null | undefined) {
  if (!value) return null;
  return (
    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>{labelText}</span>
      <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 900, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

export function OperationalReviewQueue({ items }: { items: OperationalReviewQueueItem[] }) {
  const assignedCount = items.filter((item) => !/^unassigned$/i.test(item.assignmentLabel)).length;

  return (
    <Card
      data-testid="operational-review-queue"
      style={{
        borderRadius: 10,
        padding: 14,
        border: "1px solid #dbe3ef",
        background: "#ffffff",
        display: "grid",
        gap: 12,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <strong style={{ color: "#0f172a", fontSize: 16 }}>Operational review queue</strong>
          <span style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
            Manual intake visibility for reviewable operational work. This queue does not create workspaces, route work automatically,
            or change source records.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle("#dbeafe", "#1d4ed8", "#bfdbfe")}>{items.length} reviewable</span>
          <span style={pillStyle("#f8fafc", "#475569", "#dbe3ef")}>{assignedCount} assigned</span>
        </div>
      </div>

      {items.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 10,
            minWidth: 0,
          }}
        >
          {items.map((item) => (
            <Card
              key={item.queueItemId}
              style={{
                borderRadius: 8,
                padding: 12,
                border: "1px solid rgba(15, 23, 42, 0.08)",
                display: "grid",
                gap: 10,
                minWidth: 0,
                overflowWrap: "anywhere",
              }}
            >
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={pillStyle("#fef3c7", "#92400e", "#fde68a")}>{item.reviewPriority}</span>
                  <span style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>{label(item.workspaceType)}</span>
                </div>
                <strong style={{ color: "#0f172a", fontSize: 15 }}>{safeDisplayLabel(item.title, "Operational review item")}</strong>
                <span style={{ color: "#475569", fontSize: 13 }}>
                  {safeDisplayLabel(item.contextLabel, "Operational review context")}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                {metadata("Routing reason", item.routingReason)}
                {metadata("Source", item.sourceLabel)}
                {metadata("Review status", item.reviewStatus)}
                {metadata("Assignment", item.assignmentLabel)}
                {metadata("Workflow status", item.workflowStatus)}
                {metadata("Financial status", item.financialStatus || null)}
                {metadata("Sensitivity", label(item.sensitivityClass))}
                {metadata("Visibility", label(item.visibilityClass))}
              </div>

              <ReviewAssignmentStatusControls
                itemId={item.queueItemId}
                title={safeDisplayLabel(item.title, "Operational review item")}
                initialStatus={item.reviewStatus}
                initialAssignment={item.assignmentLabel}
              />

              <div style={{ display: "grid", gap: 5 }}>
                <span style={{ color: "#334155", fontSize: 12, fontWeight: 900 }}>Scoped evidence/resource links</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Link to={item.destination} style={{ color: "#2563eb", fontSize: 13, fontWeight: 900 }}>
                    {safeDisplayLabel(item.evidenceLabel, "Open source workflow evidence")}
                  </Link>
                  <span
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: "#475569",
                      fontSize: 12,
                      fontWeight: 800,
                      background: "#fff",
                    }}
                  >
                    {safeDisplayLabel(item.relatedResourceLabel, "Scoped resource context")}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
          No reviewable operational queue items match the current filters. Adjust the triage view or reset filters to review the full
          operational queue.
        </div>
      )}
    </Card>
  );
}

function pillStyle(background: string, color: string, border: string): React.CSSProperties {
  return {
    border: `1px solid ${border}`,
    background,
    color,
    borderRadius: 999,
    padding: "3px 9px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}
