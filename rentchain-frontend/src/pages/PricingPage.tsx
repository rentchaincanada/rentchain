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
};

const wrappingTextStyle: React.CSSProperties = {
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const priceCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  alignContent: "start",
  alignItems: "start",
  minWidth: 0,
  minHeight: "100%",
  padding: 22,
};

const planHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const planListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "1.2rem",
  color: text.muted,
  lineHeight: 1.75,
  minWidth: 0,
  display: "grid",
  gap: 10,
};

const detailBoxStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "14px 16px",
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const anchoredCtaStyle: React.CSSProperties = {
  marginTop: "auto",
  paddingTop: 10,
  alignSelf: "end",
  width: "100%",
};

const PLAN_FEATURES: Record<PlanKey, string[]> = Object.fromEntries(
  DEFAULT_PLANS.map((plan) => [plan.key, plan.features])
) as Record<PlanKey, string[]>;

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

        <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Card style={{ gridColumn: "1 / -1", padding: "16px 18px" }}>
            <div
              style={{
                display: "inline-flex",
                gap: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: 999,
                padding: 4,
                flexWrap: "wrap",
              }}
            >
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
                ...priceCardStyle,
                border:
                  plan === "pro" ? "1px solid rgba(37,99,235,0.28)" : "1px solid rgba(15,23,42,0.08)",
                background:
                  plan === "pro"
                    ? "linear-gradient(180deg, rgba(37,99,235,0.06) 0%, #ffffff 28%)"
                    : "#ffffff",
                boxShadow:
                  plan === "pro"
                    ? "0 16px 34px rgba(37,99,235,0.12)"
                    : "0 10px 24px rgba(15,23,42,0.06)",
                ...pricingCardMotionStyle,
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-3px)";
                event.currentTarget.style.boxShadow =
                  plan === "pro"
                    ? "0 22px 42px rgba(37,99,235,0.16)"
                    : "0 16px 32px rgba(15,23,42,0.10)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "translateY(0)";
                event.currentTarget.style.boxShadow =
                  plan === "pro"
                    ? "0 16px 34px rgba(37,99,235,0.12)"
                    : "0 10px 24px rgba(15,23,42,0.06)";
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                <div style={planHeaderStyle}>
                  <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.12, ...wrappingTextStyle }}>
                    {CANONICAL_TIER_MATRIX[plan].label}
                  </div>
                  <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.7, maxWidth: 34 * 16, ...wrappingTextStyle }}>
                    {CANONICAL_TIER_MATRIX[plan].tagline}
                  </div>
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
                      alignSelf: "flex-start",
                    }}
                  >
                    Most Popular for growing portfolios
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 4,
                  paddingBottom: 2,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.02, ...wrappingTextStyle }}>{renderPrice(plan)}</div>
              </div>
              <ul
                style={planListStyle}
              >
                {PLAN_FEATURES[plan].map((feature) => (
                  <li key={feature} style={{ fontSize: 14, paddingLeft: 2, ...wrappingTextStyle }}>
                    {feature}
                  </li>
                ))}
              </ul>
              {plan === "starter" ? (
                <div
                  style={{
                    ...detailBoxStyle,
                    color: text.muted,
                    fontSize: 13,
                    lineHeight: 1.65,
                    background: "rgba(15,23,42,0.03)",
                    border: "1px solid rgba(15,23,42,0.06)",
                    ...wrappingTextStyle,
                  }}
                >
                  Free stays usable for setup, manual tracking, and archive support. Starter adds richer applicant and day-to-day workflow tools.
                </div>
              ) : null}
              {plan === "pro" ? (
                <div
                  style={{
                    ...detailBoxStyle,
                    border: "1px solid rgba(37,99,235,0.28)",
                    background: "rgba(37,99,235,0.06)",
                  }}
                >
                  <div style={{ fontWeight: 800, lineHeight: 1.25, ...wrappingTextStyle }}>Built for stronger reporting</div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "1.1rem",
                      color: text.muted,
                      fontSize: 13,
                      lineHeight: 1.65,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <li style={{ paddingLeft: 2, overflowWrap: "anywhere" }}>CSV expense import</li>
                    <li style={{ paddingLeft: 2, overflowWrap: "anywhere" }}>CSV, spreadsheet, and PDF exports</li>
                    <li style={{ paddingLeft: 2, overflowWrap: "anywhere" }}>Compliance reports and screening review summaries</li>
                    <li style={{ paddingLeft: 2, overflowWrap: "anywhere" }}>Cleaner month-end and accountant handoff</li>
                  </ul>
                </div>
              ) : null}
              {plan !== "free" ? (
                <div
                  style={{
                    ...detailBoxStyle,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "rgba(248,250,252,0.92)",
                  }}
                >
                  {TIER_MATRIX_AREAS.slice(0, 4).map((area) => (
                    <div key={`${plan}-${area.key}`} style={{ color: text.muted, fontSize: 13, lineHeight: 1.65, ...wrappingTextStyle }}>
                      <strong style={{ color: text.secondary }}>{area.label}:</strong> {CANONICAL_TIER_MATRIX[plan].capabilities[area.key].summary}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={anchoredCtaStyle}>
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
