import React from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";
import { useAuth } from "../context/useAuth";
import { useCapabilities } from "../hooks/useCapabilities";
import { startCheckout } from "../billing/startCheckout";
import { createBillingPortalSession, fetchBillingPricing, type BillingPlanPricing } from "../api/billingApi";
import {
  CANONICAL_TIER_MATRIX,
  DEFAULT_PLANS,
  PLAN_ORDER,
  TIER_MATRIX_AREAS,
  type PricingInterval,
  type PricingPlanKey,
} from "../constants/pricingPlans";
import { track } from "@/lib/analytics";

type PlanKey = PricingPlanKey;

const pricingCardMotionStyle: React.CSSProperties = {
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
  willChange: "transform, box-shadow",
};

const wrappingTextStyle: React.CSSProperties = {
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const PLAN_FEATURES: Record<PlanKey, string[]> = Object.fromEntries(
  DEFAULT_PLANS.map((plan) => [plan.key, plan.features])
) as Record<PlanKey, string[]>;

function pricingCardShadow(plan: PlanKey, hovered: boolean) {
  if (plan === "pro") {
    return hovered ? "0 22px 42px rgba(37,99,235,0.16)" : "0 16px 34px rgba(37,99,235,0.12)";
  }
  return hovered ? "0 16px 32px rgba(15,23,42,0.10)" : "0 10px 24px rgba(15,23,42,0.06)";
}

function normalizePlan(input?: string | null): PlanKey {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "elite" || raw === "business" || raw === "enterprise") return "elite";
  return "free";
}

