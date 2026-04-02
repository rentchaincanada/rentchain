import React from "react";
import { Card } from "../ui/Ui";
import { radius, spacing, text } from "@/styles/tokens";
import { UpgradeCTA } from "./UpgradeCTA";

type Props = {
  featureKey: string;
  title: string;
  description: string;
  hint?: string;
  ctaLabel?: string;
  compact?: boolean;
};

export function LockedFeature({
  featureKey,
  title,
  description,
  hint,
  ctaLabel,
  compact = false,
}: Props) {
  return (
    <Card
      style={{
        borderRadius: radius.xl,
        border: "1px solid rgba(15,23,42,0.12)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        padding: compact ? spacing.md : spacing.lg,
        display: "grid",
        gap: compact ? spacing.sm : spacing.md,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: compact ? 15 : 16, fontWeight: 800, color: text.primary }}>{title}</div>
        <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.6 }}>{description}</div>
        {hint ? <div style={{ color: text.secondary, fontSize: 12 }}>{hint}</div> : null}
      </div>
      <div>
        <UpgradeCTA featureKey={featureKey} label={ctaLabel} variant="secondary" />
      </div>
    </Card>
  );
}

export default LockedFeature;
