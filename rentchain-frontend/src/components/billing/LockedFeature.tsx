import React from "react";
import { Card } from "../ui/Ui";
import { radius, spacing, text } from "@/styles/tokens";
import { UpgradeCTA } from "./UpgradeCTA";
import { getUpgradeCopy } from "@/billing/upgradeCopy";
import { normalizePlanLabel } from "@/billing/planLabel";
import { resolveRequiredPlan } from "@/lib/upgradePrompt";

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
  const copy = getUpgradeCopy(featureKey);
  const requiredPlanLabel = normalizePlanLabel(resolveRequiredPlan(featureKey) || "pro");
  const valueBullets = copy.bullets?.slice(0, compact ? 2 : 3) || [];

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
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#1d4ed8",
          }}
        >
          Locked feature
        </div>
        <div style={{ fontSize: compact ? 15 : 16, fontWeight: 800, color: text.primary }}>{title}</div>
        <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.6 }}>{description}</div>
        <div style={{ color: text.secondary, fontSize: 13, fontWeight: 700 }}>
          Available on {requiredPlanLabel}
        </div>
        {hint ? <div style={{ color: text.secondary, fontSize: 12 }}>{hint}</div> : null}
        {valueBullets.length ? (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, fontSize: 13, lineHeight: 1.55, display: "grid", gap: 4 }}>
            {valueBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <UpgradeCTA
          featureKey={featureKey}
          label={ctaLabel}
          source="locked_feature"
          presentation="locked"
          variant="secondary"
        />
        <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>
          Opens a quick upgrade prompt first. Checkout only begins if you choose to continue.
        </div>
      </div>
    </Card>
  );
}

export default LockedFeature;
