import React from "react";
import type { WatchlistEntryV1 } from "../../api/adminWatchlistApi";

export default function WatchlistTable(props: {
  watchlist: WatchlistEntryV1[];
  onToggle: (entry: WatchlistEntryV1) => void;
}) {
  if (!props.watchlist.length) return <div style={{ color: "#64748b" }}>No watchlist entries yet.</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {props.watchlist.map((entry) => (
        <article key={entry.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <strong>{entry.target.type} {entry.target.id}</strong>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                {entry.target.portfolioId ? `Portfolio ${entry.target.portfolioId}` : "No portfolio scope"}
              </div>
              {entry.notes ? <div>{entry.notes}</div> : null}
            </div>
            <button type="button" onClick={() => props.onToggle(entry)}>
              {entry.isActive ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
