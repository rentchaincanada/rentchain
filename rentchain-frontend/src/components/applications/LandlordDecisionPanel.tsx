import React, { useMemo, useState } from "react";
import type {
  LandlordDecisionAction,
  RiskAgentReviewFactor,
  RiskAgentReviewSnapshot,
} from "@/types/applicationDecisionSummary";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";
import "./LandlordDecisionPanel.css";

type LandlordDecisionPanelProps = {
  riskSnapshot?: RiskAgentReviewSnapshot;
  onEvaluateRisk?: (() => void | Promise<void>) | null;
  evaluatingRisk?: boolean;
  onDecision?: ((decision: LandlordDecisionAction, notes: string) => void | Promise<void>) | null;
  submittingDecision?: boolean;
  finalDecisionState?: {
    title: string;
    description: string;
    nextAction?: string | null;
  } | null;
};

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

function formatStatus(value?: string | null) {
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

function riskDirectionLabel(score?: number | null) {
  if (typeof score !== "number" || Number.isNaN(score)) return "Risk pending";
  if (score >= 70) return "Lower risk";
  if (score >= 55) return "Moderate risk";
  return "Higher risk";
}

const FactorGroup: React.FC<{ title: string; factors: RiskAgentReviewFactor[]; emptyLabel: string }> = ({
  title,
  factors,
  emptyLabel,
}) => (
  <div style={{ display: "grid", gap: 6 }}>
    <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {title}
    </div>
    {factors.length ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {factors.map((factor) => {
          const tone = factorTone(factor.impact);
          return (
            <span
              key={`${factor.code}:${factor.weight}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: radius.pill,
                border: `1px solid ${tone.border}`,
                background: tone.background,
                color: tone.color,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span>{factor.label}</span>
              <span>
                {factor.impact === "positive" ? "+" : factor.impact === "negative" ? "-" : ""}
                {factor.weight}
              </span>
            </span>
          );
        })}
      </div>
    ) : (
      <div style={{ color: text.subtle, fontSize: 12 }}>{emptyLabel}</div>
    )}
  </div>
);

const ItemList: React.FC<{ title: string; items: string[]; emptyLabel: string; tone?: "warning" | "neutral" }> = ({
  title,
  items,
  emptyLabel,
  tone = "neutral",
}) => (
  <div style={{ display: "grid", gap: 6 }}>
    <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {title}
    </div>
    {items.length ? (
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div
            key={item}
            style={{
              borderRadius: radius.lg,
              border: `1px solid ${tone === "warning" ? "rgba(239,68,68,0.2)" : colors.border}`,
              background: tone === "warning" ? "rgba(254,242,242,0.92)" : "rgba(248,250,252,0.94)",
              color: tone === "warning" ? "#991b1b" : text.secondary,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    ) : (
      <div style={{ color: text.subtle, fontSize: 12 }}>{emptyLabel}</div>
    )}
  </div>
);

const FinalDecisionNotice: React.FC<{
  finalDecisionState: NonNullable<LandlordDecisionPanelProps["finalDecisionState"]>;
}> = ({ finalDecisionState }) => (
  <div style={{ display: "grid", gap: 8 }}>
    <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      Recorded Decision
    </div>
    <div
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        background: "rgba(248,250,252,0.94)",
        padding: spacing.md,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ color: text.primary, fontWeight: 800 }}>{finalDecisionState.title}</div>
      <div style={{ color: text.secondary, fontSize: 13, lineHeight: 1.6 }}>
        {finalDecisionState.description}
      </div>
      {finalDecisionState.nextAction ? (
        <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.55 }}>
          Next step: {finalDecisionState.nextAction}
        </div>
      ) : null}
    </div>
  </div>
);

export const LandlordDecisionPanel: React.FC<LandlordDecisionPanelProps> = ({
  riskSnapshot = null,
  onEvaluateRisk = null,
  evaluatingRisk = false,
  onDecision = null,
  submittingDecision = false,
  finalDecisionState = null,
}) => {
  const [notes, setNotes] = useState("");

  const topFactors = useMemo(() => (riskSnapshot?.factors || []).slice(0, 5), [riskSnapshot]);
  const positiveFactors = topFactors.filter((factor) => factor.impact === "positive");
  const negativeFactors = topFactors.filter((factor) => factor.impact === "negative");
  const neutralFactors = topFactors.filter((factor) => factor.impact !== "positive" && factor.impact !== "negative");

  const handleDecision = async (decision: LandlordDecisionAction) => {
    if (!onDecision || !riskSnapshot) return;
    await onDecision(decision, notes.trim());
    setNotes("");
  };

  return (
    <div
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        background: "rgba(255,255,255,0.97)",
        boxShadow: shadows.soft,
        padding: spacing.md,
        display: "grid",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ color: text.primary, fontWeight: 800, fontSize: 16 }}>Landlord Decision Panel</div>
        <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.55 }}>
          {finalDecisionState
            ? "This application already has a recorded decision. Review the context below without changing the application status from this panel."
            : "Use the latest Risk Agent snapshot to decide whether to approve, reject, or request more information. These actions stay landlord-triggered and only update the application after you confirm them."}
        </div>
      </div>

      {!riskSnapshot && finalDecisionState ? (
        <FinalDecisionNotice finalDecisionState={finalDecisionState} />
      ) : !riskSnapshot ? (
        <div
          style={{
            borderRadius: radius.lg,
            border: `1px dashed ${colors.borderStrong}`,
            background: "rgba(248,250,252,0.92)",
            padding: spacing.md,
            color: text.muted,
            fontSize: 13,
            lineHeight: 1.6,
            display: "grid",
            gap: 10,
          }}
        >
          <div>No risk snapshot is available yet. Evaluate risk first to unlock the decision panel.</div>
          {onEvaluateRisk ? (
            <button
              type="button"
              onClick={() => void onEvaluateRisk()}
              disabled={evaluatingRisk}
              style={{
                justifySelf: "start",
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
              {evaluatingRisk ? "Refreshing..." : "Evaluate risk"}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Risk Summary
            </div>
            <div className="rc-landlord-decision-panel__risk-summary-grid">
              <div
                style={{
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.borderStrong}`,
                  background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))",
                  color: "#fff",
                  padding: spacing.md,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.78, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Risk Score
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>
                    {typeof riskSnapshot.score === "number" ? riskSnapshot.score : "--"}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>Grade {riskSnapshot.grade || "Pending"}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>{riskDirectionLabel(riskSnapshot.score)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, opacity: 0.86 }}>
                  <span>Status: {formatStatus(riskSnapshot.status)}</span>
                  <span>{formatConfidence(riskSnapshot.confidence)}</span>
                  {formatWhen(riskSnapshot.updatedAt || riskSnapshot.createdAt) ? (
                    <span>Updated {formatWhen(riskSnapshot.updatedAt || riskSnapshot.createdAt)}</span>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.border}`,
                  background: "rgba(248,250,252,0.94)",
                  padding: spacing.md,
                  display: "grid",
                  gap: 8,
                  alignContent: "start",
                }}
              >
                <div style={{ color: text.primary, fontWeight: 800 }}>Decision Guidance</div>
                <div style={{ color: text.secondary, fontSize: 13, lineHeight: 1.6 }}>
                  Higher score means lower risk and a stronger file. Use the factor mix, flags, and next steps below before you choose a manual decision.
                </div>
                <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.55 }}>
                  Suggested approach: approve when positives are strong and flags are minimal, reject when high-risk negatives dominate, or request more info when confidence is low or required documents are still missing.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <FactorGroup title="Positive Factors" factors={positiveFactors} emptyLabel="No positive factors highlighted yet." />
            <FactorGroup title="Negative Factors" factors={negativeFactors} emptyLabel="No negative factors highlighted yet." />
          </div>

          {neutralFactors.length ? (
            <FactorGroup title="Neutral Factors" factors={neutralFactors} emptyLabel="No neutral factors highlighted." />
          ) : null}

          <ItemList title="Flags" items={riskSnapshot.flags || []} emptyLabel="No flagged warnings right now." tone="warning" />
          <ItemList title="Next Step Guidance" items={riskSnapshot.recommendations || []} emptyLabel="No next-step guidance right now." />

          {finalDecisionState ? (
            <FinalDecisionNotice finalDecisionState={finalDecisionState} />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Decision Actions
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional decision notes for your team audit trail"
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.border}`,
                  padding: "10px 12px",
                  font: "inherit",
                  color: text.primary,
                  background: "#fff",
                }}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void handleDecision("approve")}
                  disabled={!onDecision || submittingDecision}
                  style={{
                    borderRadius: radius.pill,
                    border: "1px solid rgba(34,197,94,0.28)",
                    background: "rgba(220,252,231,0.96)",
                    color: "#166534",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: "9px 14px",
                    cursor: !onDecision || submittingDecision ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingDecision ? "Saving..." : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDecision("reject")}
                  disabled={!onDecision || submittingDecision}
                  style={{
                    borderRadius: radius.pill,
                    border: "1px solid rgba(239,68,68,0.28)",
                    background: "rgba(254,226,226,0.96)",
                    color: "#b91c1c",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: "9px 14px",
                    cursor: !onDecision || submittingDecision ? "not-allowed" : "pointer",
                  }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => void handleDecision("request_info")}
                  disabled={!onDecision || submittingDecision}
                  style={{
                    borderRadius: radius.pill,
                    border: "1px solid rgba(59,130,246,0.24)",
                    background: "rgba(239,246,255,0.96)",
                    color: "#1d4ed8",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: "9px 14px",
                    cursor: !onDecision || submittingDecision ? "not-allowed" : "pointer",
                  }}
                >
                  Request More Info
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
