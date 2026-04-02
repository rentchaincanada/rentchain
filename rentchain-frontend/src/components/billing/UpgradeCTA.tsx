import React from "react";
import { Button } from "../ui/Ui";
import { useUpgrade } from "@/context/UpgradeContext";
import { useAuth } from "@/context/useAuth";
import { getUpgradeCopy } from "@/billing/upgradeCopy";
import { resolveRequiredPlan } from "@/lib/upgradePrompt";

type Props = {
  featureKey: string;
  label?: string;
  source?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  title?: string;
  description?: string;
};

function toReason(featureKey: string): "screening" | "exports" | "automation" {
  const key = String(featureKey || "").toLowerCase();
  if (key.includes("export") || key.includes("pdf") || key.includes("review_summary")) return "exports";
  if (key.includes("screen")) return "screening";
  return "automation";
}

export function UpgradeCTA({
  featureKey,
  label,
  source,
  variant = "primary",
  size = "md",
  title,
  description,
}: Props) {
  const { openUpgrade } = useUpgrade();
  const { user } = useAuth();
  const copy = getUpgradeCopy(featureKey);
  const requiredPlan = resolveRequiredPlan(featureKey) || copy.requiredPlanLabel || "Pro";

  return (
    <Button
      type="button"
      variant={variant}
      style={size === "sm" ? { padding: "6px 10px", fontSize: 12 } : undefined}
      onClick={() =>
        openUpgrade({
          reason: toReason(featureKey),
          plan: user?.plan || "free",
          ctaLabel: label || copy.primaryCta,
          copy: {
            title: title || copy.title,
            body: description || copy.subtitle,
          },
        })
      }
      data-upgrade-source={source || featureKey}
    >
      {label || copy.primaryCta}
    </Button>
  );
}

export default UpgradeCTA;
