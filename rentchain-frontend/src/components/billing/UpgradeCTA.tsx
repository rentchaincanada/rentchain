import React from "react";
import { Button } from "../ui/Ui";
import { useAuth } from "@/context/useAuth";
import { getUpgradeCopy } from "@/billing/upgradeCopy";
import { dispatchUpgradePrompt, resolveRequiredPlan } from "@/lib/upgradePrompt";

type Props = {
  featureKey: string;
  label?: string;
  source?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function UpgradeCTA({
  featureKey,
  label,
  source,
  variant = "primary",
  size = "md",
}: Props) {
  const { user } = useAuth();
  const copy = getUpgradeCopy(featureKey);
  const requiredPlan = resolveRequiredPlan(featureKey, user?.plan) || "pro";
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/dashboard";

  return (
    <Button
      type="button"
      variant={variant}
      style={size === "sm" ? { padding: "6px 10px", fontSize: 12 } : undefined}
      onClick={() =>
        dispatchUpgradePrompt({
          featureKey,
          currentPlan: user?.plan || "free",
          requiredPlan,
          source: source || featureKey,
          redirectTo,
        })
      }
      data-upgrade-source={source || featureKey}
    >
      {label || copy.primaryCta}
    </Button>
  );
}

export default UpgradeCTA;
