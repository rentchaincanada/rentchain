import React, { useState } from "react";
import { Button, Card, Input } from "@/components/ui/Ui";
import { spacing, text } from "@/styles/tokens";
import type { ScreeningOperation } from "@/api/screeningOpsApi";

type Props = {
  operation: ScreeningOperation | null;
  actionLoading?: boolean;
  onStart?: () => void;
  onComplete?: (payload: {
    resultSummary?: string | null;
    resultFlags?: string[];
    reportUrl?: string | null;
    reportExportId?: string | null;
    operatorNotes?: string | null;
  }) => void;
  onCancel?: (payload: { cancelledReason?: string | null }) => void;
};

function splitFlags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function ScreeningOpDetail({
  operation,
  actionLoading = false,
  onStart,
  onComplete,
  onCancel,
}: Props) {
  const [resultSummary, setResultSummary] = useState("");
  const [flags, setFlags] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [reportExportId, setReportExportId] = useState("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [cancelledReason, setCancelledReason] = useState("");

  if (!operation) {
    return (
      <Card style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Operation detail</div>
        <div style={{ color: text.muted }}>Select a screening operation to manage it.</div>
      </Card>
    );
  }

  const canStart = operation.status === "requested";
  const canComplete = operation.status === "requested" || operation.status === "in_progress";
  const canCancel = canComplete;

  return (
    <Card style={{ display: "grid", gap: spacing.md }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Operation detail</div>
        <div style={{ color: text.muted, fontSize: 13 }}>
          {operation.applicantName || "Applicant"} · {operation.applicationId}
        </div>
      </div>

      <div style={{ display: "grid", gap: 4, fontSize: 13, color: text.muted }}>
        <div>Status: {operation.status}</div>
        <div>Requested: {new Date(operation.requestedAt).toLocaleString()}</div>
        {operation.startedAt ? <div>Started: {new Date(operation.startedAt).toLocaleString()}</div> : null}
        {operation.completedAt ? <div>Completed: {new Date(operation.completedAt).toLocaleString()}</div> : null}
        {operation.cancelledAt ? <div>Cancelled: {new Date(operation.cancelledAt).toLocaleString()}</div> : null}
      </div>

      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button type="button" onClick={onStart} disabled={!canStart || actionLoading}>
          Mark In Progress
        </Button>
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Complete screening</div>
        <Input
          aria-label="Result Summary"
          placeholder="Result Summary"
          value={resultSummary}
          onChange={(event) => setResultSummary(event.target.value)}
        />
        <Input
          aria-label="Flags"
          placeholder="Flags"
          value={flags}
          onChange={(event) => setFlags(event.target.value)}
        />
        <Input
          aria-label="Report URL"
          placeholder="Report URL"
          value={reportUrl}
          onChange={(event) => setReportUrl(event.target.value)}
        />
        <Input
          aria-label="Report Export ID"
          placeholder="Report Export ID"
          value={reportExportId}
          onChange={(event) => setReportExportId(event.target.value)}
        />
        <Input
          aria-label="Operator Notes"
          placeholder="Operator Notes"
          value={operatorNotes}
          onChange={(event) => setOperatorNotes(event.target.value)}
        />
        <Button
          type="button"
          onClick={() =>
            onComplete?.({
              resultSummary: resultSummary || null,
              resultFlags: splitFlags(flags),
              reportUrl: reportUrl || null,
              reportExportId: reportExportId || null,
              operatorNotes: operatorNotes || null,
            })
          }
          disabled={!canComplete || actionLoading}
        >
          Mark Completed
        </Button>
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Cancel screening</div>
        <Input
          aria-label="Cancelled Reason"
          placeholder="Cancelled Reason"
          value={cancelledReason}
          onChange={(event) => setCancelledReason(event.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => onCancel?.({ cancelledReason: cancelledReason || null })}
          disabled={!canCancel || actionLoading}
        >
          Cancel Screening
        </Button>
      </div>
    </Card>
  );
}
