import React from "react";

type PolicyDecision = {
  id: string;
  timestamp: string;
  action?: string | null;
  outcome?: string | null;
  reasonCodes?: string[];
  summary?: string | null;
};

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value || "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

export function PolicyDecisionList({ items }: { items: PolicyDecision[] }) {
  if (!items.length) {
    return <div style={{ color: "#64748b" }}>No policy decisions recorded for this resource.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <article key={item.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>{item.action || "Policy action"}</strong>
            <span style={{ color: "#64748b" }}>{formatTimestamp(item.timestamp)}</span>
          </div>
          <div style={{ color: "#334155", marginTop: 6 }}>{item.summary || "Policy evaluation recorded."}</div>
          <div style={{ color: "#475569", marginTop: 6 }}>
            Outcome: {item.outcome || "unknown"}
            {item.reasonCodes?.length ? ` • Reasons: ${item.reasonCodes.join(", ")}` : ""}
          </div>
        </article>
      ))}
    </div>
  );
}

export default PolicyDecisionList;

