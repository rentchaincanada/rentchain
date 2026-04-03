import React from "react";
import { Button } from "../ui/Ui";
import { colors, radius, text } from "../../styles/tokens";
import { PlanIntervalToggle } from "./PlanIntervalToggle";
import { getVisiblePlans, type PlanKey } from "@/billing/planVisibility";
import {
  CANONICAL_TIER_MATRIX,
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
  role?: string | null;
  mode: "billing" | "pricing";
  planActionLoading?: string | null;
  onSelectPlan: (planKey: "starter" | "pro" | "elite") => void;
};

const normalizePlan = (input?: string | null): PricingPlanKey => {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "business" || raw === "elite" || raw === "enterprise") return "elite";
  return "free";
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
  const visiblePlans = React.useMemo<PlanKey[]>(() => getVisiblePlans(role), [role]);
  const planMap = React.useMemo(() => {
    const map = new Map<string, any>();
    if (pricing?.plans) {
      pricing.plans.forEach((plan: any) => map.set(plan.key, plan));
    }
    return map;
  }, [pricing]);
  const currentPlanKey = normalizePlan(currentPlan);

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
    if (mode === "pricing" && planKey === "starter") return "Get started";
    return CANONICAL_TIER_MATRIX[planKey].ctaLabel;
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <PlanIntervalToggle value={interval} onChange={onIntervalChange} />

      {visiblePlans.map((planId) => {
        if (planId === "screening") return null;

        const plan = CANONICAL_TIER_MATRIX[planId];
        const highlight = currentPlanKey === planId;
        const topAreas = TIER_MATRIX_AREAS.slice(0, 4);

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
              </div>

              {highlight ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.accent }}>Current</span>
              ) : null}
            </div>

            <div className="rc-billing-plan-price" style={{ color: text.muted }}>
              {pricingLoading ? "—" : renderPrice(planId)}
            </div>

            <ul className="rc-billing-plan-features" style={{ color: text.muted, margin: 0, paddingLeft: "1.1rem" }}>
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
          </div>
        );
      })}
    </div>
  );
}
