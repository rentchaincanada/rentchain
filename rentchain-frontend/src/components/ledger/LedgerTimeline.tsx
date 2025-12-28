import React from "react";
import { LedgerEventTypeBadge } from "./LedgerEventTypeBadge";
import type { LedgerEventV2 } from "../../api/ledgerV2";

interface Props {
  items: LedgerEventV2[];
  onSelect?: (id: string) => void;
  emptyText?: string;
}

export const LedgerTimeline: React.FC<Props> = ({ items, onSelect, emptyText }) => {
  if (!items.length) {
    return <div style={{ padding: 8, color: "#6b7280" }}>{emptyText || "No activity yet."}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it) => (
        <div
          key={it.id}
          onClick={() => onSelect?.(it.id)}
          style={{
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 8,
            cursor: onSelect ? "pointer" : "default",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{it.title}</div>
            <LedgerEventTypeBadge type={it.eventType} />
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            {new Date(it.occurredAt).toLocaleString()}
          </div>
          {it.summary ? (
            <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>{it.summary}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
