import React from "react";

type TierV1 = "excellent" | "good" | "watch" | "risk";

function tierDot(tier: TierV1) {
  if (tier === "excellent") return "#16A34A";
  if (tier === "good") return "#22C55E";
  if (tier === "watch") return "#F59E0B";
  return "#DC2626";
}

function tierLabel(tier: TierV1) {
  if (tier === "excellent") return "Excellent";
  if (tier === "good") return "Good";
  if (tier === "watch") return "Watch";
  return "Risk";
}

export function TenantScorePill({
  score,
  tier,
  compact = false,
}: {
  score: number | null | undefined;
  tier: TierV1 | null | undefined;
  compact?: boolean;
}) {
  const s = typeof score === "number" ? score : null;
  const t = (tier as TierV1) || null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: compact ? "4px 8px" : "6px 10px",
        borderRadius: 999,
        border: "1px solid #E5E7EB",
        background: "#FFFFFF",
        fontSize: 12,
        fontWeight: 900,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      title={t && s !== null ? `Score v1: ${s} (${tierLabel(t)})` : "Score v1"}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: t ? tierDot(t) : "#9CA3AF" }} />
      <span style={{ opacity: 0.7 }}>Score</span>
      <span style={{ fontSize: 13 }}>{s !== null ? s : "—"}</span>
      {!compact ? <span style={{ opacity: 0.7 }}>{t ? `(${tierLabel(t).toLowerCase()})` : ""}</span> : null}
    </span>
  );
}
