import React from "react";
import { Card } from "../ui/Ui";
import { radius, spacing, text } from "@/styles/tokens";
import { UpgradeCTA } from "./UpgradeCTA";
import { getUpgradeCopy } from "@/billing/upgradeCopy";
import { normalizePlanLabel } from "@/billing/planLabel";
import { resolveRequiredPlan } from "@/lib/upgradePrompt";
import {
  getUpgradeDriversForFeature,
  UPGRADE_DRIVER_DESCRIPTIONS,
  type UpgradeDriver,
} from "@/constants/tiers";

type Props = {
  featureKey: string;
  featureName?: string;
  title?: string;
  description?: string;
  hint?: string;
  ctaLabel?: string;
  requiredTier?: string;
  upgradeDrivers?: UpgradeDriver[];
  compact?: boolean;
};

export function LockedFeature({
  featureKey,
  featureName,
  title,
  description,
  hint,
  ctaLabel,
  requiredTier,
  upgradeDrivers,
  compact = false,
}: Props) {
  const copy = getUpgradeCopy(featureKey);
  const requiredPlan = requiredTier || resolveRequiredPlan(featureKey) || "pro";
  const requiredPlanLabel = normalizePlanLabel(requiredPlan);
  const drivers = upgradeDrivers?.length ? upgradeDrivers : getUpgradeDriversForFeature(featureKey);
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
            letterSpacing: 0,
            textTransform: "uppercase",
            color: "#1d4ed8",
          }}
        >
          {featureName || "Locked feature"}
        </div>
        <div style={{ fontSize: compact ? 15 : 16, fontWeight: 800, color: text.primary }}>
          {title || copy.title}
        </div>
        <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.6 }}>
          {description || copy.subtitle}
        </div>
        <div style={{ color: text.secondary, fontSize: 13, fontWeight: 700 }}>
          Available on {requiredPlanLabel}
        </div>
        {drivers.length ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: text.secondary, fontSize: 13, fontWeight: 800 }}>
              Upgrade drivers: {drivers.join(", ")}
            </div>
            {!compact ? (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, fontSize: 13, lineHeight: 1.55, display: "grid", gap: 4 }}>
                {drivers.map((driver) => (
                  <li key={driver}>
                    <strong>{driver}:</strong> {UPGRADE_DRIVER_DESCRIPTIONS[driver]}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
          Review upgrade options before checkout. Checkout only begins if you choose to continue.
        </div>
      </div>
    </Card>
  );
}

export default LockedFeature;
