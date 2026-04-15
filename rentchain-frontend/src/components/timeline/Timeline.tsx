import React from "react";
import type { TimelineItem } from "../../api/timelineApi";

type TimelineProps = {
  items: TimelineItem[];
  emptyMessage?: string;
};

function formatDayHeading(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unknown day";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value || "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function groupByDay(items: TimelineItem[]) {
  const groups = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const parsed = Date.parse(item.timestamp);
    const dayKey = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "unknown";
    if (!groups.has(dayKey)) groups.set(dayKey, []);
    groups.get(dayKey)!.push(item);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function Timeline({ items, emptyMessage = "No timeline events yet." }: TimelineProps) {
  if (!items.length) {
    return <div style={{ color: "#64748b" }}>{emptyMessage}</div>;
  }

  const grouped = groupByDay(items);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {grouped.map(([day, dayItems]) => (
        <section key={day} style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {day === "unknown" ? "Unknown day" : formatDayHeading(day)}
          </div>
          <div className="timeline">
            {dayItems.map((item) => (
              <article key={item.id} className="timelineRow" style={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: 12 }}>
                <div className="timelineDot" aria-hidden="true" />
                <div style={{ display: "grid", gap: 6, width: "100%" }}>
                  <div className="timelineTop">
                    <div className="timelineTitle">{item.title}</div>
                    <div className="timelineDate">{formatTimestamp(item.timestamp)}</div>
                  </div>
                  <div className="timelineDesc">{item.description}</div>
                  <div className="timelineMeta">
                    <span>{item.domain}</span>
                    {item.status ? <span>• {item.status}</span> : null}
                    {item.actor ? <span>• {item.actor}</span> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default Timeline;
