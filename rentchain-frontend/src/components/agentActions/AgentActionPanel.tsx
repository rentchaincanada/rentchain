import React from "react";
import type { AgentActionStatus, PolicyGatedAgentAction } from "@/api/decisionInboxApi";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function workflowQueueLabel(queue: string) {
  if (queue === "delinquency_review") return "delinquency review";
  if (queue === "lease_review") return "lease readiness review";
  if (queue === "screening_review") return "screening workflow review";
  if (queue === "maintenance_review") return "maintenance review";
  if (queue === "compliance_review") return "compliance review";
  if (queue === "admin_review") return "admin review";
  return label(queue).toLowerCase();
}

function operationalReviewLabel(value: string, queue?: string) {
  const raw = value.toLowerCase();
  if (raw.includes("review_overdue_rent") || raw.includes("overdue_rent") || raw.includes("overdue")) {
    return "Overdue rent review";
  }
  if (raw.includes("review_missing_payment") || raw.includes("missing_payment")) return "Missing payment review";
  if (raw.includes("reduce_vacancy_risk") || raw.includes("vacancy")) return "Vacancy pressure review";
  if (raw.includes("revenue")) return "Revenue pressure review";
  if (raw.includes("delinquency") || queue === "delinquency_review") return "Delinquency review";
  if (raw.includes("screening") || queue === "screening_review") return "Screening workflow review";
  if (raw.includes("lease") || queue === "lease_review") return "Lease readiness review";
  return "Operational review";
}

function safeExplanationReason(reason: string, action: PolicyGatedAgentAction) {
  const routedMatch = reason.match(/^Decision\s+(.+?)\s+is routed to\s+([a-z_]+)\.?$/i);
  if (routedMatch) {
    return `${operationalReviewLabel(routedMatch[1], action.queue)} is routed to ${workflowQueueLabel(routedMatch[2])}.`;
  }
  return reason.replace(/\b(lease_lifecycle|decision|property|lease):[A-Za-z0-9:_-]+\b/gi, (match) =>
    operationalReviewLabel(match, action.queue)
  );
}

function statusTone(status: AgentActionStatus) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "suggested") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "acknowledged") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ status }: { status: AgentActionStatus }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        background: tone.background,
        color: tone.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label(status)}
    </span>
  );
}

export function AgentActionPanel({ actions }: { actions?: PolicyGatedAgentAction[] | null }) {
  const rows = actions || [];
  if (!rows.length) return null;

  return (
    <div
      style={{
        border: "1px solid #c7d2fe",
        background: "#eef2ff",
        borderRadius: 8,
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "#312e81" }}>Suggested actions only.</strong>
        <span style={{ color: "#3730a3", fontSize: 13 }}>
          Manual approval is required. No tenant communication, payment action, legal enforcement, or external submission is automated.
        </span>
      </div>
      {rows.map((action) => (
        <div
          key={action.agentActionId}
          style={{
            display: "grid",
            gap: 8,
            border: "1px solid #c7d2fe",
            background: "#fff",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ color: "#0f172a" }}>{label(action.actionType)}</strong>
            <Badge status={action.status} />
          </div>
          <div style={{ color: "#334155", fontSize: 13 }}>{action.explanation.summary}</div>
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ color: "#312e81", fontSize: 13 }}>Review explanation</strong>
            {action.explanation.reasons.slice(0, 4).map((reason) => (
              <span key={reason} style={{ color: "#475569", fontSize: 13 }}>
                {safeExplanationReason(reason, action)}
              </span>
            ))}
            {action.explanation.blockedReasons.map((reason) => (
              <span key={reason} style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
                {reason}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#475569", fontSize: 12, fontWeight: 800 }}>
            <span>Manual review required</span>
            <span>Policy guarded</span>
            <span>Human approval required</span>
            <span>External execution disabled</span>
          </div>
        </div>
      ))}
    </div>
  );
}
