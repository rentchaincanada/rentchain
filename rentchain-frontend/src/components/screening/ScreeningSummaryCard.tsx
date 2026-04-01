import React from "react";
import { Card, Pill } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import type { ScreeningHistoryDetail } from "@/api/screeningApi";
import { ReportStatusBadge } from "./ReportStatusBadge";

type Props = {
  screening: ScreeningHistoryDetail;
};

function metricValue(value: string | number | boolean | null | undefined, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function ScreeningSummaryCard({ screening }: Props) {
  const metrics = [
    { label: "Score band", value: screening.summary.scoreBand },
    { label: "Confidence", value: screening.summary.confidence },
    { label: "Open accounts", value: screening.summary.openAccounts },
    { label: "Past due total", value: screening.summary.pastDueTotal },
    { label: "Collections", value: screening.summary.collectionsPresent },
    { label: "Bankruptcy", value: screening.summary.bankruptcyPresent },
    { label: "Recent inquiries", value: screening.summary.inquiriesCount },
  ];

  return (
    <Card
      style={{
        display: "grid",
        gap: spacing.md,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.xl,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Decision summary</div>
          <div style={{ color: text.primary, fontWeight: 700 }}>
            {screening.applicantName || "Applicant"}
          </div>
          <div style={{ color: text.muted, fontSize: 13 }}>
            {[screening.propertyLabel, screening.unitLabel].filter(Boolean).join(" - ") || "Property details unavailable"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Pill tone="accent">{screening.result.replace(/_/g, " ")}</Pill>
          <Pill>{screening.riskLevel}</Pill>
          <ReportStatusBadge status={screening.report.status} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: spacing.sm,
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: spacing.md,
              background: colors.panel,
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: text.muted, textTransform: "uppercase" }}>
              {metric.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{metricValue(metric.value)}</div>
          </div>
        ))}
      </div>

      {screening.summary.flags.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Flags</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {screening.summary.flags.map((flag) => (
              <Pill key={flag}>{flag}</Pill>
            ))}
          </div>
        </div>
      ) : null}

      {screening.summary.notes ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>Notes</div>
          <div style={{ color: text.muted, fontSize: 14 }}>{screening.summary.notes}</div>
        </div>
      ) : null}
    </Card>
  );
}

export default ScreeningSummaryCard;
