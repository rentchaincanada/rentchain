import React from "react";
import { NotifyMeModal } from "./NotifyMeModal";
import { useAuth } from "../../context/useAuth";
import { startCheckout } from "@/billing/startCheckout";
import { fetchBillingPricing, fetchPricingHealth } from "@/api/billingApi";
import { BillingIntervalToggle } from "./BillingIntervalToggle";
import { getVisiblePlans, type PlanKey } from "@/billing/planVisibility";
import { track } from "@/lib/analytics";

export type UpgradeReason =
  | "propertiesMax"
  | "unitsMax"
  | "screening"
  | "exports"
  | "automation";

export function UpgradeModal({
  open,
  onClose,
  reason,
  currentPlan = "Starter",
  copy: propCopy,
  ctaLabel,
}: {
  open: boolean;
  onClose: () => void;
  reason: UpgradeReason;
  currentPlan?: string;
  copy?: { title?: string; body?: string };
  ctaLabel?: string;
}) {
  const { user } = useAuth();
  const [pricing, setPricing] = React.useState<any | null>(null);
  const [loadingPricing, setLoadingPricing] = React.useState(true);
  const [pricingHealth, setPricingHealth] = React.useState<any | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [interval, setInterval] = React.useState<"month" | "year">("month");
  const [selectedPlan, setSelectedPlan] = React.useState<PlanKey>("pro");
  const [notifyOpen, setNotifyOpen] = React.useState(false);
  const [notifyPlan, setNotifyPlan] = React.useState<"core" | "pro" | "elite">("core");

  const safeReason = reason ?? ("propertiesMax" as UpgradeReason);

  React.useEffect(() => {
    if (!open) return;
    track("upgrade_modal_opened", {
      reason: safeReason,
      currentPlan: currentPlanKey,
    });
  }, [currentPlanKey, open, safeReason]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    fetchBillingPricing()
      .then((res) => {
        if (!active) return;
        setPricing(res);
      })
      .finally(() => {
        if (active) setLoadingPricing(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    fetchPricingHealth()
      .then((res) => {
        if (!active) return;
        setPricingHealth(res);
      })
      .finally(() => {
        if (active) setHealthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const normalizePlan = (input?: string) => {
    const raw = String(input || "").trim().toLowerCase();
    if (raw === "starter" || raw === "core") return "starter";
    if (raw === "pro") return "pro";
    if (raw === "business") return "business";
    if (raw === "elite") return "elite";
    return "starter";
  };
  const currentPlanKey = normalizePlan(currentPlan);
  const pricingUnavailable =
    !healthLoading && pricingHealth && pricingHealth.ok === false;
  const visiblePlans = React.useMemo<PlanKey[]>(
    () => getVisiblePlans(user?.actorRole || user?.role || null),
    [user?.actorRole, user?.role]
  );
  const planMap = React.useMemo(() => {
    const map = new Map<string, any>();
    if (pricing?.plans) {
      pricing.plans.forEach((plan: any) => map.set(plan.key, plan));
    }
    return map;
  }, [pricing]);
  const renderPriceLabel = (planKey: PlanKey) => {
    if (loadingPricing) return "Loading...";
    const plan = planMap.get(planKey);
    if (!plan) return "—";
    const amountCents =
      interval === "year" ? plan.yearlyAmountCents : plan.monthlyAmountCents;
    if (!amountCents) return "—";
    const suffix = interval === "year" ? "year" : "month";
    return `$${Math.round(amountCents / 100)} / ${suffix}`;
  };
  const planLabel = (planKey: PlanKey) => {
    switch (planKey) {
      case "pro":
        return "Pro";
      case "business":
        return "Business";
      case "elite":
        return "Elite";
      default:
        return "Starter";
    }
  };
  const planDescription = (planKey: PlanKey) => {
    switch (planKey) {
      case "pro":
        return `Team workflows and ledger exports · ${renderPriceLabel(planKey)}`;
      case "business":
        return `Portfolio analytics and compliance · ${renderPriceLabel(planKey)}`;
      case "elite":
        return `Enterprise controls · ${renderPriceLabel(planKey)}`;
      default:
        return `Rental management + maintenance · ${renderPriceLabel(planKey)}`;
    }
  };

  const reasonCopy: Record<UpgradeReason, { title: string; body: string }> = {
    propertiesMax: {
      title: "Upgrade required",
      body: "Starter plan allows only 1 property. Upgrade to add more.",
    },
    unitsMax: {
      title: "Upgrade required",
      body: "Starter plan allows up to 10 units total. Upgrade to add more.",
    },
    screening: {
      title: "Upgrade to manage your rentals",
      body: "RentChain Screening is free. Rental management starts on Starter.",
    },
    exports: {
      title: "Upgrade required",
      body: "Advanced exports are available on higher plans.",
    },
    automation: {
      title: "Upgrade required",
      body: "Automated workflows unlock in Core and above.",
    },
  };

  const rawCopy = propCopy ?? reasonCopy[safeReason];

  const copy = {
    title: rawCopy?.title ?? "Upgrade required",
    body: rawCopy?.body ?? "You’ve reached your plan limit. Upgrade to continue.",
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,6,23,0.45)",
          zIndex: 100,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          background: "white",
          borderRadius: 20,
          zIndex: 101,
          boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
        }}
      >
        <div style={{ padding: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            {copy?.title ?? "Upgrade required"}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
            {copy?.body ?? "You’ve reached your plan limit. Upgrade to continue."}
          </div>

          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            {visiblePlans
              .filter((planKey) => planKey !== "screening")
              .map((planKey) => (
                <PlanRow
                  key={planKey}
                  name={planLabel(planKey)}
                  description={planDescription(planKey)}
                  active={currentPlanKey === planKey}
                  highlight={selectedPlan === planKey}
                  disabled={currentPlanKey === planKey}
                  onClick={() => setSelectedPlan(planKey)}
                />
              ))}
          </div>

          {pricingUnavailable ? (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.08)",
                color: "#b91c1c",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Billing temporarily unavailable. Please try again later.
            </div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <BillingIntervalToggle value={interval} onChange={setInterval} />
          </div>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.35)",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Not now
            </button>

            <button
              onClick={() =>
                {
                  track("upgrade_modal_upgrade_clicked", {
                    reason: safeReason,
                    toTier: selectedPlan,
                    interval,
                  });
                  startCheckout({
                    tier: selectedPlan,
                    interval,
                    featureKey: safeReason,
                    source: "upgrade_modal",
                    redirectTo:
                      typeof window !== "undefined"
                        ? `${window.location.pathname}${window.location.search}`
                        : "/dashboard",
                  });
                }
              }
              disabled={selectedPlan === currentPlanKey || pricingUnavailable}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(59,130,246,0.45)",
                background: "rgba(59,130,246,0.12)",
                color: "#2563eb",
                cursor:
                  selectedPlan === currentPlanKey || pricingUnavailable ? "not-allowed" : "pointer",
                fontWeight: 900,
                boxShadow: "0 10px 30px rgba(37,99,235,0.2)",
                opacity: selectedPlan === currentPlanKey || pricingUnavailable ? 0.6 : 1,
              }}
            >
              {ctaLabel ||
                (selectedPlan === "starter"
                  ? "Choose Starter"
                  : selectedPlan === "business" || selectedPlan === "elite"
                  ? "Choose plan"
                  : "Upgrade to Pro")}
            </button>
          </div>
        </div>
      </div>

      <NotifyMeModal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        desiredPlan={notifyPlan}
        context="upgrade_modal"
        defaultEmail={user?.email}
      />
    </>
  );
}

function PlanRow({
  name,
  description,
  active,
  highlight,
  disabled,
  onClick,
}: {
  name: string;
  description: string;
  active?: boolean;
  highlight?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        border: active
          ? "1px solid rgba(34,197,94,0.45)"
          : highlight
          ? "1px solid rgba(59,130,246,0.45)"
          : "1px solid rgba(148,163,184,0.25)",
        background: active
          ? "rgba(34,197,94,0.10)"
          : highlight
          ? "rgba(59,130,246,0.10)"
          : "rgba(148,163,184,0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div>
        <div style={{ fontWeight: 900 }}>{name}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{description}</div>
      </div>
      {active ? (
        <span style={{ fontSize: 12, fontWeight: 900, color: "#16a34a" }}>
          Current
        </span>
      ) : null}
    </button>
  );
}
