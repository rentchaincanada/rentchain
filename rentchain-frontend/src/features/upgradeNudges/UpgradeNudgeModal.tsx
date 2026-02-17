import React from "react";
import type { NudgeType } from "./nudgeTypes";

type Props = {
  open: boolean;
  type: NudgeType;
  title: string;
  body: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  onUpgrade: () => void;
  onDismiss: () => void;
};

export function UpgradeNudgeModal({
  open,
  title,
  body,
  primaryCtaLabel = "Upgrade",
  secondaryCtaLabel = "Not now",
  onUpgrade,
  onDismiss,
}: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        aria-hidden
        onClick={onDismiss}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,23,42,0.42)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width: "min(520px, 96vw)",
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,0.35)",
          background: "white",
          boxShadow: "0 24px 60px rgba(15,23,42,0.28)",
          padding: 18,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 800 }}>{title}</div>
        <div style={{ color: "#475569", fontSize: 14 }}>{body}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
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
        </div>
      </div>
    </div>
  );
}
