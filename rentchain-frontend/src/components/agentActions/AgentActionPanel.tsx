import React from "react";
import type { AgentActionStatus, PolicyGatedAgentAction } from "@/api/decisionInboxApi";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
                {reason}
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
