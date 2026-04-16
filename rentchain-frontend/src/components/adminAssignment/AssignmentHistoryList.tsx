import React from "react";
import type { AssignmentRecordV1 } from "../../api/supportConsoleApi";

type AssignmentHistory = AssignmentRecordV1["history"];

export default function AssignmentHistoryList(props: { history: AssignmentHistory }) {
  if (!props.history.length) {
    return <div style={{ color: "#64748b" }}>No assignment history yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {props.history.map((entry) => (
        <article
          key={entry.id}
          style={{
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 10,
            padding: 10,
            background: "rgba(248,250,252,0.8)",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ textTransform: "capitalize" }}>{entry.action}</strong>
            <div style={{ color: "#475569", fontSize: 13 }}>
              {entry.fromOwnerLabel || entry.fromOwnerId || "Unassigned"} {"->"}{" "}
              {entry.toOwnerLabel || entry.toOwnerId || "Unassigned"}
            </div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              {new Date(entry.timestamp).toLocaleString()}
            </div>
            {entry.note ? <div style={{ color: "#334155", fontSize: 13 }}>{entry.note}</div> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
