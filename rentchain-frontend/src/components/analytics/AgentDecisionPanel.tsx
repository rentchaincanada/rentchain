import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Ui";
import { markLandlordDecisionReviewed, type AnalyticsPeriod, type LandlordAgentDecision } from "@/api/landlordAnalyticsApi";

const priorityTone: Record<"low" | "medium" | "high", { bg: string; text: string }> = {
  low: { bg: "rgba(14, 165, 233, 0.12)", text: "#075985" },
  medium: { bg: "rgba(245, 158, 11, 0.14)", text: "#92400e" },
  high: { bg: "rgba(239, 68, 68, 0.12)", text: "#991b1b" },
};

const workflowCategoryLabel: Record<NonNullable<LandlordAgentDecision["workflowCategory"]>, string> = {
  lease_renewals: "Lease renewals",
  vacancy_readiness: "Vacancy readiness",
  application_funnel: "Application funnel",
  maintenance_backlog: "Maintenance backlog",
  revenue_follow_up: "Revenue follow-up",
  property_focus: "Property focus",
};

type Props = {
  decisions: LandlordAgentDecision[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  period?: AnalyticsPeriod;
  propertyId?: string | null;
};

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to mark this decision as reviewed.";
}

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
  period,
  propertyId = null,
}: Props) {
  const [items, setItems] = React.useState(decisions);
  const [reviewingDecisionId, setReviewingDecisionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setItems(decisions);
  }, [decisions]);

  const handleReview = async (decisionId: string) => {
    try {
      setReviewingDecisionId(decisionId);
      setError(null);
      const response = await markLandlordDecisionReviewed({
        decisionId,
        period,
        propertyId,
      });
      setItems((current) =>
        current.map((decision) =>
          decision.id === decisionId
            ? {
                ...decision,
                state: response.state.state,
                reviewedAt: response.state.reviewedAt,
              }
            : decision
        )
      );
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setReviewingDecisionId(null);
    }
  };

  return (
    <Card>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          <div style={{ color: "#475569" }}>{description}</div>
        </div>

        {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

        {!items.length ? (
          <div style={{ color: "#64748b" }}>{emptyMessage}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((decision) => {
              const support = supportingLine(decision);
              const categoryLabel = decision.workflowCategory ? workflowCategoryLabel[decision.workflowCategory] : null;
              const ctaDestination = decision.destination || decision.href;
              const ctaLabel = decision.destination
                ? decision.actionLabel || decision.recommendedAction
                : decision.href
                  ? decision.recommendedAction
                  : null;
              return (
                <div
                  key={decision.id}
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
                  {categoryLabel ? (
                    <div style={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
                      Workflow: {categoryLabel}
                    </div>
                  ) : null}
                  {support ? <div style={{ color: "#64748b", fontSize: "0.88rem" }}>{support}</div> : null}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {ctaDestination && ctaLabel ? (
                      <Link to={ctaDestination} style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}>
                        {ctaLabel}
                      </Link>
                    ) : null}
                    {decision.state === "reviewed" ? (
                      <div
                        style={{
                          padding: "4px 9px",
                          borderRadius: 999,
                          background: "rgba(15, 118, 110, 0.1)",
                          color: "#0f766e",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                        }}
                      >
                        Reviewed
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleReview(decision.id)}
                        disabled={reviewingDecisionId === decision.id}
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          background: "#f8fafc",
                          color: "#0f172a",
                          fontWeight: 700,
                          padding: "6px 12px",
                          cursor: reviewingDecisionId === decision.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {reviewingDecisionId === decision.id ? "Saving..." : "Mark Reviewed"}
                      </button>
                    )}
                  </div>
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
