import React from "react";
import { Link } from "react-router-dom";
import { text } from "../styles/tokens";
import type { StructuredNotificationItem } from "./structuredNotificationTriggers";

function timingTone(timing: StructuredNotificationItem["reminderTiming"]) {
  switch (timing) {
    case "due_now":
      return { color: "#9a3412", background: "#ffedd5" };
    case "due_soon":
      return { color: "#1d4ed8", background: "#dbeafe" };
    case "scheduled_later":
      return { color: "#475569", background: "#e2e8f0" };
    case "overdue":
      return { color: "#991b1b", background: "#fee2e2" };
    case "blocked":
      return { color: "#92400e", background: "#fef3c7" };
    default:
      return { color: "#475569", background: "#f1f5f9" };
  }
}

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
          (() => {
            const resolvedTiming = item.reminderTiming || (item.actionRequired ? "due_now" : "not_applicable");
            const resolvedLabel = item.reminderTimingLabel || (item.actionRequired ? "Due now" : "No action needed");
            const resolvedDescription =
              item.reminderTimingDescription ||
              (item.actionRequired
                ? "This update is ready for your attention now."
                : "This update is informational and does not need any action right now.");
            return (
          <div
            key={item.id}
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
              opacity: resolvedTiming === "not_applicable" ? 0.82 : 1,
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
                  ...timingTone(resolvedTiming),
                }}
              >
                {resolvedLabel}
              </div>
            </div>
            <div style={{ color: text.subtle }}>{item.description}</div>
            <div style={{ color: text.subtle, fontSize: 13 }}>{resolvedDescription}</div>
            {item.targetLink ? (
              <div>
                <Link to={item.targetLink} style={{ fontWeight: 700 }}>
                  {props.linkLabel || (item.actionRequired ? "Review update" : "Open")}
                </Link>
              </div>
            ) : null}
          </div>
            );
          })()
        ))
      ) : (
        <div style={{ color: text.subtle }}>{props.emptyLabel}</div>
      )}
    </div>
  );
}
