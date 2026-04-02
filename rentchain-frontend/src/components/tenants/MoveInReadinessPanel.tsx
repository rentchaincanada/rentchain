import React from "react";
import type {
  MoveInReadiness,
  MoveInReadinessItem,
  MoveInReadinessItemStatus,
} from "@/api/tenantDetail";
import { Button } from "../ui/Ui";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

const STATUS_LABELS: Record<MoveInReadinessItemStatus, string> = {
  not_started: "Not started",
  pending: "Pending",
  submitted: "Submitted",
  confirmed: "Confirmed",
  blocked: "Blocked",
  not_required: "Not required",
};

function overallTone(status: MoveInReadiness["overallStatus"]) {
  switch (status) {
    case "complete":
      return { label: "Complete", bg: "rgba(220,252,231,0.92)", border: "rgba(34,197,94,0.28)", color: "#166534" };
    case "ready_for_keys":
      return { label: "Ready for keys", bg: "rgba(219,234,254,0.95)", border: "rgba(59,130,246,0.28)", color: "#1d4ed8" };
    case "blocked":
      return { label: "Blocked", bg: "rgba(254,226,226,0.95)", border: "rgba(239,68,68,0.28)", color: "#b91c1c" };
    case "in_progress":
      return { label: "In progress", bg: "rgba(254,249,195,0.95)", border: "rgba(234,179,8,0.28)", color: "#a16207" };
    default:
      return { label: "Not started", bg: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.28)", color: "#475569" };
  }
}

function itemTone(status: MoveInReadinessItemStatus) {
  switch (status) {
    case "confirmed":
      return { bg: "rgba(220,252,231,0.92)", border: "rgba(34,197,94,0.22)", color: "#166534" };
    case "blocked":
      return { bg: "rgba(254,226,226,0.95)", border: "rgba(239,68,68,0.24)", color: "#b91c1c" };
    case "submitted":
      return { bg: "rgba(224,231,255,0.95)", border: "rgba(99,102,241,0.24)", color: "#4338ca" };
    case "pending":
      return { bg: "rgba(254,249,195,0.95)", border: "rgba(234,179,8,0.22)", color: "#a16207" };
    case "not_required":
      return { bg: "rgba(241,245,249,0.96)", border: "rgba(148,163,184,0.22)", color: "#475569" };
    default:
      return { bg: "rgba(248,250,252,0.96)", border: "rgba(148,163,184,0.24)", color: "#64748b" };
  }
}

function formatUpdated(value?: string | null) {
  if (!value) return "No recent updates";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No recent updates";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function groupLabel(stage: MoveInReadinessItem["stage"]) {
  switch (stage) {
    case "lease":
      return "Lease";
    case "onboarding":
      return "Onboarding";
    case "funding":
      return "Funding";
    case "inspection":
      return "Inspection";
    default:
      return "Keys";
  }
}

type DraftState = Record<string, { status: MoveInReadinessItemStatus; note: string; blockerReason: string }>;

