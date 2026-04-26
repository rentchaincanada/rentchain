import React from "react";
import type { ResolutionRecordV1 } from "../../api/supportConsoleApi";

function formatTimestamp(value?: string | null) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return value || "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

export default function ResolutionHistoryList({ history }: { history: ResolutionRecordV1["history"] }) {
  if (!history?.length) return <div style={{ color: "#64748b" }}>No resolution history yet.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {history.map((entry) => (
        <div key={entry.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 600 }}>{entry.fromStatus ? `${entry.fromStatus} -> ${entry.toStatus}` : entry.toStatus}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{formatTimestamp(entry.timestamp)}</div>
          {entry.reason ? <div style={{ marginTop: 4 }}>{entry.reason}</div> : null}
        </div>
      ))}
    </div>
  );
}
