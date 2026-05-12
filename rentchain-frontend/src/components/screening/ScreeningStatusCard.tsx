import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import { ScreeningStatusBadge } from "./ScreeningStatusBadge";
import type { ScreeningStatusView } from "@/api/screeningOpsApi";

type Props = {
  status: ScreeningStatusView | null;
  loading?: boolean;
  actionLoading?: boolean;
  onPrimaryAction?: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleString();
}

function getBadge(status: ScreeningStatusView["status"]) {
  switch (status) {
    case "blocked_transunion_not_connected":
      return { label: "Next step required", tone: "danger" as const };
    case "requested":
      return { label: "Screening requested", tone: "info" as const };
    case "in_progress":
      return { label: "Screening in progress", tone: "info" as const };
    case "completed":
      return { label: "Screening completed", tone: "success" as const };
    case "cancelled":
      return { label: "Screening cancelled", tone: "danger" as const };
    default:
      return { label: "Not started", tone: "neutral" as const };
  }
}

function getDescription(status: ScreeningStatusView["status"]) {
  switch (status) {
    case "blocked_transunion_not_connected":
      return "Connect the configured screening provider to continue. We'll help you complete screening step by step once provider access is linked.";
    case "requested":
      return "Your screening request is in the queue. We’ll guide it through the remaining internal review steps.";
    case "in_progress":
      return "Screening is underway. We’ll update this status as each step is completed.";
    case "completed":
      return "The screening result is ready to review.";
    case "cancelled":
      return "This screening request was cancelled.";
    default:
      return "Start screening when you're ready. We’ll help you complete each step from request to review.";
  }
}

function getActionLabel(status: ScreeningStatusView): string {
  if (status.status === "blocked_transunion_not_connected") return "Connect screening provider";
  return status.actionLabel;
}

export function ScreeningStatusCard({
  status,
  loading = false,
  actionLoading = false,
  onPrimaryAction,
}: Props) {
  if (loading) {
    return (
      <Card style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Manual screening status</div>
        <div style={{ color: text.muted }}>Loading screening status...</div>
      </Card>
    );
  }

  if (!status) return null;

  const badge = getBadge(status.status);
  const requestedAt = formatDate(status.requestedAt);
  const startedAt = formatDate(status.startedAt);
  const completedAt = formatDate(status.completedAt);
  const cancelledAt = formatDate(status.cancelledAt);

  return (
    <Card
      style={{
        display: "grid",
        gap: spacing.sm,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Manual screening status</div>
          <div style={{ color: text.muted, fontSize: 13 }}>{getDescription(status.status)}</div>
        </div>
        <ScreeningStatusBadge label={badge.label} tone={badge.tone} />
      </div>

      <div style={{ display: "grid", gap: 6, fontSize: 13, color: text.muted }}>
        {requestedAt ? <div>Requested: {requestedAt}</div> : null}
        {startedAt ? <div>Started: {startedAt}</div> : null}
        {completedAt ? <div>Completed: {completedAt}</div> : null}
        {cancelledAt ? <div>Cancelled: {cancelledAt}</div> : null}
        {status.resultSummary ? (
          <div style={{ color: text.primary }}>
            <strong>Result Summary:</strong> {status.resultSummary}
          </div>
        ) : null}
        {status.resultFlags?.length ? (
          <div style={{ color: text.primary }}>
            <strong>Flags:</strong> {status.resultFlags.join(", ")}
          </div>
        ) : null}
        {status.status === "blocked_transunion_not_connected" ? (
          <div style={{ color: text.primary }}>
            <strong>Step-by-step:</strong> Connect provider access, request screening, then review the completed result here.
          </div>
        ) : null}
        {status.reportAvailable ? (
          <div style={{ color: text.primary }}>Report available</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button type="button" onClick={onPrimaryAction} disabled={actionLoading}>
          {actionLoading ? "Working..." : getActionLabel(status)}
        </Button>
      </div>
    </Card>
  );
}
