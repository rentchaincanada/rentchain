import React from "react";
import type { TimelineItem } from "../../api/timelineApi";

type TimelineProps = {
  items: TimelineItem[];
  emptyMessage?: string;
  storageKey?: string;
  defaultExpandedBuckets?: Partial<Record<TimelineBucketKey, boolean>>;
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

type TimelineBucketKey = "today" | "yesterday" | "earlier" | "unknown";

function bucketLabel(key: TimelineBucketKey) {
  if (key === "today") return "Today";
  if (key === "yesterday") return "Yesterday";
  if (key === "earlier") return "Earlier";
  return "Unknown day";
}

function defaultBucketState(
  overrides?: Partial<Record<TimelineBucketKey, boolean>>
): Record<TimelineBucketKey, boolean> {
  return {
    today: true,
    yesterday: true,
    earlier: false,
    unknown: true,
    ...overrides,
  };
}

function bucketForDay(dayKey: string) {
  if (dayKey === "unknown") return "unknown" as const;
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "unknown" as const;

  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const normalizedDay = new Date(year, month - 1, day);
  const diffDays = Math.round((todayLocal.getTime() - normalizedDay.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "today" as const;
  if (diffDays === 1) return "yesterday" as const;
  return "earlier" as const;
}

function groupByBucket(items: TimelineItem[]) {
  const buckets = new Map<TimelineBucketKey, Array<[string, TimelineItem[]]>>();
  for (const [dayKey, dayItems] of groupByDay(items)) {
    const bucketKey = bucketForDay(dayKey);
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey)!.push([dayKey, dayItems]);
  }

  return (["today", "yesterday", "earlier", "unknown"] as const)
    .map((key) => ({
      key,
      label: bucketLabel(key),
      groups: buckets.get(key) || [],
    }))
    .filter((bucket) => bucket.groups.length > 0);
}

function readStoredBucketState(
  storageKey?: string,
  defaultExpandedBuckets?: Partial<Record<TimelineBucketKey, boolean>>
): Record<TimelineBucketKey, boolean> {
  const defaults = defaultBucketState(defaultExpandedBuckets);
  if (!storageKey || typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<TimelineBucketKey, boolean>>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function Timeline({
  items,
  emptyMessage = "No timeline events yet.",
  storageKey,
  defaultExpandedBuckets,
}: TimelineProps) {
  const grouped = React.useMemo(() => groupByBucket(items), [items]);
  const [expandedBuckets, setExpandedBuckets] = React.useState<Record<TimelineBucketKey, boolean>>(() =>
    readStoredBucketState(storageKey, defaultExpandedBuckets)
  );

  React.useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(expandedBuckets));
    } catch {
      // Ignore local persistence failures and keep the timeline functional.
    }
  }, [expandedBuckets, storageKey]);

  if (!items.length) {
    return <div style={{ color: "#64748b" }}>{emptyMessage}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {grouped.map((bucket) => (
        <section key={bucket.key} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div
              style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              {bucket.label}
            </div>
            <button
              type="button"
              onClick={() => setExpandedBuckets((current) => ({ ...current, [bucket.key]: !current[bucket.key] }))}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                background: "#fff",
                color: "#334155",
                fontWeight: 700,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              {expandedBuckets[bucket.key] ? "Hide" : "Show"}
            </button>
          </div>
          {expandedBuckets[bucket.key] ? (
            <div style={{ display: "grid", gap: 16 }}>
              {bucket.groups.map(([day, dayItems]) => (
                <section key={day} style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {day === "unknown" ? "Unknown day" : formatDayHeading(day)}
                  </div>
                  <div className="timeline">
                    {dayItems.map((item) => (
                      <article
                        key={item.id}
                        className="timelineRow"
                        style={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: 12 }}
                      >
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
          ) : (
            <div style={{ color: "#64748b", fontSize: "0.92rem" }}>
              {bucket.groups.reduce((count, [, dayItems]) => count + dayItems.length, 0)} events hidden in this section.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export default Timeline;
