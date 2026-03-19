import React from "react";
import type { MoveInRequirements } from "@/api/tenantDetail";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

interface MoveInRequirementsCardProps {
  requirements?: MoveInRequirements | null;
}

function statusTone(status?: MoveInRequirements["status"] | null) {
  switch (status) {
    case "complete":
      return { background: "rgba(220,252,231,0.92)", border: "rgba(34,197,94,0.28)", color: "#166534", label: "Complete" };
    case "in-progress":
      return { background: "rgba(254,249,195,0.95)", border: "rgba(234,179,8,0.28)", color: "#a16207", label: "In progress" };
    case "not-started":
      return { background: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.28)", color: "#475569", label: "Not started" };
    default:
      return { background: "rgba(248,250,252,0.96)", border: "rgba(148,163,184,0.24)", color: "#64748b", label: "Unknown" };
  }
}

function stateTone(state?: string | null) {
  switch (state) {
    case "complete":
      return { background: "rgba(220,252,231,0.92)", border: "rgba(34,197,94,0.22)", color: "#166534", label: "Complete" };
    case "pending":
      return { background: "rgba(254,249,195,0.95)", border: "rgba(234,179,8,0.22)", color: "#a16207", label: "Pending" };
    case "not-required":
      return { background: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.22)", color: "#475569", label: "Not required" };
    default:
      return { background: "rgba(248,250,252,0.96)", border: "rgba(148,163,184,0.24)", color: "#64748b", label: "Unknown" };
  }
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatUpdated(value?: string | null) {
  if (!value) return "Awaiting more requirement data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Awaiting more requirement data";
  return `Updated ${parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export const MoveInRequirementsCard: React.FC<MoveInRequirementsCardProps> = ({ requirements }) => {
  if (!requirements || !Array.isArray(requirements.items) || requirements.items.length === 0 || (requirements.status === "unknown" && requirements.requiredCount === 0)) {
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
          <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Move-in requirements</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
            Track the required items that should be completed before move-in. Requirement states update as lease and onboarding information becomes available.
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
          Move-in requirements will appear as lease and onboarding details become available.
        </div>
      </section>
    );
  }

  const tone = statusTone(requirements.status);

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
          <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Move-in requirements</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
            Track the required items that should be completed before move-in. Requirement states update as lease and onboarding information becomes available.
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
        <div style={{ borderRadius: radius.lg, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.94)", padding: spacing.md, display: "grid", gap: 6 }}>
          <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Progress</div>
          <div style={{ color: text.primary, fontSize: 20, fontWeight: 800 }}>{formatPercent(requirements.progressPercent)}</div>
          <div style={{ color: text.subtle, fontSize: 12 }}>{formatUpdated(requirements.lastUpdatedAt)}</div>
        </div>
        <div style={{ borderRadius: radius.lg, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.94)", padding: spacing.md, display: "grid", gap: 6 }}>
          <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Completed</div>
          <div style={{ color: text.primary, fontSize: 20, fontWeight: 800 }}>{requirements.completedCount}</div>
          <div style={{ color: text.subtle, fontSize: 12 }}>Completed required items</div>
        </div>
        <div style={{ borderRadius: radius.lg, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.94)", padding: spacing.md, display: "grid", gap: 6 }}>
          <div style={{ color: text.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Required items</div>
          <div style={{ color: text.primary, fontSize: 20, fontWeight: 800 }}>{requirements.requiredCount}</div>
          <div style={{ color: text.subtle, fontSize: 12 }}>Tracked before move-in</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: spacing.sm }}>
        {requirements.items.map((item) => {
          const itemTone = stateTone(item.state);
          return (
            <div key={item.key} style={{ borderRadius: radius.lg, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.94)", padding: spacing.md, display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4, flex: "1 1 260px" }}>
                <div style={{ color: text.primary, fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                <div style={{ color: text.muted, fontSize: 12 }}>
                  {item.required ? "Required before move-in" : "Optional or not currently required"}
                  {item.source ? ` • Source: ${item.source.replace(/_/g, " ")}` : ""}
                </div>
                {item.note ? <div style={{ color: text.secondary, fontSize: 12, lineHeight: 1.5 }}>{item.note}</div> : null}
              </div>
              <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: radius.pill, border: `1px solid ${itemTone.border}`, background: itemTone.background, color: itemTone.color, fontSize: 12, fontWeight: 700 }}>
                  {itemTone.label}
                </span>
                {item.updatedAt ? <div style={{ color: text.subtle, fontSize: 12 }}>{formatUpdated(item.updatedAt)}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
