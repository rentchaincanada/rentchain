import React, { createContext, useContext, useEffect, useState } from "react";
import { UpgradeModal, type UpgradeReason } from "../components/billing/UpgradeModal";

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
      const limitType = detail.limitType;
      const planDetail = detail.plan;
      const max = detail.max;
      const message = detail.message;
      const body =
        message
          ? message
          : limitType === "units"
          ? `Starter allows up to ${max ?? "your plan limit"} total units across your portfolio.`
          : limitType === "properties"
          ? `Starter allows up to ${max ?? "your plan limit"} properties.`
          : "You have reached your plan limit. Upgrade to continue.";
      const reason: UpgradeReason =
        limitType === "units"
          ? "unitsMax"
          : limitType === "properties"
          ? "propertiesMax"
          : "propertiesMax";

      openUpgrade({
        reason,
        copy: { title: "Upgrade required", body },
        plan: planDetail,
      });
    };
    window.addEventListener("upgrade:plan-limit", handler as EventListener);
    return () => {
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
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used within UpgradeProvider");
  return ctx;
}
