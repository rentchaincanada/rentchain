import React from "react";

type AutomationItem = {
  id: string;
  timestamp: string;
  action?: string | null;
  executed: boolean;
  skipped: boolean;
  reason?: string | null;
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

export function AutomationHistoryList({ items }: { items: AutomationItem[] }) {
  if (!items.length) {
    return <div style={{ color: "#64748b" }}>No automation history recorded for this resource.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <article key={item.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>{item.action || "Automation action"}</strong>
            <span style={{ color: "#64748b" }}>{formatTimestamp(item.timestamp)}</span>
          </div>
          <div style={{ color: "#334155", marginTop: 6 }}>{item.summary || "Automation activity recorded."}</div>
          <div style={{ color: "#475569", marginTop: 6 }}>
            {item.executed ? "Executed" : "Skipped"}
            {item.reason ? ` • ${item.reason}` : ""}
          </div>
        </article>
      ))}
    </div>
  );
}

export default AutomationHistoryList;

