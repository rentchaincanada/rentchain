import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Ui";
import type { LandlordAgentDecision } from "@/api/landlordAnalyticsApi";

const priorityTone: Record<"low" | "medium" | "high", { bg: string; text: string }> = {
  low: { bg: "rgba(14, 165, 233, 0.12)", text: "#075985" },
  medium: { bg: "rgba(245, 158, 11, 0.14)", text: "#92400e" },
  high: { bg: "rgba(239, 68, 68, 0.12)", text: "#991b1b" },
};

type Props = {
  decisions: LandlordAgentDecision[];
  title?: string;
  description?: string;
  emptyMessage?: string;
};

function supportingLine(decision: LandlordAgentDecision) {
  const parts = decision.supportingSignals
    .slice(0, 3)
    .map((signal) => signal.label)
    .filter(Boolean);

  return parts.length ? parts.join(" • ") : null;
}

export function AgentDecisionPanel({
  decisions,
  title = "Recommended next actions",
  description = "Deterministic recommendations built from current analytics, alerts, benchmarking, deltas, and predictive signals.",
  emptyMessage = "No attention-worthy actions are surfaced for this view right now.",
}: Props) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          <div style={{ color: "#475569" }}>{description}</div>
        </div>

        {!decisions.length ? (
          <div style={{ color: "#64748b" }}>{emptyMessage}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {decisions.map((decision) => {
              const support = supportingLine(decision);
              return (
                <div
                  key={decision.decisionType}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{decision.recommendedAction}</div>
                    <div
                      style={{
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: priorityTone[decision.priority].bg,
                        color: priorityTone[decision.priority].text,
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                      }}
                    >
                      {decision.priority} priority
                    </div>
                  </div>
                  <div style={{ color: "#334155" }}>{decision.explanation}</div>
                  {support ? <div style={{ color: "#64748b", fontSize: "0.88rem" }}>{support}</div> : null}
                  {decision.href ? (
                    <div>
                      <Link to={decision.href} style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}>
                        {decision.recommendedAction}
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

export default AgentDecisionPanel;
