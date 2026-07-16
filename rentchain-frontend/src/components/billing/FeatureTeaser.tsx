import React from "react";
import { radius, spacing, text } from "@/styles/tokens";
import { UpgradeCTA } from "./UpgradeCTA";
import { getUpgradeCopy } from "@/billing/upgradeCopy";
import { normalizePlanLabel } from "@/billing/planLabel";
import { resolveRequiredPlan } from "@/lib/upgradePrompt";

type Props = {
  featureKey: string;
  eyebrow?: string;
  title: string;
  description: string;
  ctaLabel?: string;
};

export function FeatureTeaser({ featureKey, eyebrow, title, description, ctaLabel }: Props) {
  const copy = getUpgradeCopy(featureKey);
  const requiredPlanLabel = normalizePlanLabel(resolveRequiredPlan(featureKey) || "pro");
  const valueBullets = copy.bullets?.slice(0, 2) || [];

  return (
    <section
      style={{
        borderRadius: radius.xl,
        border: "1px dashed rgba(30,95,78,0.32)",
        background: "rgba(30,95,78,0.08)",
        padding: spacing.lg,
        display: "grid",
        gap: spacing.sm,
      }}
    >
      {eyebrow ? (
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1e5f4e" }}>
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: 16, fontWeight: 800, color: text.primary }}>{title}</div>
      <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.6 }}>{description}</div>
      <div style={{ color: text.secondary, fontSize: 13, fontWeight: 700 }}>Unlocks on {requiredPlanLabel}</div>
      {valueBullets.length ? (
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, fontSize: 13, lineHeight: 1.55, display: "grid", gap: 4 }}>
          {valueBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        <UpgradeCTA
          featureKey={featureKey}
          label={ctaLabel}
          source="feature_teaser"
          presentation="teaser"
          variant="secondary"
        />
        <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>
          Opens a quick upgrade prompt so you can review the fit before deciding whether to continue.
        </div>
      </div>
    </section>
  );
}

export default FeatureTeaser;
