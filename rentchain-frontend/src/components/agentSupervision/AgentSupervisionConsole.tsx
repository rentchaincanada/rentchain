import React from "react";
import { Link } from "react-router-dom";
import type {
  AgentSupervisionItem,
  AgentSupervisionSeverity,
  AgentSupervisionSnapshot,
  AgentSupervisionStatus,
} from "@/api/agentSupervisionApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function severityTone(severity: AgentSupervisionSeverity) {
  if (severity === "critical") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (severity === "high") return { color: "#9f1239", background: "#ffe4e6", border: "#fecdd3" };
  if (severity === "medium") return { color: "#9a3412", background: "#ffedd5", border: "#fed7aa" };
  if (severity === "low") return { color: "#075985", background: "#e0f2fe", border: "#bae6fd" };
  return { color: "#334155", background: "#f1f5f9", border: "#cbd5e1" };
}

function statusTone(status: AgentSupervisionStatus) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "pending_review" || status === "suggested") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "acknowledged" || status === "synchronized") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, tone }: { children: React.ReactNode; tone: { color: string; background: string; border: string } }) {
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        background: tone.background,
        color: tone.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 800,
        maxWidth: "100%",
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </span>
  );
}

function SupervisionItemCard({ item }: { item: AgentSupervisionItem }) {
  return (
    <Card style={{ borderRadius: 8, padding: 12, display: "grid", gap: 8, minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", minWidth: 0, maxWidth: "100%" }}>
        <Badge tone={severityTone(item.severity)}>{label(item.severity)}</Badge>
        <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
        <span style={{ color: "#475569", fontSize: 13, fontWeight: 800, minWidth: 0, overflowWrap: "anywhere" }}>{label(item.itemType)}</span>
        <span style={{ color: "#64748b", fontSize: 13, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
          Scope: {label(item.relatedScope.scope)} {item.relatedScope.scopeId}
        </span>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "#0f172a" }}>{label(item.label)}</strong>
        <span style={{ color: "#475569", lineHeight: 1.5 }}>{item.description}</span>
      </div>
      {item.blockedReasons.length ? (
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: "#991b1b", fontSize: 13 }}>View blocked reason</strong>
          {item.blockedReasons.map((reason) => (
            <span key={reason} style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
              {reason}
            </span>
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#475569", fontSize: 12, fontWeight: 800, minWidth: 0 }}>
        <span>Manual review required</span>
        <span>Policy guarded</span>
        <span>Human approval required</span>
      </div>
      {item.destination ? (
        <Link to={item.destination} style={{ color: "#2563eb", fontWeight: 800 }}>
          View supervision item
        </Link>
      ) : null}
    </Card>
  );
}

function ItemSection({ title, items }: { title: string; items: AgentSupervisionItem[] }) {
  if (!items.length) return null;
  return (
    <Section style={{ display: "grid", gap: 10, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
      <div style={{ fontWeight: 900, color: "#0f172a" }}>{title}</div>
      <div style={{ display: "grid", gap: 10, minWidth: 0, maxWidth: "100%" }}>
        {items.map((item) => (
          <SupervisionItemCard key={item.supervisionItemId} item={item} />
        ))}
      </div>
    </Section>
  );
}

export function AgentSupervisionConsole({ snapshot }: { snapshot: AgentSupervisionSnapshot }) {
  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
      <Section style={{ display: "grid", gap: 8, minWidth: 0, maxWidth: "100%" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: "#0f172a" }}>Supervised operational intelligence only.</strong>
          <span style={{ color: "#475569" }}>
            Manual review and approval remain required. No tenant communication, payment action, legal enforcement, or
            external submission is automated.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#475569", fontSize: 12, fontWeight: 900, minWidth: 0 }}>
          <span>External execution disabled</span>
          <span>Autonomous execution disabled</span>
          <span>Manual review required</span>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10, minWidth: 0, maxWidth: "100%" }}>
        <div style={{ fontWeight: 900 }}>Supervision summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(145px, 100%), 1fr))", gap: 10, minWidth: 0 }}>
          {[
            ["Suggested actions", snapshot.summary.suggestedActions],
            ["Blocked actions", snapshot.summary.blockedActions],
            ["Pending reviews", snapshot.summary.pendingReviews],
            ["Escalations", snapshot.summary.escalations],
            ["Workflow sync issues", snapshot.summary.workflowSyncIssues],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12, minWidth: 0 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, overflowWrap: "anywhere" }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{value}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <ItemSection title="Suggested actions" items={snapshot.agentActions} />
      <ItemSection title="Workflow synchronization" items={snapshot.workflowStates} />
      <ItemSection title="Blocked policy guards" items={snapshot.policyGuardResults} />
      <ItemSection title="Escalations" items={snapshot.escalations} />
      <ItemSection title="Review lineage" items={snapshot.reviewReferences} />
      <ItemSection title="Evidence references" items={snapshot.evidenceReferences} />
      <ItemSection title="Timeline references" items={snapshot.timelineReferences} />
    </div>
  );
}
