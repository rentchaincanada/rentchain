import React from "react";
import type { ApplicationDecisionSummary } from "@/types/applicationDecisionSummary";
import type { LandlordDecisionAction } from "@/types/applicationDecisionSummary";
import { RiskScoreBadge } from "@/components/leases/RiskScoreBadge";
import { LandlordDecisionPanel } from "@/components/applications/LandlordDecisionPanel";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

interface ApplicationDecisionSummaryCardProps {
  summary?: ApplicationDecisionSummary | null;
  onEvaluateRisk?: (() => void | Promise<void>) | null;
  evaluatingRisk?: boolean;
  onDecision?: ((decision: LandlordDecisionAction, notes: string) => void | Promise<void>) | null;
  submittingDecision?: boolean;
  requestInfoDrawer?: React.ReactNode;
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
      return { background: colors.pineSoft, border: "rgba(30,95,78,0.22)", color: colors.pine };
  }
}

function providerDisplayLabel(provider?: string | null, providerLabel?: string | null) {
  if (providerLabel) return providerLabel;
  const raw = String(provider || "").trim();
  if (!raw) return "Provider unavailable";
  if (["stub", "stubbed_screening", "mock", "test"].includes(raw.toLowerCase())) return "Provider unavailable";
  return raw;
}

function finalDecisionStateForStatus(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (["APPROVED", "APPROVE", "ACCEPTED", "CONVERTED"].includes(normalized)) {
    return {
      title: "Application approved",
      description: "This application has already been approved. Pre-decision controls are no longer shown from this review panel.",
      nextAction: "Continue lease follow-through from the lease workspace when a safe lease route is available.",
    };
  }
  if (["REJECTED", "DECLINED", "DENIED"].includes(normalized)) {
    return {
      title: "Application declined",
      description: "This decision has already been recorded. Pre-decision controls are no longer shown from this review panel.",
      nextAction: "Keep the application summary available for review history and audit context.",
    };
  }
  return null;
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

export const ApplicationDecisionSummaryCard: React.FC<ApplicationDecisionSummaryCardProps> = ({
  summary,
  onEvaluateRisk = null,
  evaluatingRisk = false,
  onDecision = null,
  submittingDecision = false,
  requestInfoDrawer = null,
}) => {
  const risk = summary?.riskInsights ?? null;
  const riskSnapshot = summary?.riskSnapshot ?? null;
  const questions = summary?.referenceQuestions ?? [];
  const screeningRecommendation = summary?.screeningRecommendation ?? null;
  const screeningSummary = summary?.screeningSummary ?? null;
  const decisionSupport = summary?.decisionSupport ?? null;
  const hasContent = Boolean(riskSnapshot || risk || questions.length || screeningRecommendation || screeningSummary?.available || decisionSupport?.summaryLine || onEvaluateRisk);
  const screeningTone = priorityTone(screeningRecommendation?.priority);
  const finalDecisionState = finalDecisionStateForStatus(summary?.status);

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
          <LandlordDecisionPanel
            riskSnapshot={riskSnapshot}
            onEvaluateRisk={onEvaluateRisk}
            evaluatingRisk={evaluatingRisk}
            onDecision={onDecision}
            submittingDecision={submittingDecision}
            finalDecisionState={finalDecisionState}
          />
          {requestInfoDrawer}

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
                  Screening summary: {providerDisplayLabel(screeningSummary.provider, screeningSummary.providerLabel)}
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
