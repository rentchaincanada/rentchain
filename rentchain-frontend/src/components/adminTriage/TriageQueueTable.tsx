import React from "react";
import { Link } from "react-router-dom";
import type { AdminTriageItemV1 } from "../../api/adminTriageApi";
import ResolutionStatusBadge from "../adminResolution/ResolutionStatusBadge";
import AssignmentBadge from "../adminAssignment/AssignmentBadge";
import TriageSeverityBadge from "./TriageSeverityBadge";

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value || "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function signalLine(item: AdminTriageItemV1) {
  const parts = [
    item.signals.reconciliationStatus ? `Reconciliation: ${item.signals.reconciliationStatus}` : null,
    item.signals.lifecycleState ? `Lifecycle: ${item.signals.lifecycleState}` : null,
    item.signals.policyOutcome ? `Policy: ${item.signals.policyOutcome}` : null,
    item.signals.automationAction ? `Automation: ${item.signals.automationAction}` : null,
    item.signals.reopenCount ? `Reopens: ${item.signals.reopenCount}` : null,
    item.signals.blockedCount ? `Blocked: ${item.signals.blockedCount}` : null,
  ].filter(Boolean);
  return parts.join(" • ");
}

export function TriageQueueTable({ items }: { items: AdminTriageItemV1[] }) {
  if (!items.length) {
    return <div style={{ color: "#64748b" }}>No triage items need attention right now.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <article key={item.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.92)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <TriageSeverityBadge severity={item.severity} />
                <span style={{ color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {item.category.replace(/_/g, " ")}
                </span>
              </div>
              <strong>{item.resource.title || `${item.resource.type} ${item.resource.id}`}</strong>
              <div style={{ color: "#475569" }}>
                {item.reason.summary}
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                {item.resource.type} • {item.resource.id}
                {item.resource.status ? ` • ${item.resource.status}` : ""}
                {item.resource.subtitle ? ` • ${item.resource.subtitle}` : ""}
              </div>
              {signalLine(item) ? (
                <div style={{ color: "#334155", fontSize: 13 }}>{signalLine(item)}</div>
              ) : null}
              {item.resolution ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: "#64748b", fontSize: 13 }}>Resolution</span>
                  <ResolutionStatusBadge status={item.resolution.status} />
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: "#64748b", fontSize: 13 }}>Owner</span>
                <AssignmentBadge
                  ownerId={item.assignment?.ownerId || null}
                  ownerLabel={item.assignment?.ownerLabel || null}
                />
              </div>
              {item.watch?.isActive ? (
                <div style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 600 }}>Watched</div>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Surfaced {formatTimestamp(item.timestamps.surfacedAt)}</div>
              {item.navigation.supportConsolePath ? (
                <Link to={item.navigation.supportConsolePath}>Open support console</Link>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default TriageQueueTable;
