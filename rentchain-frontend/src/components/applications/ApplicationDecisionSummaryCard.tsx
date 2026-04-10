import React from "react";
import { RiskScoreBadge } from "@/components/leases/RiskScoreBadge";
import type { ApplicationDecisionSummary } from "@/types/applicationDecisionSummary";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

interface ApplicationDecisionSummaryCardProps {
  summary?: ApplicationDecisionSummary | null;
  onEvaluateRisk?: (() => void | Promise<void>) | null;
  evaluatingRisk?: boolean;
}

function formatConfidence(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Confidence pending";
  return `${Math.round(value * 100)}% confidence`;
}

function formatWhen(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function priorityTone(priority?: string | null) {
  switch (priority) {
    case "high":
      return { background: "rgba(254,242,242,0.95)", border: "rgba(239,68,68,0.18)", color: "#b91c1c" };
    case "medium":
      return { background: "rgba(255,247,237,0.95)", border: "rgba(249,115,22,0.18)", color: "#c2410c" };
    default:
      return { background: "rgba(239,246,255,0.95)", border: "rgba(59,130,246,0.16)", color: "#1d4ed8" };
  }
}

const PillList: React.FC<{ items: string[]; emptyLabel: string }> = ({ items, emptyLabel }) => {
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

function formatRiskStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Not evaluated";
  return normalized.replace(/_/g, " ");
}

function factorTone(impact?: string | null) {
  switch (impact) {
    case "positive":
      return { background: "rgba(220,252,231,0.95)", border: "rgba(34,197,94,0.28)", color: "#166534" };
    case "negative":
      return { background: "rgba(254,226,226,0.95)", border: "rgba(239,68,68,0.28)", color: "#b91c1c" };
    default:
      return { background: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.28)", color: "#475569" };
  }
}

export const ApplicationDecisionSummaryCard: React.FC<ApplicationDecisionSummaryCardProps> = ({
  summary,
  onEvaluateRisk = null,
  evaluatingRisk = false,
}) => {
  const risk = summary?.riskInsights ?? null;
  const riskSnapshot = summary?.riskSnapshot ?? null;
  const questions = summary?.referenceQuestions ?? [];
  const screeningRecommendation = summary?.screeningRecommendation ?? null;
  const screeningSummary = summary?.screeningSummary ?? null;
  const decisionSupport = summary?.decisionSupport ?? null;
  const hasContent = Boolean(riskSnapshot || risk || questions.length || screeningRecommendation || screeningSummary?.available || decisionSupport?.summaryLine || onEvaluateRisk);
  const screeningTone = priorityTone(screeningRecommendation?.priority);

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
        <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Application decision support</div>
        <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
          This summary helps organize current application signals for review. Decision support only.
        </div>
      </div>

      {!hasContent ? (
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
          Decision support will appear as application and screening data becomes available.
        </div>
      ) : (
        <div style={{ display: "grid", gap: spacing.md }}>
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
                <div style={{ color: text.primary, fontWeight: 800, fontSize: 15 }}>Risk Agent Snapshot</div>
                <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>
                  Higher score means lower risk and a stronger file. Decision support only.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {riskSnapshot ? <RiskScoreBadge grade={riskSnapshot.grade || null} score={riskSnapshot.score ?? null} /> : null}
                {onEvaluateRisk ? (
                  <button
                    type="button"
                    onClick={() => void onEvaluateRisk()}
                    disabled={evaluatingRisk}
                    style={{
                      borderRadius: radius.pill,
                      border: `1px solid ${colors.borderStrong}`,
                      background: "#fff",
                      color: text.primary,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "8px 12px",
                      cursor: evaluatingRisk ? "wait" : "pointer",
                    }}
                  >
                    {evaluatingRisk ? "Refreshing..." : riskSnapshot ? "Refresh risk" : "Evaluate risk"}
                  </button>
                ) : null}
              </div>
            </div>

            {riskSnapshot ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: text.secondary, fontSize: 12 }}>
                  <span>Status: {formatRiskStatus(riskSnapshot.status)}</span>
                  <span>{formatConfidence(riskSnapshot.confidence)}</span>
                  {formatWhen(riskSnapshot.updatedAt || riskSnapshot.createdAt) ? (
                    <span>Updated {formatWhen(riskSnapshot.updatedAt || riskSnapshot.createdAt)}</span>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Top Factors
                  </div>
                  {riskSnapshot.factors?.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {riskSnapshot.factors.slice(0, 4).map((factor) => {
                        const tone = factorTone(factor.impact);
                        return (
                          <span
                            key={`${factor.code}:${factor.weight}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 9px",
                              borderRadius: radius.pill,
                              border: `1px solid ${tone.border}`,
                              background: tone.background,
                              color: tone.color,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            <span>{factor.label}</span>
                            <span>{factor.impact === "positive" ? "+" : factor.impact === "negative" ? "-" : ""}{factor.weight}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: text.subtle, fontSize: 12 }}>No factors available yet.</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Flags
                  </div>
                  <PillList items={riskSnapshot.flags || []} emptyLabel="No risk flags right now." />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Next Review Steps
                  </div>
                  <PillList items={riskSnapshot.recommendations || []} emptyLabel="No next-step recommendations right now." />
                </div>
              </>
            ) : (
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
                Risk Agent has not evaluated this application yet. Run an evaluation to surface score, grade, factors, flags, and next review steps here.
              </div>
            )}
          </div>

          {risk ? (
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
                  <div style={{ color: text.primary, fontWeight: 800, fontSize: 15 }}>Legacy Decision Signals</div>
                  <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>
                    A compact review of current application stability and verification signals already used in this workflow.
                  </div>
                </div>
                <RiskScoreBadge grade={risk.grade || null} score={risk.score ?? null} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: text.secondary, fontSize: 12 }}>
                <span>{formatConfidence(risk.confidence)}</span>
                {summary?.status ? <span>Status: {String(summary.status).replace(/_/g, " ")}</span> : null}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Signals
                </div>
                <PillList items={risk.signals || []} emptyLabel="No notable signals yet." />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Suggested Actions
                </div>
                <PillList items={risk.recommendations || []} emptyLabel="No suggested actions right now." />
              </div>
            </div>
          ) : null}

          <div
            style={{
              borderRadius: radius.lg,
              border: `1px solid ${screeningTone.border}`,
              background: screeningTone.background,
              padding: spacing.md,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: text.primary, fontWeight: 800, fontSize: 15 }}>Screening Recommendation</div>
            <div style={{ color: screeningTone.color, fontSize: 13, fontWeight: 700 }}>
              {screeningRecommendation?.recommended ? "Recommended" : screeningSummary?.available ? "Available to review" : "Optional for now"}
            </div>
            <div style={{ color: text.secondary, fontSize: 13, lineHeight: 1.5 }}>
              {screeningRecommendation?.reason || "Screening and references can strengthen confidence before approval."}
            </div>
            {screeningSummary?.available ? (
              <div style={{ display: "grid", gap: 6, color: text.secondary, fontSize: 12 }}>
                <div>
                  Screening summary: {screeningSummary.provider || "Provider unavailable"}
                  {formatWhen(screeningSummary.completedAt) ? ` · completed ${formatWhen(screeningSummary.completedAt)}` : ""}
                </div>
                <PillList items={screeningSummary.highlights || []} emptyLabel="No screening highlights available yet." />
              </div>
            ) : null}
          </div>

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
            <div style={{ color: text.primary, fontWeight: 800, fontSize: 15 }}>Reference Questions</div>
            <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>
              Use these prompts to keep landlord reference calls focused and consistent.
            </div>
            {questions.length ? (
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, color: text.secondary, fontSize: 13, lineHeight: 1.55 }}>
                {questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            ) : (
              <div style={{ color: text.subtle, fontSize: 12 }}>Reference prompts will appear as application details become available.</div>
            )}
          </div>

          <div
            style={{
              borderRadius: radius.lg,
              border: `1px solid ${colors.border}`,
              background: "rgba(255,255,255,0.96)",
              padding: spacing.md,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ color: text.primary, fontWeight: 800, fontSize: 15 }}>Decision Support Summary</div>
            <div style={{ color: text.secondary, fontSize: 13, lineHeight: 1.6 }}>
              {decisionSupport?.summaryLine || "Review the available application signals and references before making a final decision."}
            </div>
            <div style={{ color: text.muted, fontSize: 12 }}>
              Next best action: {decisionSupport?.nextBestAction || "Review references before deciding."}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
