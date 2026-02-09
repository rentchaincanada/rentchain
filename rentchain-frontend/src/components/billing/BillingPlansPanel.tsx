import React from "react";
import { Button } from "../ui/Ui";
import { colors, radius, text } from "../../styles/tokens";
import { BillingIntervalToggle } from "./BillingIntervalToggle";
import { getVisiblePlans, type PlanKey } from "@/billing/planVisibility";

type Props = {
  pricing: any | null;
  pricingLoading: boolean;
  pricingUnavailable: boolean;
  interval: "month" | "year";
  onIntervalChange: (value: "month" | "year") => void;
  currentPlan?: string | null;
  role?: string | null;
  mode: "billing" | "pricing";
  planActionLoading?: string | null;
  onSelectPlan: (planKey: "starter" | "pro" | "business") => void;
};

const normalizePlan = (input?: string | null): PlanKey => {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "business") return "business";
  if (raw === "elite") return "elite";
  return "screening";
};

export function BillingPlansPanel({
  pricing,
  pricingLoading,
  pricingUnavailable,
  interval,
  onIntervalChange,
  currentPlan,
  role,
  mode,
  planActionLoading,
  onSelectPlan,
}: Props) {
  const visiblePlans = React.useMemo<PlanKey[]>(
    () => getVisiblePlans(role),
    [role]
  );
  const planMap = React.useMemo(() => {
    const map = new Map<string, any>();
    if (pricing?.plans) {
      pricing.plans.forEach((plan: any) => map.set(plan.key, plan));
    }
    return map;
  }, [pricing]);
  const currentPlanKey = normalizePlan(currentPlan);

  const renderPrice = (planKey: PlanKey) => {
    if (pricingUnavailable) return "—";
    const plan = planMap.get(planKey);
    if (!plan) return "—";
    const amountCents =
      interval === "year" ? plan.yearlyAmountCents : plan.monthlyAmountCents;
    if (!amountCents) return "—";
    const suffix = interval === "year" ? "year" : "month";
    return `$${(amountCents / 100).toFixed(0)} / ${suffix}`;
  };

  const planMeta = (planId: PlanKey) => {
    const label =
      planId === "pro"
        ? "Pro"
        : planId === "business"
        ? "Business"
        : planId === "elite"
        ? "Elite"
        : "Starter";
    const desc =
      planId === "pro"
        ? "Messaging, ledger, exports."
        : planId === "business"
        ? "Portfolio analytics and compliance."
        : planId === "elite"
        ? "Enterprise controls and compliance."
        : "Rental management + maintenance.";
    return { label, desc };
  };

  const ctaLabel = (planId: PlanKey, isCurrent: boolean) => {
    if (isCurrent) return "Current plan";
    if (planId === "elite") return "Contact sales";
    if (planActionLoading === planId) return "Starting...";
    if (mode === "pricing") {
      if (planId === "pro") return "Upgrade to Pro";
      if (planId === "business") return "Choose plan";
      return "Get started";
    }
    return "Choose plan";
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <BillingIntervalToggle value={interval} onChange={onIntervalChange} />
      {visiblePlans.map((planId) => {
        if (planId === "screening") return null;
        const { label, desc } = planMeta(planId);
        const highlight = currentPlanKey === planId;
        return (
          <div
            key={planId}
            style={{
              borderRadius: radius.lg,
              border: highlight
                ? "1px solid rgba(59,130,246,0.45)"
                : "1px solid rgba(148,163,184,0.25)",
              background: highlight ? "rgba(59,130,246,0.08)" : "rgba(148,163,184,0.06)",
              padding: 12,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{label}</div>
                <div style={{ fontSize: 12, color: text.muted }}>{desc}</div>
              </div>
              {highlight ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.accent }}>Current</span>
              ) : null}
            </div>
            <div style={{ color: text.muted, fontSize: 13 }}>
              {pricingLoading ? "—" : renderPrice(planId)}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                type="button"
                variant={highlight ? "secondary" : "primary"}
                onClick={() => {
                  if (planId === "elite") return;
                  if (planId === "starter" || planId === "pro" || planId === "business") {
                    onSelectPlan(planId);
                  }
                }}
                disabled={
                  pricingUnavailable ||
                  highlight ||
                  planActionLoading === planId ||
                  planId === "elite"
                }
              >
                {ctaLabel(planId, highlight)}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
