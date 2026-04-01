import React from "react";
import { Button, Card, Pill } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import type { ScreeningHistoryDetail } from "@/api/screeningApi";
import { ReportStatusBadge } from "./ReportStatusBadge";
import { ScreeningSummaryCard } from "./ScreeningSummaryCard";

type Props = {
  open: boolean;
  screening: ScreeningHistoryDetail | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onViewReport: () => void;
  onRescreen: () => void;
  reportLoading?: boolean;
};

function formatDate(value: string | number | null | undefined) {
  if (!value) return "-";
  const parsed = typeof value === "number" ? value : Date.parse(String(value));
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleString();
}

function reportStatusCopy(status: ScreeningHistoryDetail["report"]["status"]) {
  switch (status) {
    case "available":
      return "The full report is stored securely by RentChain and can be viewed through this controlled access path.";
    case "archived":
      return "The provider report is archived. Keep using the retained summary while retrieval is coordinated.";
    case "retrieval_required":
      return "The full report is not immediately accessible. Retrieval from the provider is required.";
    case "pending":
      return "The report is still being processed. The summary will update when the provider finishes.";
    case "failed":
      return "The report could not be produced. The summary history remains available for audit purposes.";
    default:
      return "RentChain retained the screening summary and metadata, but the raw provider report is not stored.";
  }
}

export function ScreeningDetailDrawer({
  open,
  screening,
  loading = false,
  error = null,
  onClose,
  onViewReport,
  onRescreen,
  reportLoading = false,
}: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.68)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "min(720px, 100vw)",
          height: "100%",
          background: colors.page,
          borderLeft: `1px solid ${colors.border}`,
          overflowY: "auto",
          padding: spacing.lg,
          display: "grid",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>Screening detail</div>
            <div style={{ color: text.muted, fontSize: 14 }}>
              Review the landlord summary, metadata, and secure report status in one place.
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {loading ? (
          <div style={{ color: text.muted }}>Loading screening detail...</div>
        ) : error ? (
          <Card style={{ color: colors.danger, border: "1px solid rgba(239,68,68,0.4)" }}>{error}</Card>
        ) : screening ? (
          <>
            <ScreeningSummaryCard screening={screening} />

            <Card style={{ display: "grid", gap: spacing.md }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Report access</div>
                <ReportStatusBadge status={screening.report.status} />
              </div>
              <div style={{ color: text.muted, fontSize: 14 }}>{reportStatusCopy(screening.report.status)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  variant="secondary"
                  onClick={onViewReport}
                  disabled={screening.report.status !== "available" || reportLoading}
                >
                  {reportLoading ? "Opening..." : screening.report.status === "available" ? "View Report" : "Report unavailable"}
                </Button>
                <Button variant="ghost" onClick={onRescreen}>
                  Re-screen
                </Button>
              </div>
            </Card>

            <Card style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Screening metadata</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing.sm }}>
                <div>
                  <div style={{ color: text.muted, fontSize: 12 }}>Provider</div>
                  <div>{screening.provider}</div>
                </div>
                <div>
                  <div style={{ color: text.muted, fontSize: 12 }}>Package</div>
                  <div>{screening.metadata.packageType || screening.screeningType || "-"}</div>
                </div>
                <div>
                  <div style={{ color: text.muted, fontSize: 12 }}>Requested</div>
                  <div>{formatDate(screening.requestedAt)}</div>
                </div>
                <div>
                  <div style={{ color: text.muted, fontSize: 12 }}>Completed</div>
                  <div>{formatDate(screening.screenedAt)}</div>
                </div>
                <div>
                  <div style={{ color: text.muted, fontSize: 12 }}>Reference</div>
                  <div>{screening.metadata.referenceId || screening.providerReferenceId || "-"}</div>
                </div>
                <div>
                  <div style={{ color: text.muted, fontSize: 12 }}>Application status</div>
                  <div>{screening.applicationStatus || "-"}</div>
                </div>
              </div>
            </Card>

            <Card style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Audit</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>Report views: {screening.audit.accessCount ?? 0}</Pill>
                <Pill>Last viewed: {formatDate(screening.audit.lastViewedAt)}</Pill>
              </div>
            </Card>
          </>
        ) : (
          <div style={{ color: text.muted }}>Select a screening to review.</div>
        )}
      </div>
    </div>
  );
}

export default ScreeningDetailDrawer;
