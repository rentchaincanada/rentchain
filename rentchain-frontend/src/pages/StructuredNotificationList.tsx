import React from "react";
import { Link } from "react-router-dom";
import { text } from "../styles/tokens";
import type { StructuredNotificationItem } from "./structuredNotificationTriggers";

export default function StructuredNotificationList(props: {
  heading: string;
  emptyLabel: string;
  items: StructuredNotificationItem[];
  linkLabel?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700, color: text.main }}>{props.heading}</div>
      {props.items.length ? (
        props.items.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, color: text.main }}>{item.title}</div>
              <div
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  color: item.actionRequired ? "#9a3412" : "#1d4ed8",
                  background: item.actionRequired ? "#ffedd5" : "#dbeafe",
                }}
              >
                {item.actionRequired ? "Action required" : "Updated"}
              </div>
            </div>
            <div style={{ color: text.subtle }}>{item.description}</div>
            {item.targetLink ? (
              <div>
                <Link to={item.targetLink} style={{ fontWeight: 700 }}>
                  {props.linkLabel || (item.actionRequired ? "Review update" : "Open")}
                </Link>
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div style={{ color: text.subtle }}>{props.emptyLabel}</div>
      )}
    </div>
  );
}
