import React from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";
import { useAuth } from "../context/useAuth";
import { useCapabilities } from "../hooks/useCapabilities";
import { createBillingPortalSession, fetchBillingPricing, type BillingPlanPricing } from "../api/billingApi";
import {
  CANONICAL_TIER_MATRIX,
  DEFAULT_PLANS,
  PLAN_ORDER,
  TIER_POSITIONING_COPY,
  TIER_MATRIX_AREAS,
  type PricingInterval,
  type PricingPlanKey,
} from "../constants/pricingPlans";
import { track } from "@/lib/analytics";
import { normalizePlan } from "@/lib/plan";

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

const PLAN_CALLOUT_COPY: Partial<
  Record<
    PlanKey,
    {
      title: string;
      description: string;
      bullets: string[];
      proofLine?: string;
    }
  >
> = {
  pro: {
    title: "Built for operational control",
    description:
      "Pro is designed for landlords and teams who need the day-to-day workflow to stay organized, reviewable, and easier to report on.",
    bullets: [
      "Keep exports and reporting ready for month-end and stakeholder reviews",
      "Make screening, compliance, and recordkeeping easier to follow through",
      "Give team workflows clearer structure as more people and properties get involved",
    ],
    proofLine:
      "Best when workflow volume is growing and you want cleaner operational control before moving into portfolio intelligence.",
  },
  elite: {
    title: "Built for insight-led oversight",
    description:
      "Elite is for portfolio operators who want more than operational control. It adds intelligence, deeper visibility, and portfolio-level context for decisions.",
    bullets: [
      "See portfolio trends and advanced analytics in one place",
      "Use AI summaries and audit visibility to review the bigger picture faster",
      "Support leadership and oversight decisions with stronger portfolio context",
    ],
    proofLine:
      "Best when the question is no longer just what happened, but what needs attention across the portfolio.",
  },
};

function pricingCardShadow(plan: PlanKey, hovered: boolean) {
  if (plan === "pro") {
    return hovered ? "0 22px 42px rgba(37,99,235,0.16)" : "0 16px 34px rgba(37,99,235,0.12)";
  }
  return hovered ? "0 16px 32px rgba(15,23,42,0.10)" : "0 10px 24px rgba(15,23,42,0.06)";
}

