import React from "react";
import { RiskScoreBadge } from "@/components/leases/RiskScoreBadge";
import type { CredibilityInsights, CredibilityTrend } from "@/types/credibilityInsights";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

interface CredibilityInsightsCardProps {
  insights?: CredibilityInsights | null;
}

function formatConfidence(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}% confidence`;
}

function formatGeneratedAt(value?: string | null) {
  if (!value) return "Recently updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently updated";
  return `Updated ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function trendLabel(trend?: CredibilityTrend | null) {
  switch (trend) {
    case "up":
      return "Improving";
    case "down":
      return "Softening";
    case "flat":
      return "Stable";
    default:
      return "Unknown";
  }
}

function trendTone(trend?: CredibilityTrend | null) {
  switch (trend) {
    case "up":
      return { background: "rgba(220,252,231,0.9)", border: "rgba(34,197,94,0.3)", color: "#166534" };
    case "down":
      return { background: "rgba(254,226,226,0.95)", border: "rgba(239,68,68,0.28)", color: "#b91c1c" };
    case "flat":
      return { background: "rgba(241,245,249,0.95)", border: "rgba(148,163,184,0.3)", color: "#475569" };
    default:
      return { background: "rgba(248,250,252,0.95)", border: "rgba(148,163,184,0.24)", color: "#64748b" };
  }
}

const ItemList: React.FC<{ items: string[]; emptyLabel: string }> = ({ items, emptyLabel }) => {
  if (!items.length) {
    return <div style={{ color: text.subtle, fontSize: 12 }}>{emptyLabel}</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 9px",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: "rgba(248,250,252,0.96)",
            color: text.secondary,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

const InsightSection: React.FC<{
  title: string;
  subtitle: string;
  grade?: string | null;
  score?: number | null;
  confidence?: number | null;
  trend?: CredibilityTrend | null;
  generatedAt?: string | null;
  labels: { signals: string; actions: string };
  signals: string[];
  recommendations: string[];
}> = ({ title, subtitle, grade, score, confidence, trend, generatedAt, labels, signals, recommendations }) => {
  const tone = trendTone(trend);
  return (
    <div
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        background: "rgba(255,255,255,0.96)",
        padding: spacing.md,
        display: "grid",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: text.primary, fontWeight: 800, fontSize: 15 }}>{title}</div>
          <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <RiskScoreBadge grade={(grade as any) || null} score={score ?? null} />
          {trend ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 9px",
                borderRadius: radius.pill,
                border: `1px solid ${tone.border}`,
                background: tone.background,
                color: tone.color,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Trend: {trendLabel(trend)}
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: text.secondary, fontSize: 12 }}>
        <span>{formatConfidence(confidence)}</span>
        <span>{formatGeneratedAt(generatedAt)}</span>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {labels.signals}
        </div>
        <ItemList items={signals} emptyLabel="No notable signals yet." />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {labels.actions}
        </div>
        <ItemList items={recommendations} emptyLabel="No suggested actions right now." />
      </div>
    </div>
  );
};

export const CredibilityInsightsCard: React.FC<CredibilityInsightsCardProps> = ({ insights }) => {
  const tenantScore = insights?.tenantScore ?? null;
  const leaseRisk = insights?.leaseRisk ?? null;
  const hasInsights = Boolean(tenantScore || leaseRisk);

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
        <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Tenant credibility insights</div>
        <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
          This view summarizes current lease and tenant stability signals. For decision support only.
        </div>
      </div>

      {!hasInsights ? (
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
          Credibility insights will appear as lease and tenant history becomes available.
        </div>
      ) : (
        <div style={{ display: "grid", gap: spacing.md }}>
          {tenantScore ? (
            <InsightSection
              title="Tenant Score"
              subtitle="Signals update as lease and payment data changes."
              grade={tenantScore.grade}
              score={tenantScore.score}
              confidence={tenantScore.confidence}
              trend={tenantScore.trend}
              generatedAt={tenantScore.generatedAt}
              labels={{ signals: "Signals", actions: "Suggested Actions" }}
              signals={tenantScore.signals}
              recommendations={tenantScore.recommendations}
            />
          ) : null}

          {leaseRisk ? (
            <InsightSection
              title="Lease Risk"
              subtitle="Current lease conditions help highlight payment and stability risk." 
              grade={leaseRisk.grade}
              score={leaseRisk.score}
              confidence={leaseRisk.confidence}
              generatedAt={leaseRisk.generatedAt}
              labels={{ signals: "Risk Signals", actions: "Recommended Review" }}
              signals={leaseRisk.flags}
              recommendations={leaseRisk.recommendations}
            />
          ) : null}
        </div>
      )}
    </section>
  );
};
