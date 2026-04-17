import React from "react";
import { Button } from "../ui/Ui";
import { useAuth } from "@/context/useAuth";
import { getUpgradeCopy } from "@/billing/upgradeCopy";
import { dispatchUpgradePrompt, resolveRequiredPlan } from "@/lib/upgradePrompt";
import { track } from "@/lib/analytics";

type Props = {
  featureKey: string;
  label?: string;
  source?: string;
  presentation?: "locked" | "teaser" | "inline";
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function UpgradeCTA({
  featureKey,
  label,
  source,
  presentation,
  variant = "primary",
  size = "md",
}: Props) {
  const { user } = useAuth();
  const copy = getUpgradeCopy(featureKey);
  const requiredPlan = resolveRequiredPlan(featureKey, user?.plan) || "pro";
  const safeSource = source || featureKey;
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/dashboard";

  return (
    <Button
      type="button"
      variant={variant}
      style={size === "sm" ? { padding: "6px 10px", fontSize: 12 } : undefined}
      onClick={() => {
        track("upgrade_cta_clicked", {
          featureKey,
          currentPlan: user?.plan || "free",
          requiredPlan,
          source: safeSource,
          presentation,
          route: typeof window !== "undefined" ? window.location.pathname : undefined,
        });
        dispatchUpgradePrompt({
          featureKey,
          currentPlan: user?.plan || "free",
          requiredPlan,
          source: safeSource,
          redirectTo,
        });
      }}
      data-upgrade-source={safeSource}
    >
      {label || copy.primaryCta}
    </Button>
  );
}

export default UpgradeCTA;
