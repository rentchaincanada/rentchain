import React from "react";
import { RiskScoreBadge } from "@/components/leases/RiskScoreBadge";
import type { PropertyCredibilitySummary } from "@/types/credibilitySummary";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

interface PropertyCredibilitySummaryCardProps {
  summary?: PropertyCredibilitySummary | null;
}

function healthTone(status?: PropertyCredibilitySummary["healthStatus"] | null) {
  switch (status) {
    case "strong":
      return { background: "rgba(220,252,231,0.92)", border: "rgba(34,197,94,0.28)", color: "#166534", label: "Strong" };
    case "watch":
      return { background: "rgba(254,249,195,0.95)", border: "rgba(234,179,8,0.28)", color: "#a16207", label: "Watch" };
    case "limited-data":
      return { background: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.28)", color: "#475569", label: "Limited data" };
    default:
      return { background: "rgba(248,250,252,0.96)", border: "rgba(148,163,184,0.24)", color: "#64748b", label: "Unknown" };
  }
}

function formatAverage(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return Math.round(value).toString();
}

const MetricTile: React.FC<{ label: string; value: React.ReactNode; caption?: React.ReactNode }> = ({
  label,
  value,
  caption,
}) => (
  <div
    style={{
      borderRadius: radius.lg,
      border: `1px solid ${colors.border}`,
      background: "rgba(255,255,255,0.94)",
      padding: spacing.md,
      display: "grid",
      gap: 6,
    }}
  >
    <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </div>
    <div style={{ color: text.primary, fontSize: 20, fontWeight: 800 }}>{value}</div>
    {caption ? <div style={{ color: text.subtle, fontSize: 12 }}>{caption}</div> : null}
  </div>
);

export const PropertyCredibilitySummaryCard: React.FC<PropertyCredibilitySummaryCardProps> = ({ summary }) => {
  if (!summary || summary.healthStatus === "unknown") {
    return (
      <section
        style={{
          borderRadius: radius.xl,
          border: `1px solid ${colors.borderStrong}`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
          boxShadow: shadows.soft,
          padding: spacing.lg,
          display: "grid",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Property credibility summary</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
            This summary reflects current lease and tenant credibility signals for this property. Decision support only.
          </div>
        </div>
        <div
          style={{
            borderRadius: radius.lg,
            border: `1px dashed ${colors.borderStrong}`,
            background: "rgba(248,250,252,0.92)",
            padding: spacing.md,
            color: text.muted,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Credibility summary will appear as lease and tenant history becomes available.
        </div>
      </section>
    );
  }

  const tone = healthTone(summary.healthStatus);

  return (
    <section
      style={{
        borderRadius: radius.xl,
        border: `1px solid ${colors.borderStrong}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        boxShadow: shadows.soft,
        padding: spacing.lg,
        display: "grid",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Property credibility summary</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
            This summary reflects current lease and tenant credibility signals for this property. Decision support only.
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: radius.pill,
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {tone.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.md }}>
        <MetricTile
          label="Tenant score average"
          value={<RiskScoreBadge grade={summary.tenantScoreGradeAverage} score={summary.tenantScoreAverage} />}
          caption={`${summary.tenantsWithScoreCount} tenants with score`}
        />
        <MetricTile
          label="Lease risk average"
          value={<RiskScoreBadge grade={summary.leaseRiskGradeAverage} score={summary.leaseRiskAverage} />}
          caption={`${summary.leasesWithRiskCount} leases with risk`}
        />
        <MetricTile
          label="Active leases"
          value={summary.activeLeaseCount}
          caption="Current lease agreements in this rollup"
        />
        <MetricTile
          label="Review items"
          value={summary.lowConfidenceCount}
          caption="Low-confidence records to review"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.md }}>
        <MetricTile label="Missing credibility" value={summary.missingCredibilityCount} caption="Records without current score or risk data" />
        <MetricTile label="Tenant score avg" value={formatAverage(summary.tenantScoreAverage)} caption={summary.tenantScoreAverage != null ? `Grade ${summary.tenantScoreGradeAverage}` : "No tenant scores yet"} />
        <MetricTile label="Lease risk avg" value={formatAverage(summary.leaseRiskAverage)} caption={summary.leaseRiskAverage != null ? `Grade ${summary.leaseRiskGradeAverage}` : "No lease risk yet"} />
      </div>
    </section>
  );
};