function buildBillingUpgradePath(target: Exclude<PlanKey, "free">, interval: PricingInterval) {
  const params = new URLSearchParams({
    upgradePlan: target,
    upgradeInterval: interval === "yearly" ? "year" : "month",
  });
  return `/billing?${params.toString()}`;
}

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { caps } = useCapabilities();
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);
  const [interval, setInterval] = React.useState<PricingInterval>("monthly");
  const [pricingByPlan, setPricingByPlan] = React.useState<Partial<Record<BillingPlanPricing["key"], BillingPlanPricing>>>({});
  const [hoveredPlan, setHoveredPlan] = React.useState<PlanKey | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isCompactDesktop, setIsCompactDesktop] = React.useState(false);
  const trackedInitialInterval = React.useRef(false);
  const safeTrack = (eventName: string, props: Record<string, unknown>) => {
    try {
      track(eventName, props);
    } catch {
      // telemetry must never interrupt UX
    }
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mobileMedia = window.matchMedia("(max-width: 767px)");
    const compactDesktopMedia = window.matchMedia("(max-width: 1279px)");
    const update = () => {
      setIsMobile(mobileMedia.matches);
      setIsCompactDesktop(!mobileMedia.matches && compactDesktopMedia.matches);
    };
    update();
    if (typeof mobileMedia.addEventListener === "function" && typeof compactDesktopMedia.addEventListener === "function") {
      mobileMedia.addEventListener("change", update);
      compactDesktopMedia.addEventListener("change", update);
      return () => {
        mobileMedia.removeEventListener("change", update);
        compactDesktopMedia.removeEventListener("change", update);
      };
    }
    mobileMedia.addListener?.(update);
    compactDesktopMedia.addListener?.(update);
    return () => {
      mobileMedia.removeListener?.(update);
      compactDesktopMedia.removeListener?.(update);
    };
  }, []);

  React.useEffect(() => {
    safeTrack("pricing_page_viewed", {
      surface: "workspace_pricing",
      currentPlan,
      interval,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!trackedInitialInterval.current) {
      trackedInitialInterval.current = true;
      return;
    }
    safeTrack("pricing_interval_changed", {
      surface: "workspace_pricing",
      currentPlan,
      interval,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [currentPlan, interval]);

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
    const action =
      PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(target)
        ? "manage_existing_plan"
        : "open_billing_hub";
    safeTrack("pricing_plan_cta_clicked", {
      surface: "workspace_pricing",
      currentPlan,
      targetPlan: target,
      interval,
      action,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
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

    navigate(buildBillingUpgradePath(target, interval));
  };

  const planCtaLabel = (target: Exclude<PlanKey, "free">) => {
    if (PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(target)) return "Manage plan";
    return `Review ${CANONICAL_TIER_MATRIX[target].label} plan`;
  };

  const planCtaSupport = (target: Exclude<PlanKey, "free">) => {
    if (PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(target)) {
      return "Open billing to manage your current subscription details.";
    }
    return `Billing will show the ${CANONICAL_TIER_MATRIX[target].label} plan details before secure checkout opens.`;
  };

  return (
    <MacShell title="RentChain · Pricing" showTopNav={false}>
      <Section
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          display: "grid",
          gap: spacing.lg,
          paddingTop: "calc(1rem + 16px)",
          paddingBottom: "calc(1rem + 16px)",
          paddingLeft: isMobile ? 24 : 32,
          paddingRight: isMobile ? 24 : 32,
          boxSizing: "border-box",
        }}
      >
        <Card elevated>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Pricing</h1>
          <p style={{ marginTop: spacing.sm, color: text.muted, maxWidth: 760, lineHeight: 1.65 }}>
            Start simple on Free, move into day-to-day rental operations on Starter, get stronger control on Pro, and step up to deeper portfolio oversight on Elite.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 760, lineHeight: 1.65 }}>
            Screening stays pay-per-use on every plan. Paid plans add better tools around the work landlords do every week: keeping records clean, staying organized, and seeing more as operations grow.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 760, lineHeight: 1.65 }}>
            Plan prices below match the live checkout pricing when billing is available.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.secondary, maxWidth: 760, lineHeight: 1.65, fontWeight: 600 }}>
            Starter gives you the workflow foundation, Pro adds operational control and reporting, and Elite adds portfolio intelligence and oversight.
          </p>
        </Card>

        <div
          style={{
            background: "#f3f7ff",
            borderRadius: isMobile ? 20 : 24,
            padding: isMobile ? 12 : 20,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : isCompactDesktop ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
              columnGap: isMobile ? 0 : "32px",
              rowGap: isMobile ? spacing.md : "24px",
              alignItems: "stretch",
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
                minHeight: isMobile ? "unset" : 0,
                height: "100%",
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
                justifySelf: "stretch",
                ...(plan === "pro"
                  ? {
                      padding: 22,
                    }
                  : null),
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
                {plan !== "free" ? (
                  <span
                    style={{
                      border:
                        plan === "pro" || plan === "elite"
                          ? "1px solid rgba(37,99,235,0.4)"
                          : "1px solid rgba(15,23,42,0.18)",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: plan === "pro" || plan === "elite" ? "#1d4ed8" : text.primary,
                      background:
                        plan === "pro" || plan === "elite"
                          ? "linear-gradient(180deg, rgba(37,99,235,0.14), rgba(37,99,235,0.08))"
                          : "rgba(15,23,42,0.06)",
                      maxWidth: "100%",
                      overflowWrap: "anywhere",
                      letterSpacing: 0.2,
                      boxShadow:
                        plan === "pro" || plan === "elite" ? "0 8px 20px rgba(37,99,235,0.12)" : "none",
                    }}
                  >
                    {TIER_POSITIONING_COPY[plan].badge}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, ...wrappingTextStyle }}>{renderPrice(plan)}</div>
              <div style={{ color: text.muted, fontSize: 14, lineHeight: 1.65, minHeight: 68, ...wrappingTextStyle }}>
                {plan === "free"
                  ? "For landlords getting started with one property and wanting to try the basics."
                  : TIER_POSITIONING_COPY[plan].audience}
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
              {plan !== "free" ? (
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
                  {TIER_POSITIONING_COPY[plan].support}
                </div>
              ) : null}
              {plan === "pro" || plan === "elite" ? (
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
                  <div style={{ fontWeight: 800, lineHeight: 1.25, ...wrappingTextStyle }}>
                    {PLAN_CALLOUT_COPY[plan]?.title}
                  </div>
                  <div style={{ color: text.muted, fontSize: 13, lineHeight: 1.6, ...wrappingTextStyle }}>
                    {PLAN_CALLOUT_COPY[plan]?.description}
                  </div>
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
                    {(PLAN_CALLOUT_COPY[plan]?.bullets || []).map((bullet) => (
                      <li key={`${plan}-${bullet}`} style={{ overflowWrap: "anywhere" }}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  {PLAN_CALLOUT_COPY[plan]?.proofLine ? (
                    <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.55, ...wrappingTextStyle }}>
                      {PLAN_CALLOUT_COPY[plan]?.proofLine}
                    </div>
                  ) : null}
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
              <div style={{ marginTop: isMobile ? spacing.sm : "auto", paddingTop: 8, width: "100%" }}>
                {plan === "free" ? (
                  <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")} style={{ width: "100%" }}>
                    Start Free
                  </Button>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    <Button type="button" onClick={() => void handleUpgrade(plan)} style={{ width: "100%" }}>
                      {planCtaLabel(plan)}
                    </Button>
                    <div style={{ color: text.muted, fontSize: 12, lineHeight: 1.55, ...wrappingTextStyle }}>
                      {planCtaSupport(plan)}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
          </div>
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>FAQ</h2>
          <details open style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              Do I need a subscription to screen tenants?
            </summary>
            <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>
              No. Screening is available as pay-per-use on every tier. Paid plans add the surrounding tools that make the rest of your rental work easier to manage.
            </p>
          </details>
        </Card>
      </Section>
    </MacShell>
  );
};

export default PricingPage;
