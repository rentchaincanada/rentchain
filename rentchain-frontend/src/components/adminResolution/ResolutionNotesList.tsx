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

export default function ResolutionNotesList({ notes }: { notes: ResolutionRecordV1["notes"] }) {
  if (!notes?.length) return <div style={{ color: "#64748b" }}>No resolution notes yet.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {notes.map((note) => (
        <div key={note.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 10, padding: 10 }}>
          <div>{note.message}</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{formatTimestamp(note.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
