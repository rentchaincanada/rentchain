import React, { createContext, useContext, useEffect, useState } from "react";
import { UpgradeModal, type UpgradeReason } from "../components/billing/UpgradeModal";
import { UpgradePromptModal } from "../components/billing/UpgradePromptModal";
import { resolveRequiredPlan } from "../lib/upgradePrompt";

type UpgradeContextValue = {
  openUpgrade: (
    reason:
      | UpgradeReason
      | {
          reason: UpgradeReason;
          copy?: { title?: string; body?: string };
          plan?: string;
          ctaLabel?: string;
        }
  ) => void;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UpgradeReason>("propertiesMax");
  const [copy, setCopy] = useState<{ title?: string; body?: string } | undefined>(undefined);
  const [plan, setPlan] = useState<string>("Screening");
  const [ctaLabel, setCtaLabel] = useState<string | undefined>(undefined);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptFeatureKey, setPromptFeatureKey] = useState<string>("screening");
  const [promptCurrentPlan, setPromptCurrentPlan] = useState<string | undefined>(undefined);
  const [promptRequiredPlan, setPromptRequiredPlan] = useState<string | undefined>(undefined);

  const openUpgrade: UpgradeContextValue["openUpgrade"] = (r) => {
    if (typeof r === "string") {
      setReason(r);
      setCopy(undefined);
      setCtaLabel(undefined);
    } else {
      setReason(r.reason);
      setCopy(r.copy);
      if (r.plan) setPlan(r.plan);
      setCtaLabel(r.ctaLabel);
    }
    setOpen(true);
  };

  useEffect(() => {
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<any>).detail || {};
      const featureKey = String(detail.featureKey || detail.limitType || detail.capability || "").trim();
      if (!featureKey) return;
      const currentPlan = detail.currentPlan || detail.plan;
      const requiredPlan = detail.requiredPlan || resolveRequiredPlan(featureKey, currentPlan);
      setPromptFeatureKey(featureKey);
      setPromptCurrentPlan(currentPlan);
      setPromptRequiredPlan(requiredPlan);
      setPromptOpen(true);
    };
    window.addEventListener("upgrade:prompt", handler as EventListener);
    window.addEventListener("upgrade:plan-limit", handler as EventListener);
    return () => {
      window.removeEventListener("upgrade:prompt", handler as EventListener);
      window.removeEventListener("upgrade:plan-limit", handler as EventListener);
    };
  }, []);

  return (
    <UpgradeContext.Provider value={{ openUpgrade }}>
      {children}
      <UpgradeModal
        open={open}
        reason={reason}
        copy={copy}
        currentPlan={plan}
        ctaLabel={ctaLabel}
        onClose={() => setOpen(false)}
      />
      <UpgradePromptModal
        open={promptOpen}
        featureKey={promptFeatureKey}
        currentPlan={promptCurrentPlan}
        requiredPlan={promptRequiredPlan}
        onClose={() => setPromptOpen(false)}
      />
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used within UpgradeProvider");
  return ctx;
}
