import React from "react";
import { radius, spacing, text } from "@/styles/tokens";
import { UpgradeCTA } from "./UpgradeCTA";

type Props = {
  featureKey: string;
  eyebrow?: string;
  title: string;
  description: string;
  ctaLabel?: string;
};

export function FeatureTeaser({ featureKey, eyebrow, title, description, ctaLabel }: Props) {
  return (
    <section
      style={{
        borderRadius: radius.xl,
        border: "1px dashed rgba(37,99,235,0.32)",
        background: "rgba(239,246,255,0.68)",
        padding: spacing.lg,
        display: "grid",
        gap: spacing.sm,
      }}
    >
      {eyebrow ? (
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1d4ed8" }}>
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: 16, fontWeight: 800, color: text.primary }}>{title}</div>
      <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.6 }}>{description}</div>
      <div>
        <UpgradeCTA
          featureKey={featureKey}
          label={ctaLabel}
          source="feature_teaser"
          presentation="teaser"
          variant="secondary"
        />
      </div>
    </section>
  );
}

export default FeatureTeaser;
