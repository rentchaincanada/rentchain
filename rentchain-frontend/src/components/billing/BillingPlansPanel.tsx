import React from "react";
import { Button } from "../ui/Ui";
import { colors, radius, text } from "../../styles/tokens";
import { PlanIntervalToggle } from "./PlanIntervalToggle";
import { getVisiblePlans, type PlanKey } from "@/billing/planVisibility";
import { normalizePlan } from "@/lib/plan";
import {
  CANONICAL_TIER_MATRIX,
  TIER_POSITIONING_COPY,
  TIER_MATRIX_AREAS,
  type PricingPlanKey,
} from "@/constants/pricingPlans";

type Props = {
  pricing: any | null;
  pricingLoading: boolean;
  pricingUnavailable: boolean;
  interval: "month" | "year";
  onIntervalChange: (value: "month" | "year") => void;
  currentPlan?: string | null;
  selectedPlan?: "starter" | "pro" | "elite" | null;
  recommendedPlan?: "starter" | "pro" | "elite" | null;
  role?: string | null;
  mode: "billing" | "pricing";
  planActionLoading?: string | null;
  onSelectPlan: (planKey: "starter" | "pro" | "elite") => void;
};

export function BillingPlansPanel({
  pricing,
  pricingLoading,
  pricingUnavailable,
  interval,
  onIntervalChange,
  currentPlan,
  selectedPlan,
  recommendedPlan,
  role,
  mode,
  planActionLoading,
  onSelectPlan,
}: Props) {
  const visiblePlans = React.useMemo<PlanKey[]>(() => getVisiblePlans(role), [role]);
  const planMap = React.useMemo(() => {
    const map = new Map<string, any>();
    if (pricing?.plans) {
      pricing.plans.forEach((plan: any) => map.set(plan.key, plan));
    }
    return map;
  }, [pricing]);
  const currentPlanKey = currentPlan == null ? null : normalizePlan(currentPlan);

  const renderPrice = (planKey: Exclude<PricingPlanKey, "free">) => {
    const fallbackPlan = CANONICAL_TIER_MATRIX[planKey];
    if (pricingUnavailable) {
      return interval === "year" ? `${fallbackPlan.yearlyPrice} / year` : `${fallbackPlan.monthlyPrice} / month`;
    }
    const plan = planMap.get(planKey);
    if (!plan) {
      return interval === "year" ? `${fallbackPlan.yearlyPrice} / year` : `${fallbackPlan.monthlyPrice} / month`;
    }
    const amountCents = interval === "year" ? plan.yearlyAmountCents : plan.monthlyAmountCents;
    if (!amountCents) return "—";
    return `$${(amountCents / 100).toFixed(0)} / ${interval === "year" ? "year" : "month"}`;
  };

  const ctaLabel = (planKey: Exclude<PricingPlanKey, "free">, isCurrent: boolean) => {
    if (isCurrent) return "Current plan";
    if (planActionLoading === planKey) return "Starting...";
    const paidPlanOrder: Exclude<PricingPlanKey, "free">[] = ["starter", "pro", "elite"];
    if (currentPlanKey && currentPlanKey !== "free") {
      if (paidPlanOrder.indexOf(currentPlanKey as Exclude<PricingPlanKey, "free">) >= paidPlanOrder.indexOf(planKey)) {
        return "Manage plan";
      }
    }
    return `Continue to ${CANONICAL_TIER_MATRIX[planKey].label} checkout`;
  };

  const ctaSupportCopy = (
    planKey: Exclude<PricingPlanKey, "free">,
    isCurrent: boolean,
    isSelected: boolean,
    isRecommended: boolean
  ) => {
    if (isCurrent) return "Your current plan is already active.";
    if (currentPlanKey && currentPlanKey !== "free") {
      const paidPlanOrder: Exclude<PricingPlanKey, "free">[] = ["starter", "pro", "elite"];
      if (paidPlanOrder.indexOf(currentPlanKey as Exclude<PricingPlanKey, "free">) >= paidPlanOrder.indexOf(planKey)) {
        return "Opens the billing portal to manage your existing subscription.";
      }
    }
    if (isSelected) {
      return `Selected from pricing. Opens secure checkout for the ${CANONICAL_TIER_MATRIX[planKey].label} plan you already chose so you can keep building in the same workflow, review details, and confirm before billing starts.`;
    }
    if (isRecommended) {
      return `Recommended next step based on your current plan. Opens secure checkout for ${TIER_POSITIONING_COPY[planKey].badge.toLowerCase()} so you can extend the workflow you already use and review the plan before confirming any change.`;
    }
    return `Opens secure checkout so you can review the ${CANONICAL_TIER_MATRIX[planKey].label} plan, see what it adds next in RentChain, confirm billing details, and decide whether to complete the change.`;
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <PlanIntervalToggle value={interval} onChange={onIntervalChange} />

      {visiblePlans.map((planId) => {
        if (planId === "screening") return null;

        const plan = CANONICAL_TIER_MATRIX[planId];
        const highlight = currentPlanKey === planId;
        const selected = selectedPlan === planId;
        const recommended = !highlight && recommendedPlan === planId;
        const topAreas = TIER_MATRIX_AREAS.slice(0, 4);

        return (
          <div
            key={planId}
            style={{
              borderRadius: radius.lg,
              border: highlight
                ? "1px solid rgba(59,130,246,0.45)"
                : selected
                  ? "1px solid rgba(37,99,235,0.45)"
                  : recommended
                    ? "1px solid rgba(14,116,144,0.42)"
                  : "1px solid rgba(148,163,184,0.25)",
              background: highlight
                ? "rgba(59,130,246,0.08)"
                : selected
                  ? "rgba(37,99,235,0.08)"
                  : recommended
                    ? "rgba(14,116,144,0.08)"
                  : "rgba(148,163,184,0.06)",
              padding: 12,
              display: "grid",
              gap: 12,
              boxShadow: recommended ? "0 14px 28px rgba(14,116,144,0.10)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{plan.label}</div>
                <div className="rc-billing-plan-subtitle" style={{ color: text.muted }}>
                  {plan.tagline}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: text.secondary }}>
                  {TIER_POSITIONING_COPY[planId].badge}
                </div>
              </div>
              {highlight ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.accent }}>Current</span>
              ) : selected ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>Selected from pricing</span>
              ) : recommended ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Recommended next step</span>
              ) : null}
            </div>

            <div className="rc-billing-plan-price" style={{ color: text.muted }}>
              {pricingLoading ? "—" : renderPrice(planId)}
            </div>

            <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.55 }}>
              {TIER_POSITIONING_COPY[planId].support}
            </div>

            <ul
              className="rc-billing-plan-features"
              style={{ color: text.muted, margin: 0, paddingLeft: "1.1rem" }}
            >
              {plan.features.slice(0, 4).map((feature) => (
                <li key={`${planId}-${feature}`}>{feature}</li>
              ))}
            </ul>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 8,
              }}
            >
              {topAreas.map((area) => (
                <div
                  key={`${planId}-${area.key}`}
                  style={{
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 12,
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.5)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: text.secondary }}>{area.label}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: text.muted }}>
                    {plan.capabilities[area.key].summary}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                type="button"
                variant={highlight ? "secondary" : "primary"}
                onClick={() => {
                  if (!highlight) onSelectPlan(planId);
                }}
                disabled={pricingUnavailable || highlight || planActionLoading === planId}
              >
                {ctaLabel(planId, highlight)}
              </Button>
            </div>
            <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.5 }}>
              {ctaSupportCopy(planId, highlight, selected, recommended)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
