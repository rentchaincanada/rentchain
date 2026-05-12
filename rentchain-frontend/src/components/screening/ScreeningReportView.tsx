import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";

export type ScreeningReportFinding = {
  key: string;
  title: string;
  value: string;
  helper?: string | null;
};

export type ScreeningReportFlag = {
  key: string;
  label: string;
  description?: string | null;
};

export type ScreeningReportAction =
  | {
      key: string;
      label: string;
      onClick: () => void;
      disabled?: boolean;
    }
  | {
      key: string;
      label: string;
      href: string;
      disabled?: boolean;
    };

type Props = {
  applicantName: string;
  propertyLabel?: string | null;
  unitLabel?: string | null;
  status: string;
  provider?: string | null;
  completedAt?: string | null;
  recommendation: "Proceed" | "Caution" | "High risk" | "Pending";
  riskGrade?: string | null;
  confidence?: string | null;
  findings: ScreeningReportFinding[];
  flags: ScreeningReportFlag[];
  recommendedActions: string[];
  actions?: ScreeningReportAction[];
  details?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleString();
}

function recommendationTone(value: Props["recommendation"]) {
  switch (value) {
    case "Proceed":
      return {
        border: "rgba(22,163,74,0.24)",
        background: "rgba(240,253,244,0.98)",
        color: "#166534",
      };
    case "Caution":
      return {
        border: "rgba(245,158,11,0.24)",
        background: "rgba(255,251,235,0.98)",
        color: "#b45309",
      };
    case "High risk":
      return {
        border: "rgba(239,68,68,0.22)",
        background: "rgba(254,242,242,0.98)",
        color: "#b91c1c",
      };
    default:
      return {
        border: colors.border,
        background: "rgba(248,250,252,0.98)",
        color: text.secondary,
      };
  }
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function providerLabel(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Configured screening provider";
  if (normalized === "transunion" || normalized === "transunion_manual") return "TransUnion";
  return value || "Configured screening provider";
}

export function ScreeningReportView({
  applicantName,
  propertyLabel,
  unitLabel,
  status,
  provider,
  completedAt,
  recommendation,
  riskGrade,
  confidence,
  findings,
  flags,
  recommendedActions,
  actions = [],
  details,
}: Props) {
  const completedLabel = formatDate(completedAt);
  const tone = recommendationTone(recommendation);

  return (
    <Card
      style={{
        display: "grid",
        gap: spacing.md,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.xl,
        background: "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96))",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: spacing.md,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Screening report</div>
          <div style={{ color: text.primary, fontWeight: 700 }}>{applicantName}</div>
          <div style={{ color: text.muted, fontSize: 13 }}>
            {[propertyLabel, unitLabel].filter(Boolean).join(" · ") || "Property details unavailable"}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: text.subtle }}>
            <span>Status: {statusLabel(status)}</span>
            <span>Provider: {providerLabel(provider)}</span>
            {completedLabel ? <span>Completed: {completedLabel}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          {actions.map((action) =>
            "href" in action ? (
              <a
                key={action.key}
                href={action.disabled ? undefined : action.href}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
                aria-disabled={action.disabled ? "true" : undefined}
              >
                <Button type="button" variant="secondary" disabled={action.disabled}>
                  {action.label}
                </Button>
              </a>
            ) : (
              <Button
                key={action.key}
                type="button"
                variant={action.key === "download" ? "primary" : "secondary"}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            )
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: spacing.sm,
        }}
      >
        <div
          style={{
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
            borderRadius: radius.lg,
            padding: spacing.md,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>
            Recommendation
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{recommendation}</div>
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            background: "rgba(255,255,255,0.96)",
            borderRadius: radius.lg,
            padding: spacing.md,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700, color: text.muted }}>
            Risk grade
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{riskGrade || "Pending"}</div>
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            background: "rgba(255,255,255,0.96)",
            borderRadius: radius.lg,
            padding: spacing.md,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700, color: text.muted }}>
            Confidence
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{confidence || "Pending"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Key findings</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: spacing.sm,
          }}
        >
          {findings.map((finding) => (
            <div
              key={finding.key}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                background: "rgba(255,255,255,0.96)",
                padding: spacing.md,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: text.muted }}>
                {finding.title}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: text.primary }}>{finding.value}</div>
              {finding.helper ? <div style={{ fontSize: 12, color: text.subtle }}>{finding.helper}</div> : null}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Flags</div>
        {flags.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {flags.map((flag) => (
              <div
                key={flag.key}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  background: "rgba(255,255,255,0.96)",
                  padding: spacing.sm,
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 700 }}>{flag.label}</div>
                {flag.description ? <div style={{ color: text.muted, fontSize: 13 }}>{flag.description}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: text.muted, fontSize: 13 }}>No major flags were surfaced for this screening.</div>
        )}
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Recommended actions</div>
        {recommendedActions.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, color: text.secondary, fontSize: 14 }}>
            {recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        ) : (
          <div style={{ color: text.muted, fontSize: 13 }}>No follow-up actions were suggested.</div>
        )}
      </div>

      {details ? (
        <details
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            background: "rgba(255,255,255,0.96)",
            padding: spacing.md,
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>View detailed notes</summary>
          <div style={{ marginTop: spacing.sm, whiteSpace: "pre-wrap", fontSize: 13, color: text.secondary }}>
            {details}
          </div>
        </details>
      ) : null}
    </Card>
  );
}
