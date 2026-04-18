import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { useCapabilities } from "../../hooks/useCapabilities";
import {
  CANONICAL_TIER_MATRIX,
  DEFAULT_PLANS,
  PLAN_ORDER,
  TIER_POSITIONING_COPY,
  type PricingInterval,
  type PricingPlanKey,
} from "../../constants/pricingPlans";
import { normalizePlan } from "../../lib/plan";
import { useLanguage } from "../../context/LanguageContext";
import { marketingCopy } from "../../content/marketingCopy";
import { track } from "../../lib/analytics";
import { fetchBillingPricing, type BillingPlanPricing } from "../../api/billingApi";

type PlanKey = PricingPlanKey;
const TIMELINE_MARKERS: Record<string, string> = {
  X: "❌",
  check: "✅",
};
const pricingCardMotionStyle: React.CSSProperties = {
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
  willChange: "transform, box-shadow",
};
const wrappingTextStyle: React.CSSProperties = {
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

function isAtOrAbove(plan: PlanKey, target: PlanKey) {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(target);
}

function displayFeatureValue(value: string) {
  return TIMELINE_MARKERS[value] || value;
}

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

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { caps } = useCapabilities();
  const { locale } = useLanguage();
  const copy = marketingCopy[locale];
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);
  const isAuthed = Boolean(user?.id);
  const [interval, setInterval] = React.useState<PricingInterval>("monthly");
  const [isMobile, setIsMobile] = React.useState(false);
  const [isCompactDesktop, setIsCompactDesktop] = React.useState(false);
  const [pricingByPlan, setPricingByPlan] = React.useState<Partial<Record<BillingPlanPricing["key"], BillingPlanPricing>>>({});
  const [hoveredPlan, setHoveredPlan] = React.useState<PlanKey | null>(null);
  const trackedInitialInterval = React.useRef(false);
  const safeTrack = (eventName: string, props: Record<string, unknown>) => {
    try {
      track(eventName, props);
    } catch {
      // telemetry must never interrupt UX
    }
  };
  const mobileSectionStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: isMobile ? 520 : "100%",
    margin: "0 auto",
    padding: 0,
    boxSizing: "border-box",
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
    const mobileLegacy = mobileMedia as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    const compactLegacy = compactDesktopMedia as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    if (typeof mobileLegacy.addEventListener === "function" && typeof compactLegacy.addEventListener === "function") {
      mobileLegacy.addEventListener("change", update);
      compactLegacy.addEventListener("change", update);
      return () => {
        mobileLegacy.removeEventListener("change", update);
        compactLegacy.removeEventListener("change", update);
      };
    }
    if (typeof mobileLegacy.addListener === "function") {
      mobileLegacy.addListener(update);
      compactLegacy.addListener?.(update);
      return () => {
        mobileLegacy.removeListener?.(update);
        compactLegacy.removeListener?.(update);
      };
    }
  }, []);

  React.useEffect(() => {
    safeTrack("pricing_page_viewed", {
      surface: "marketing_pricing",
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
      surface: "marketing_pricing",
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
    if (!plan) return "-";
    if (planKey === "free") {
      const value = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
      return value;
    }
    const billingPlan = pricingByPlan[planKey];
    if (billingPlan) {
      const amountCents =
        interval === "yearly" ? billingPlan.yearlyAmountCents : billingPlan.monthlyAmountCents;
      const value = `$${(amountCents / 100).toFixed(0)}`;
      return interval === "yearly"
        ? locale === "fr"
          ? `${value} / an`
          : `${value} / year`
        : locale === "fr"
        ? `${value} / mois`
        : `${value} / month`;
    }
    const value = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    return interval === "yearly"
      ? locale === "fr"
        ? `${value} / an`
        : `${value} / year`
      : locale === "fr"
        ? `${value} / mois`
        : `${value} / month`;
  };

  const handleStartFree = () => {
    navigate("/signup");
  };

  const handleUpgrade = (plan: Exclude<PlanKey, "free">) => {
    if (plan === "pro") {
      safeTrack("pricing_timeline_cta_clicked", { surface: "marketing" });
    }
    const action = !isAuthed
      ? "login_redirect"
      : isAtOrAbove(currentPlan, plan)
        ? "manage_existing_plan"
        : "open_billing_hub";
    safeTrack("pricing_plan_cta_clicked", {
      surface: "marketing_pricing",
      currentPlan,
      targetPlan: plan,
      interval,
      action,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    if (!isAuthed) {
      navigate("/login?next=/site/pricing");
      return;
    }
    if (isAtOrAbove(currentPlan, plan)) {
      navigate("/billing");
      return;
    }
    navigate(buildBillingUpgradePath(plan, interval));
  };

  const planCtaLabel = (plan: Exclude<PlanKey, "free">) => {
    if (!isAuthed) return `Sign in for ${copy.pricing.tierLabels[plan]}`;
    if (isAuthed && isAtOrAbove(currentPlan, plan)) return "Manage plan";
    return `Review ${copy.pricing.tierLabels[plan]} plan`;
  };

  const planCtaSupport = (plan: Exclude<PlanKey, "free">) => {
    if (!isAuthed) return "Sign in first, then review this plan in billing before checkout opens.";
    if (isAtOrAbove(currentPlan, plan)) return "Open billing to manage your current subscription details.";
    return `Billing will show the ${copy.pricing.tierLabels[plan]} plan details before secure checkout opens.`;
  };

  return (
    <MarketingLayout>
      <div
        style={{
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gap: isMobile ? spacing.md : "28px",
          overflow: "visible",
          padding: isMobile ? `0 ${spacing.md}px ${spacing.lg}px` : `${spacing.md} 32px calc(${spacing.lg} + 12px)`,
          boxSizing: "border-box",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.1 }}>
            {copy.pricing.headline}
          </h1>
          <p
            style={{
              marginTop: spacing.sm,
              color: text.muted,
              maxWidth: 860,
              fontWeight: 600,
              fontSize: "1.05rem",
            }}
          >
            {copy.pricing.subheadline}
          </p>
          <p style={{ margin: `${spacing.xs} 0 0`, color: text.muted, fontSize: "0.92rem" }}>
            Start on Free to try the basics, move to Starter for daily rental work, step up to Pro for stronger control, and use Elite for deeper portfolio oversight.
          </p>
          <p style={{ margin: `${spacing.xs} 0 0`, color: text.secondary, fontSize: "0.92rem", fontWeight: 600 }}>
            Starter gives you the workflow foundation, Pro adds operational control and reporting, and Elite adds portfolio intelligence and oversight.
          </p>
        </div>

        <div
          style={{
            background: "#f3f7ff",
            borderRadius: isMobile ? 20 : 24,
            padding: isMobile ? 12 : 20,
            boxSizing: "border-box",
            ...mobileSectionStyle,
          }}
        >
          <div
            className="rc-pricing-grid"
            style={{
              display: "grid",
              columnGap: isMobile ? 0 : "32px",
              rowGap: isMobile ? spacing.md : "24px",
              gridTemplateColumns: isMobile ? "1fr" : isCompactDesktop ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
              alignItems: "stretch",
            }}
          >
          <Card style={{ gridColumn: "1 / -1" }}>
            <div
              style={{
                display: "inline-flex",
                gap: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: 999,
                padding: 4,
              }}
            >
              <Button
                type="button"
                variant={interval === "monthly" ? "primary" : "ghost"}
                onClick={() => setInterval("monthly")}
                style={{ padding: "6px 12px" }}
              >
                {copy.pricing.intervalLabels.monthly}
              </Button>
              <Button
                type="button"
                variant={interval === "yearly" ? "primary" : "ghost"}
                onClick={() => setInterval("yearly")}
                style={{ padding: "6px 12px" }}
              >
                {copy.pricing.intervalLabels.yearly}
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
                width: "100%",
                minWidth: 0,
                minHeight: isMobile ? "unset" : 0,
                height: "100%",
                padding: isMobile ? 18 : 22,
                position: "relative",
                isolation: "isolate",
                overflow: "visible",
                zIndex: hoveredPlan === plan ? 2 : 1,
                transform: !isMobile && hoveredPlan === plan ? "translateY(-3px)" : "translateY(0)",
                border:
                  plan === "pro" ? "1px solid rgba(37,99,235,0.28)" : "1px solid rgba(15,23,42,0.08)",
                background:
                  plan === "pro"
                    ? "linear-gradient(180deg, rgba(37,99,235,0.06) 0%, #ffffff 28%)"
                    : "#ffffff",
                boxShadow: pricingCardShadow(plan, !isMobile && hoveredPlan === plan),
                justifySelf: "stretch",
                ...(plan === "pro"
                  ? {
                      padding: isMobile ? 18 : 24,
                    }
                  : null),
                ...pricingCardMotionStyle,
              }}
              onMouseEnter={() => !isMobile && setHoveredPlan(plan)}
              onMouseLeave={() => setHoveredPlan((current) => (current === plan ? null : current))}
              onFocus={() => setHoveredPlan(plan)}
              onBlur={() => setHoveredPlan((current) => (current === plan ? null : current))}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.15, ...wrappingTextStyle }}>
                  {copy.pricing.tierLabels[plan]}
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
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      color: plan === "pro" || plan === "elite" ? "#1d4ed8" : text.primary,
                      background:
                        plan === "pro" || plan === "elite"
                          ? "linear-gradient(180deg, rgba(37,99,235,0.14), rgba(37,99,235,0.08))"
                          : "rgba(15,23,42,0.06)",
                      ...wrappingTextStyle,
                    }}
                  >
                    {TIER_POSITIONING_COPY[plan].badge}
                  </span>
                ) : null}
              </div>
              <div style={{ color: text.muted, fontSize: "0.94rem", lineHeight: 1.65, minHeight: isMobile ? "auto" : 62, ...wrappingTextStyle }}>
                {plan === "free"
                  ? "For landlords getting started and wanting to try the basics with one property."
                  : TIER_POSITIONING_COPY[plan].audience}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05, ...wrappingTextStyle }}>{renderPrice(plan)}</div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.1rem",
                  color: text.muted,
                  lineHeight: 1.75,
                  display: "grid",
                  gap: 8,
                  minWidth: 0,
                  flex: "0 0 auto",
                }}
              >
                {CANONICAL_TIER_MATRIX[plan].features.map((feature) => (
                  <li key={`${plan}-${feature}`} style={{ fontSize: "0.92rem", ...wrappingTextStyle }}>
                    {feature}
                  </li>
                ))}
              </ul>
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
                  <div style={{ fontWeight: 700, color: text.primary, lineHeight: 1.25, ...wrappingTextStyle }}>
                    {PLAN_CALLOUT_COPY[plan]?.title || copy.pricing.timelineSection.title}
                  </div>
                  <div style={{ color: text.muted, fontSize: "0.89rem", lineHeight: 1.6, ...wrappingTextStyle }}>
                    {PLAN_CALLOUT_COPY[plan]?.description || copy.pricing.timelineSection.description}
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "1rem",
                      color: text.muted,
                      fontSize: "0.85rem",
                      lineHeight: 1.65,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    {(PLAN_CALLOUT_COPY[plan]?.bullets || copy.pricing.timelineSection.bullets).map((bullet) => (
                      <li key={`${plan}-${bullet}`} style={wrappingTextStyle}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  {PLAN_CALLOUT_COPY[plan]?.proofLine ? (
                    <div style={{ color: text.muted, fontSize: "0.82rem", lineHeight: 1.55, ...wrappingTextStyle }}>
                      {PLAN_CALLOUT_COPY[plan]?.proofLine}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {plan !== "free" ? (
                <div
                  style={{
                    color: text.muted,
                    fontSize: "0.89rem",
                    lineHeight: 1.65,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.03)",
                    border: "1px solid rgba(15,23,42,0.06)",
                    ...wrappingTextStyle,
                  }}
                >
                  {TIER_POSITIONING_COPY[plan].support}
                </div>
              ) : null}
              <div style={{ marginTop: isMobile ? spacing.sm : "auto", paddingTop: spacing.sm, width: "100%" }}>
                {plan === "free" ? (
                  <Button type="button" onClick={handleStartFree} style={{ width: "100%" }}>
                    {copy.pricing.ctaStartFree}
                  </Button>
                ) : (
                  <div style={{ display: "grid", gap: 8, width: "100%" }}>
                    <Button type="button" onClick={() => handleUpgrade(plan)} style={{ width: "100%" }}>
                      {planCtaLabel(plan)}
                    </Button>
                    <div style={{ color: text.muted, fontSize: "0.82rem", lineHeight: 1.55, ...wrappingTextStyle }}>
                      {planCtaSupport(plan)}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
          </div>
        </div>

        <div style={{ ...mobileSectionStyle, marginTop: spacing.lg }}>
          <Card style={{ padding: isMobile ? spacing.md : undefined }}>
            <h2 style={{ marginTop: 0, marginBottom: spacing.sm }}>{copy.pricing.comparisonTitle}</h2>
            {isMobile ? (
              <div style={{ display: "grid", gap: spacing.md }}>
                {PLAN_ORDER.map((plan) => (
                  <div
                    key={`mobile-compare-${plan}`}
                    style={{
                      border: "1px solid rgba(15,23,42,0.12)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: "1rem" }}>{copy.pricing.tierLabels[plan]}</div>
                    {copy.pricing.featureGroups.map((group) => (
                      <div key={`mobile-${plan}-${group.title}`} style={{ display: "grid", gap: 2 }}>
                        <div style={{ color: text.secondary, fontWeight: 600, fontSize: "0.86rem" }}>{group.title}</div>
                        <div style={{ color: text.muted, fontSize: "0.92rem" }}>{displayFeatureValue(group.items[plan])}</div>
                      </div>
                    ))}
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ color: text.secondary, fontWeight: 600, fontSize: "0.86rem" }}>
                        {copy.pricing.screeningRow.label}
                      </div>
                      <div style={{ color: text.muted, fontSize: "0.92rem" }}>
                        {copy.pricing.screeningRow.values[plan]} - {copy.pricing.screeningRow.subtext}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderBottom: "1px solid rgba(15,23,42,0.12)",
                        }}
                      >
                        {copy.pricing.capabilityTitle}
                      </th>
                      {PLAN_ORDER.map((plan) => (
                        <th
                          key={`heading-${plan}`}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderBottom: "1px solid rgba(15,23,42,0.12)",
                          }}
                        >
                          {copy.pricing.tierLabels[plan]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {copy.pricing.featureGroups.map((group) => (
                      <tr key={group.title}>
                        <td
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid rgba(15,23,42,0.08)",
                            fontWeight: 600,
                          }}
                        >
                          {group.title}
                        </td>
                        {PLAN_ORDER.map((plan) => (
                          <td
                            key={`${group.title}-${plan}`}
                            style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}
                          >
                            {displayFeatureValue(group.items[plan])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid rgba(15,23,42,0.08)",
                          fontWeight: 600,
                        }}
                      >
                        {copy.pricing.screeningRow.label}
                        <div style={{ color: text.muted, fontWeight: 400, fontSize: "0.85rem" }}>
                          {copy.pricing.screeningRow.subtext}
                        </div>
                      </td>
                      {PLAN_ORDER.map((plan) => (
                        <td
                          key={`screening-${plan}`}
                          style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}
                        >
                          {copy.pricing.screeningRow.values[plan]}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div style={{ ...mobileSectionStyle, marginTop: spacing.lg }}>
          <Card style={{ padding: isMobile ? spacing.md : undefined }}>
            <h2 style={{ marginTop: 0 }}>{copy.pricing.faqTitle}</h2>
            <details open style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>{copy.pricing.faqQuestion}</summary>
              <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>{copy.pricing.faqAnswer}</p>
            </details>
          </Card>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default PricingPage;
