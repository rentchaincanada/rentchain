import React from "react";
import { Button, Card, Pill } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import type { ScreeningHistoryRecord } from "@/api/screeningApi";
import { ReportStatusBadge } from "./ReportStatusBadge";

type Props = {
  items: ScreeningHistoryRecord[];
  loading?: boolean;
  onViewSummary: (item: ScreeningHistoryRecord) => void;
  onViewReport: (item: ScreeningHistoryRecord) => void;
  onRescreen: () => void;
  reportLoadingId?: string | null;
};

function formatDate(value: string | number | null | undefined) {
  if (!value) return "-";
  const parsed = typeof value === "number" ? value : Date.parse(String(value));
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleString();
}

export function ScreeningHistoryTable({
  items,
  loading = false,
  onViewSummary,
  onViewReport,
  onRescreen,
  reportLoadingId = null,
}: Props) {
  if (loading) {
    return <div style={{ color: text.muted, fontSize: 13 }}>Loading screening history...</div>;
  }

  if (!items.length) {
    return (
      <Card style={{ padding: spacing.md, display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>No screenings yet</div>
        <div style={{ color: text.muted, fontSize: 14 }}>
          Start the first screening when you are ready to evaluate this applicant.
        </div>
        <div>
          <Button variant="secondary" onClick={onRescreen}>
            Start screening
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      {items.map((item) => (
        <Card
          key={item.id}
          style={{
            padding: spacing.md,
            borderRadius: radius.xl,
            display: "grid",
            gap: spacing.sm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 700 }}>{formatDate(item.screenedAt || item.requestedAt)}</div>
              <div style={{ color: text.muted, fontSize: 13 }}>
                {[item.applicantName, item.provider, item.screeningType].filter(Boolean).join(" - ")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Pill tone="accent">{item.result}</Pill>
              <Pill>{item.riskLevel}</Pill>
              <ReportStatusBadge status={item.report.status} />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: spacing.sm,
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ color: text.muted }}>Flags</div>
              <div>{item.summary.flags.length ? item.summary.flags.join(", ") : "None"}</div>
            </div>
            <div>
              <div style={{ color: text.muted }}>Score band</div>
              <div>{item.summary.scoreBand || "-"}</div>
            </div>
            <div>
              <div style={{ color: text.muted }}>Confidence</div>
              <div>{item.summary.confidence || "-"}</div>
            </div>
            <div>
              <div style={{ color: text.muted }}>Viewed</div>
              <div>{item.audit.accessCount ?? 0} times</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => onViewSummary(item)}>
              View summary
            </Button>
            <Button
              variant="secondary"
              onClick={() => onViewReport(item)}
              disabled={item.report.status !== "available" || reportLoadingId === item.id}
            >
              {reportLoadingId === item.id ? "Opening..." : item.report.status === "available" ? "View report" : "Report unavailable"}
            </Button>
            <Button variant="ghost" onClick={onRescreen}>
              Re-screen
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default ScreeningHistoryTable;
