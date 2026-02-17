import React from "react";
import type { NudgeType } from "./nudgeTypes";

type Props = {
  type: NudgeType;
  title: string;
  body: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  onUpgrade: () => void;
  onDismiss: () => void;
};

export function UpgradeNudgeBanner({
  title,
  body,
  primaryCtaLabel = "Upgrade",
  secondaryCtaLabel = "Not now",
  onUpgrade,
  onDismiss,
}: Props) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(37,99,235,0.35)",
        background: "rgba(37,99,235,0.08)",
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: "#475569", fontSize: 13 }}>{body}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onUpgrade}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(37,99,235,0.5)",
            background: "rgba(37,99,235,0.16)",
            color: "#1d4ed8",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {primaryCtaLabel}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.45)",
            background: "white",
            color: "#334155",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {secondaryCtaLabel}
        </button>
      </div>
    </div>
  );
}