export const MoveInReadinessPanel: React.FC<{
  readiness?: MoveInReadiness | null;
  saving?: boolean;
  onUpdate: (update: {
    key: MoveInReadinessItem["key"];
    status: MoveInReadinessItemStatus;
    note?: string | null;
    blockerReason?: string | null;
  }) => Promise<void>;
}> = ({ readiness, saving, onUpdate }) => {
  const [drafts, setDrafts] = React.useState<DraftState>({});

  React.useEffect(() => {
    const next: DraftState = {};
    for (const item of readiness?.items || []) {
      next[item.key] = {
        status: item.status,
        note: item.note || "",
        blockerReason: item.blockerReason || "",
      };
    }
    setDrafts(next);
  }, [readiness]);

  if (!readiness || !Array.isArray(readiness.items) || readiness.items.length === 0) {
    return null;
  }

  const tone = overallTone(readiness.overallStatus);
  const stages = ["lease", "onboarding", "funding", "inspection", "keys"] as const;

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
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 800 }}>Move-in readiness</div>
          <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
            Track each move-in step from signed lease through key release so it is clear what is done, what is pending, and what is blocking move-in.
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: radius.pill,
            border: `1px solid ${tone.border}`,
            background: tone.bg,
            color: tone.color,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {tone.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.md }}>
        <SummaryTile label="Completion" value={`${readiness.completionPercent}%`} caption={`Updated ${formatUpdated(readiness.lastUpdatedAt)}`} />
        <SummaryTile label="Next step" value={readiness.nextRequiredStep || "No pending steps"} caption="Next required operational milestone" />
        <SummaryTile label="Blockers" value={String(readiness.blockerCount)} caption="Blocked items that need review" />
      </div>

      {stages.map((stage) => {
        const items = readiness.items.filter((item) => item.stage === stage);
        if (!items.length) return null;
        return (
          <div key={stage} style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ fontWeight: 800, color: text.primary }}>{groupLabel(stage)}</div>
            {items.map((item) => {
              const itemColors = itemTone(item.status);
              const draft = drafts[item.key] || {
                status: item.status,
                note: item.note || "",
                blockerReason: item.blockerReason || "",
              };
              return (
                <div
                  key={item.key}
                  style={{
                    borderRadius: radius.lg,
                    border: `1px solid ${colors.border}`,
                    background: "rgba(255,255,255,0.94)",
                    padding: spacing.md,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 4, flex: "1 1 280px" }}>
                      <div style={{ color: text.primary, fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                      <div style={{ color: text.muted, fontSize: 12 }}>
                        {item.required ? "Required before move-in" : "Optional or not currently required"}
                        {item.source === "manual" ? " - Updated by landlord" : " - Derived from current workflow data"}
                      </div>
                      {item.note ? <div style={{ color: text.secondary, fontSize: 12 }}>{item.note}</div> : null}
                      {item.blockerReason ? <div style={{ color: "#b91c1c", fontSize: 12 }}>{item.blockerReason}</div> : null}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "5px 9px",
                        borderRadius: radius.pill,
                        border: `1px solid ${itemColors.border}`,
                        background: itemColors.bg,
                        color: itemColors.color,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 180px) minmax(0, 1fr) minmax(0, 1fr) auto" }}>
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.key]: { ...draft, status: e.target.value as MoveInReadinessItemStatus },
                        }))
                      }
                      style={{
                        padding: "9px 10px",
                        borderRadius: radius.md,
                        border: `1px solid ${colors.border}`,
                        background: colors.panel,
                        color: text.primary,
                      }}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draft.note}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.key]: { ...draft, note: e.target.value },
                        }))
                      }
                      placeholder="Operational note"
                      style={{
                        padding: "9px 10px",
                        borderRadius: radius.md,
                        border: `1px solid ${colors.border}`,
                        background: colors.panel,
                        color: text.primary,
                        minWidth: 0,
                      }}
                    />
                    <input
                      value={draft.blockerReason}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.key]: { ...draft, blockerReason: e.target.value },
                        }))
                      }
                      placeholder="Blocker reason"
                      style={{
                        padding: "9px 10px",
                        borderRadius: radius.md,
                        border: `1px solid ${colors.border}`,
                        background: colors.panel,
                        color: text.primary,
                        minWidth: 0,
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() =>
                        void onUpdate({
                          key: item.key,
                          status: draft.status,
                          note: draft.note || null,
                          blockerReason: draft.blockerReason || null,
                        })
                      }
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 800, color: text.primary }}>Readiness timeline</div>
        {readiness.events.length ? (
          readiness.events.map((event) => (
            <div
              key={event.id}
              style={{
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                padding: "8px 10px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ color: text.primary, fontWeight: 700 }}>{event.label}</div>
              <div style={{ color: text.muted, fontSize: 12 }}>
                {event.actorRole} - {formatUpdated(event.createdAt)}
              </div>
              {event.note ? <div style={{ color: text.secondary, fontSize: 12 }}>{event.note}</div> : null}
            </div>
          ))
        ) : (
          <div style={{ color: text.muted, fontSize: 13 }}>No readiness updates recorded yet.</div>
        )}
      </div>
    </section>
  );
};

const SummaryTile: React.FC<{ label: string; value: React.ReactNode; caption?: React.ReactNode }> = ({ label, value, caption }) => (
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
