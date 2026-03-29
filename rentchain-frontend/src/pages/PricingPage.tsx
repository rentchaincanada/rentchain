import React from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";
import { useAuth } from "../context/useAuth";
import { useCapabilities } from "../hooks/useCapabilities";
import { startCheckout } from "../billing/startCheckout";
import { createBillingPortalSession, fetchBillingPricing, type BillingPlanPricing } from "../api/billingApi";
import { DEFAULT_PLANS, type PricingInterval, type PricingPlanKey } from "../constants/pricingPlans";
import { track } from "@/lib/analytics";

type PlanKey = PricingPlanKey;

const PLAN_ORDER: PlanKey[] = ["free", "starter", "pro", "elite"];
const PLAN_FEATURES: Record<PlanKey, string[]> = Object.fromEntries(
  DEFAULT_PLANS.map((plan) => [plan.key, plan.features])
) as Record<PlanKey, string[]>;
const BILLING_PLAN_KEY_BY_UI_PLAN: Record<Exclude<PlanKey, "free">, BillingPlanPricing["key"]> = {
  starter: "starter",
  pro: "pro",
  elite: "business",
};

function normalizePlan(input?: string | null): PlanKey {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "elite" || raw === "business" || raw === "enterprise") return "elite";
  return "free";
}

function ctaLabel(plan: Exclude<PlanKey, "free">) {
  if (plan === "pro") return "Upgrade to Pro";
  if (plan === "elite") return "Explore Elite";
  return "Upgrade to Starter";
}

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { caps } = useCapabilities();
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);
  const [interval, setInterval] = React.useState<PricingInterval>("monthly");
  const [pricingByPlan, setPricingByPlan] = React.useState<Partial<Record<BillingPlanPricing["key"], BillingPlanPricing>>>({});
  const safeTrack = (eventName: string, props: Record<string, unknown>) => {
    try {
      track(eventName, props);
    } catch {
      // telemetry must never interrupt UX
    }
  };

  React.useEffect(() => {
    let active = true;
    fetchBillingPricing()
      .then((res) => {
        if (!active || !res?.plans?.length) return;
        setPricingByPlan(
          Object.fromEntries(res.plans.map((plan) => [plan.key, plan])) as Partial<
            Record<BillingPlanPricing["key"], BillingPlanPricing>
          >
        );
      })
      .catch(() => {
        if (active) setPricingByPlan({});
      });
    return () => {
      active = false;
    };
  }, []);

  const renderPrice = (planKey: PlanKey) => {
    const plan = DEFAULT_PLANS.find((item) => item.key === planKey);
    if (!plan) return "Price unavailable";
    if (planKey === "free") {
      const value = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
      return value;
    }
    const billingPlan = pricingByPlan[BILLING_PLAN_KEY_BY_UI_PLAN[planKey]];
    if (billingPlan) {
      const amountCents =
        interval === "yearly" ? billingPlan.yearlyAmountCents : billingPlan.monthlyAmountCents;
      const value = `$${(amountCents / 100).toFixed(0)}`;
      return interval === "yearly" ? `${value} / year` : `${value} / month`;
    }
    const value = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    return interval === "yearly" ? `${value} / year` : `${value} / month`;
  };

  const handleUpgrade = async (target: Exclude<PlanKey, "free">) => {
    if (target === "pro") {
      safeTrack("pricing_timeline_cta_clicked", { surface: "in_app" });
    }
    if (PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(target)) {
      try {
        const portal = await createBillingPortalSession();
        if (portal?.url) {
          window.location.assign(portal.url);
          return;
        }
      } catch {
        // fall through to billing page
      }
      navigate("/billing");
      return;
    }

    void startCheckout({
      tier: target === "elite" ? "business" : target,
      interval: "monthly",
      featureKey: "pricing",
      source: "workspace_pricing",
      redirectTo: "/billing",
    });
  };

  return (
    <MacShell title="RentChain · Pricing" showTopNav={false}>
      <Section style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: spacing.md }}>
        <Card elevated>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Pricing</h1>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>
            Free keeps guided onboarding, basic applicant workflow, manual expenses, and property archiving usable today. Upgrades add richer workflow tools, cleaner exports, and stronger reporting.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted }}>
            Screening follows a guided request, status, and review workflow. Paid plans add more decision support and reporting depth without overpromising unsupported automation.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted }}>
            Published plan prices mirror the current checkout pricing when billing is available.
          </p>
        </Card>

        <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Card style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "inline-flex", gap: 8, border: "1px solid rgba(15,23,42,0.12)", borderRadius: 999, padding: 4 }}>
              <Button
                type="button"
                variant={interval === "monthly" ? "primary" : "ghost"}
                onClick={() => setInterval("monthly")}
                style={{ padding: "6px 12px" }}
              >
                Monthly
              </Button>
              <Button
                type="button"
                variant={interval === "yearly" ? "primary" : "ghost"}
                onClick={() => setInterval("yearly")}
                style={{ padding: "6px 12px" }}
              >
                Annual
              </Button>
            </div>
          </Card>
          {PLAN_ORDER.map((plan) => (
            <Card key={plan} style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.xs, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 18, textTransform: "capitalize" }}>{plan}</div>
                {plan === "pro" ? (
                  <span
                    style={{
                      border: "1px solid rgba(37,99,235,0.35)",
                      borderRadius: 999,
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#1d4ed8",
                      background: "rgba(37,99,235,0.08)",
                    }}
                  >
                    Most Popular for growing portfolios
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{renderPrice(plan)}</div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
                {PLAN_FEATURES[plan].map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan === "starter" ? (
                <div style={{ color: text.muted, fontSize: 13 }}>
                  Free stays usable for setup, manual tracking, and archive support. Starter adds richer applicant and day-to-day workflow tools.
                </div>
              ) : null}
              {plan === "pro" ? (
                <div
                  style={{
                    border: "1px solid rgba(37,99,235,0.28)",
                    borderRadius: 12,
                    background: "rgba(37,99,235,0.06)",
                    padding: "10px 12px",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>Built for stronger reporting</div>
                  <ul style={{ margin: 0, paddingLeft: "1rem", color: text.muted, fontSize: 13, lineHeight: 1.6 }}>
                    <li>CSV expense import</li>
                    <li>CSV, spreadsheet, and PDF exports</li>
                    <li>Screening workflow with decision support</li>
                    <li>Cleaner month-end and accountant handoff</li>
                  </ul>
                </div>
              ) : null}
              <div>
                {plan === "free" ? (
                  <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")}>
                    Start Free
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void handleUpgrade(plan)}>
                    {ctaLabel(plan)}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>FAQ</h2>
          <details open style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              Do I need a subscription to screen tenants?
            </summary>
            <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>
              No. RentChain supports a guided screening request and review workflow, while paid plans add stronger workflow tools and reporting around that process.
            </p>
          </details>
        </Card>
      </Section>
    </MacShell>
  );
};

export default PricingPage;
