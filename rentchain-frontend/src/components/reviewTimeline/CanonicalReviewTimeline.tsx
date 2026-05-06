import React from "react";
import { Link } from "react-router-dom";
import type { CanonicalReviewTimeline as Timeline } from "@/api/reviewTimelineApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value || "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "review_required") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "completed") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (status === "redacted") return { color: "#1d4ed8", background: "#dbeafe", border: "#bfdbfe" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  const style = tone(status);
  return (
    <span
      style={{
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        background: style.background,
        color: style.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function CanonicalReviewTimeline({ timeline }: { timeline: Timeline }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Section>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Canonical review timeline</h2>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                {label(timeline.scope)} · {timeline.scopeId}
              </div>
            </div>
            <Badge status="info">{timeline.entries.length} Entries</Badge>
          </div>
          <div style={{ color: "#475569", lineHeight: 1.55 }}>
            Read-only operational review timeline. Timeline entries are audit oriented and manually reviewable. No
            automated approval or certification occurs.
          </div>
          <div style={{ color: "#475569", fontSize: 13 }}>
            Manual review required: {timeline.manualReviewRequired ? "Yes" : "No"}. External sharing enabled:{" "}
            {timeline.externalSharingEnabled ? "Yes" : "No"}. Certification issued:{" "}
            {timeline.certificationIssued ? "Yes" : "No"}.
          </div>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 }}>
          {[
            ["Total", timeline.summary.total],
            ["Review required", timeline.summary.reviewRequired],
            ["Blocked", timeline.summary.blocked],
            ["Completed", timeline.summary.completed],
            ["Redacted", timeline.summary.redacted],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Timeline entries</div>
        {timeline.entries.length ? (
          timeline.entries.map((entry) => (
            <Card key={entry.timelineEntryId} style={{ borderRadius: 8, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>{entry.label}</strong>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{formatDate(entry.timestamp)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge status="info">{label(entry.entryType)}</Badge>
                  <Badge status={entry.status}>{label(entry.status)}</Badge>
                </div>
              </div>
              <div style={{ color: "#475569", fontSize: 13 }}>{entry.description}</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Source: {label(entry.source)} · Actor: {label(entry.actor.type)}
                {entry.actor.id ? ` ${entry.actor.id}` : ""}
              </div>
              {entry.redactionReason ? <div style={{ color: "#1d4ed8", fontSize: 12 }}>{entry.redactionReason}</div> : null}
              {entry.blockedReason ? <div style={{ color: "#991b1b", fontSize: 12 }}>{entry.blockedReason}</div> : null}
              {entry.destination ? (
                <Link to={entry.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>
                  View context
                </Link>
              ) : null}
            </Card>
          ))
        ) : (
          <Card style={{ color: "#64748b" }}>No review timeline entries are available for the current filters.</Card>
        )}
      </Section>
    </div>
  );
}
