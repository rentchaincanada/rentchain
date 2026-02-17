import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { UpgradeNudgeBanner } from "./UpgradeNudgeBanner";
import { UpgradeNudgeModal } from "./UpgradeNudgeModal";
import { NUDGE_COPY, mapFeatureKeyToNudgeType, type NudgeType } from "./nudgeTypes";
import { canShowNudge, markNudgeDismissed, markNudgeShown } from "./nudgeStore";
import { openUpgradeFlow } from "@/billing/openUpgradeFlow";

type ActiveNudge = {
  type: NudgeType;
  presentation: "modal" | "banner";
};

type UpgradeDetail = {
  featureKey?: string;
  source?: string;
  plan?: string;
};

type Props = {
  onTelemetry?: (eventName: string, eventProps?: Record<string, unknown>) => void;
};

export function UpgradeNudgeHost({ onTelemetry }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [active, setActive] = React.useState<ActiveNudge | null>(null);

  const roleLower = String(user?.actorRole || user?.role || "").trim().toLowerCase();
  const isAdmin = roleLower === "admin";
  const userId = String(user?.id || "");
  const plan = String(user?.plan || "").trim().toLowerCase() || "starter";

  React.useEffect(() => {
    if (!userId || isAdmin) return;
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<UpgradeDetail>).detail || {};
      const type = mapFeatureKeyToNudgeType(detail.featureKey);
      const allowed = canShowNudge(userId, type);
      const presentation = allowed ? "modal" : "banner";
      if (allowed) {
        markNudgeShown(userId, type);
      }
      setActive({ type, presentation });
      onTelemetry?.("nudge_impression", { type, page: window.location.pathname, plan, source: detail.source || "upgrade_prompt" });
    };

    window.addEventListener("upgrade:prompt", handler as EventListener);
    window.addEventListener("upgrade:plan-limit", handler as EventListener);
    return () => {
      window.removeEventListener("upgrade:prompt", handler as EventListener);
      window.removeEventListener("upgrade:plan-limit", handler as EventListener);
    };
  }, [isAdmin, onTelemetry, plan, userId]);

  if (!active || isAdmin) return null;

  const copy = NUDGE_COPY[active.type] || NUDGE_COPY.GENERIC_UPGRADE;
  const dismiss = () => {
    if (userId) markNudgeDismissed(userId, active.type);
    onTelemetry?.("nudge_dismiss", { type: active.type });
    setActive(null);
  };
  const upgrade = async () => {
    onTelemetry?.("nudge_click_upgrade", { type: active.type });
    await openUpgradeFlow({ navigate });
    setActive(null);
  };

  if (active.presentation === "modal") {
    return (
      <UpgradeNudgeModal
        open
        type={active.type}
        title={copy.title}
        body={copy.body}
        primaryCtaLabel={copy.primaryCtaLabel}
        secondaryCtaLabel={copy.secondaryCtaLabel}
        onUpgrade={() => {
          void upgrade();
        }}
        onDismiss={dismiss}
      />
    );
  }

  return (
    <div style={{ position: "sticky", top: 74, zIndex: 1990, margin: "0 16px 8px" }}>
      <UpgradeNudgeBanner
        type={active.type}
        title={copy.title}
        body={copy.body}
        primaryCtaLabel={copy.primaryCtaLabel}
        secondaryCtaLabel={copy.secondaryCtaLabel}
        onUpgrade={() => {
          void upgrade();
        }}
        onDismiss={dismiss}
      />
    </div>
  );
}
