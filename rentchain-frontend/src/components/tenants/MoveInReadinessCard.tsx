import React from "react";
import type { MoveInReadiness } from "@/api/tenantDetail";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

interface MoveInReadinessCardProps {
  readiness?: MoveInReadiness | null;
}

function statusTone(status?: MoveInReadiness["status"] | null) {
  switch (status) {
    case "completed":
      return { background: "rgba(220,252,231,0.92)", border: "rgba(34,197,94,0.28)", color: "#166534", label: "Completed" };
    case "ready":
      return { background: "rgba(219,234,254,0.95)", border: "rgba(59,130,246,0.28)", color: "#1d4ed8", label: "Ready" };
    case "in-progress":
      return { background: "rgba(254,249,195,0.95)", border: "rgba(234,179,8,0.28)", color: "#a16207", label: "In progress" };
    case "not-started":
      return { background: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.28)", color: "#475569", label: "Not started" };
    default:
      return { background: "rgba(248,250,252,0.96)", border: "rgba(148,163,184,0.24)", color: "#64748b", label: "Unknown" };
  }
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatUpdated(value?: string | null) {
  if (!value) return "Awaiting more move-in details";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Awaiting more move-in details";
  return `Updated ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function yesNoUnknown(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

const MetricTile: React.FC<{ label: string; value: React.ReactNode; caption?: React.ReactNode }> = ({ label, value, caption }) => (
  <div
    style={{
      borderRadius: radius.lg,
      border: `1px solid ${colors.border}`,
      background: "rgba(255,255,255,0.94)",
      padding: spacing.md,
      display: "grid",
      gap: 6,
    }}
  >
    <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </div>
    <div style={{ color: text.primary, fontSize: 20, fontWeight: 800 }}>{value}</div>
    {caption ? <div style={{ color: text.subtle, fontSize: 12 }}>{caption}</div> : null}
  </div>
);

const ItemList: React.FC<{ items: string[]; emptyLabel: string }> = ({ items, emptyLabel }) => {
  if (!items.length) {
    return <div style={{ color: text.subtle, fontSize: 12 }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 9px",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: "rgba(248,250,252,0.96)",
            color: text.secondary,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

export const MoveInReadinessCard: React.FC<MoveInReadinessCardProps> = ({ readiness }) => {
  if (!readiness || readiness.status === "unknown") {
    return (
      <section
        style={{
          borderRadius: radius.xl,
          border: `1px solid ${colors.borderStrong}`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
          boxShadow: shadows.soft,
          padding: spacing.lg,
          display: "grid",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Move-in readiness</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
            Track the requirements that should be completed before move-in. Requirements update as lease and onboarding steps are completed.
          </div>
        </div>
        <div
          style={{
            borderRadius: radius.lg,
            border: `1px dashed ${colors.borderStrong}`,
            background: "rgba(248,250,252,0.92)",
            padding: spacing.md,
            color: text.muted,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Move-in readiness will appear as lease and onboarding details become available.
        </div>
      </section>
    );
  }

  const tone = statusTone(readiness.status);
  const completedItems = Array.isArray(readiness.completedItems) ? readiness.completedItems : [];
  const outstandingItems = Array.isArray(readiness.outstandingItems) ? readiness.outstandingItems : [];

  return (
    <section
      style={{
        borderRadius: radius.xl,
        border: `1px solid ${colors.borderStrong}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        boxShadow: shadows.soft,
        padding: spacing.lg,
        display: "grid",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Move-in readiness</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
            Track the requirements that should be completed before move-in. Requirements update as lease and onboarding steps are completed.
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: radius.pill,
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {tone.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.md }}>
        <MetricTile label="Readiness" value={formatPercent(readiness.readinessPercent)} caption={formatUpdated(readiness.lastUpdatedAt)} />
        <MetricTile label="Keys release ready" value={yesNoUnknown(readiness.keysReleaseReady)} caption="Operational release check" />
        <MetricTile label="Lease signed" value={yesNoUnknown(readiness.leaseSigned)} caption="Signed status from current lease context" />
        <MetricTile label="Portal activated" value={yesNoUnknown(readiness.portalActivated)} caption="Invite and activation evidence" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing.md }}>
        <div
          style={{
            borderRadius: radius.lg,
            border: `1px solid ${colors.border}`,
            background: "rgba(255,255,255,0.94)",
            padding: spacing.md,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Completed items
          </div>
          <ItemList items={completedItems} emptyLabel="No completed readiness items yet." />
        </div>

        <div
          style={{
            borderRadius: radius.lg,
            border: `1px solid ${colors.border}`,
            background: "rgba(255,255,255,0.94)",
            padding: spacing.md,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Outstanding items
          </div>
          <ItemList items={outstandingItems} emptyLabel="No outstanding requirements right now." />
        </div>
      </div>
    </section>
  );
};