function ctaLabel(plan: Exclude<PlanKey, "free">) {
  return CANONICAL_TIER_MATRIX[plan].ctaLabel;
}

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { caps } = useCapabilities();
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);
  const [interval, setInterval] = React.useState<PricingInterval>("monthly");
  const [pricingByPlan, setPricingByPlan] = React.useState<Partial<Record<BillingPlanPricing["key"], BillingPlanPricing>>>({});
  const [hoveredPlan, setHoveredPlan] = React.useState<PlanKey | null>(null);
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
    const billingPlan = pricingByPlan[planKey];
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
      tier: target,
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
          <p style={{ marginTop: spacing.sm, color: text.muted, maxWidth: 760, lineHeight: 1.65 }}>
            Free keeps guided onboarding, manual workflows, and pay-per-use screening usable today. Starter adds day-to-day rental operations, Pro adds exports and compliance reporting, and Elite adds advanced analytics and audit visibility.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 760, lineHeight: 1.65 }}>
            Screening is available across all tiers as pay-per-use when you run it. Paid plans add stronger workflow support, review visibility, summaries, and reporting around that same screening flow.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 760, lineHeight: 1.65 }}>
            Published plan prices mirror the current checkout pricing when billing is available.
          </p>
        </Card>

        <div
          style={{
            display: "grid",
            gap: spacing.lg,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            alignItems: "stretch",
            overflow: "visible",
            padding: "4px",
            margin: "-4px",
          }}
        >
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
            <Card
              key={plan}
              elevated={plan === "pro"}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                minWidth: 0,
                minHeight: "100%",
                padding: 20,
                position: "relative",
                zIndex: hoveredPlan === plan ? 2 : 1,
                isolation: "isolate",
                overflow: "visible",
                transform: hoveredPlan === plan ? "translateY(-3px)" : "translateY(0)",
                border:
                  plan === "pro" ? "1px solid rgba(37,99,235,0.28)" : "1px solid rgba(15,23,42,0.08)",
                background:
                  plan === "pro"
                    ? "linear-gradient(180deg, rgba(37,99,235,0.06) 0%, #ffffff 28%)"
                    : "#ffffff",
                boxShadow: pricingCardShadow(plan, hoveredPlan === plan),
                ...pricingCardMotionStyle,
              }}
              onMouseEnter={() => setHoveredPlan(plan)}
              onMouseLeave={() => setHoveredPlan((current) => (current === plan ? null : current))}
              onFocus={() => setHoveredPlan(plan)}
              onBlur={() => setHoveredPlan((current) => (current === plan ? null : current))}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.15, ...wrappingTextStyle }}>
                  {CANONICAL_TIER_MATRIX[plan].label}
                </div>
                {plan === "pro" ? (
                  <span
                    style={{
                      border: "1px solid rgba(37,99,235,0.4)",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#1d4ed8",
                      background: "linear-gradient(180deg, rgba(37,99,235,0.14), rgba(37,99,235,0.08))",
                      maxWidth: "100%",
                      overflowWrap: "anywhere",
                      letterSpacing: 0.2,
                      boxShadow: "0 8px 20px rgba(37,99,235,0.12)",
                    }}
                  >
                    Most Popular for growing portfolios
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, ...wrappingTextStyle }}>{renderPrice(plan)}</div>
              <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.65, minHeight: 68, ...wrappingTextStyle }}>
                {CANONICAL_TIER_MATRIX[plan].tagline}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.1rem",
                  color: text.muted,
                  lineHeight: 1.75,
                  minWidth: 0,
                  display: "grid",
                  gap: 8,
                  flex: "0 0 auto",
                }}
              >
                {PLAN_FEATURES[plan].map((feature) => (
                  <li key={feature} style={{ fontSize: 14, ...wrappingTextStyle }}>
                    {feature}
                  </li>
                ))}
              </ul>
              {plan === "starter" ? (
                <div
                  style={{
                    color: text.muted,
                    fontSize: 13,
                    lineHeight: 1.65,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.03)",
                    border: "1px solid rgba(15,23,42,0.06)",
                    minWidth: 0,
                    flex: "0 0 auto",
                    ...wrappingTextStyle,
                  }}
                >
                  Free stays usable for setup, manual tracking, and archive support. Starter adds richer applicant and day-to-day workflow tools.
                </div>
              ) : null}
              {plan === "pro" ? (
                <div
                  style={{
                    border: "1px solid rgba(37,99,235,0.28)",
                    borderRadius: 12,
                    background: "rgba(37,99,235,0.06)",
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                    minWidth: 0,
                    flex: "0 0 auto",
                  }}
                >
                  <div style={{ fontWeight: 800, lineHeight: 1.25, ...wrappingTextStyle }}>Built for stronger reporting</div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "1rem",
                      color: text.muted,
                      fontSize: 13,
                      lineHeight: 1.65,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <li style={{ overflowWrap: "anywhere" }}>CSV expense import</li>
                    <li style={{ overflowWrap: "anywhere" }}>CSV, spreadsheet, and PDF exports</li>
                    <li style={{ overflowWrap: "anywhere" }}>Compliance reports and screening review summaries</li>
                    <li style={{ overflowWrap: "anywhere" }}>Cleaner month-end and accountant handoff</li>
                  </ul>
                </div>
              ) : null}
              {plan !== "free" ? (
                <div
                  style={{
                    border: "1px solid rgba(15,23,42,0.12)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                    minWidth: 0,
                    flex: "0 0 auto",
                  }}
                >
                  {TIER_MATRIX_AREAS.slice(0, 4).map((area) => (
                    <div key={`${plan}-${area.key}`} style={{ color: text.muted, fontSize: 13, lineHeight: 1.55, ...wrappingTextStyle }}>
                      <strong style={{ color: text.secondary }}>{area.label}:</strong> {CANONICAL_TIER_MATRIX[plan].capabilities[area.key].summary}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ marginTop: "auto", paddingTop: 8, width: "100%" }}>
                {plan === "free" ? (
                  <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")} style={{ width: "100%" }}>
                    Start Free
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void handleUpgrade(plan)} style={{ width: "100%" }}>
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
              No. Screening is available as a pay-per-use workflow on every tier. Paid plans add more operational workflow, summaries, exports, and reporting around screening.
            </p>
          </details>
        </Card>
      </Section>
    </MacShell>
  );
};

export default PricingPage;
