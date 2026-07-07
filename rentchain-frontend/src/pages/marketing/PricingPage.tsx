import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchBillingPricing, type BillingPlanPricing } from "../../api/billingApi";
import { saveRegistryAcquisitionAttribution } from "../../api/propertiesApi";
import {
  CANONICAL_TIER_MATRIX,
  DEFAULT_PLANS,
  type PricingInterval,
  type PricingPlanKey,
} from "../../constants/pricingPlans";
import { useAuth } from "../../context/useAuth";
import { track } from "../../lib/analytics";
import { normalizePlan } from "../../lib/plan";
import { MarketingFooter, MarketingHeader } from "./landing/LandingSections";
import { landingPageCss } from "./landing/landingPageCss";
import { pricingPageCss } from "./pricingPageCss";

type PlanKey = PricingPlanKey;

type PublicPlan = {
  key: PlanKey;
  eyebrow: string;
  title: string;
  summary: string;
  bestFor: string;
  included: string[];
  ctaKind: "start" | "upgrade" | "contact";
  highlighted?: boolean;
};

type UpgradeArea = {
  title: string;
  free: string;
  paid: string;
};

const publicPlans: PublicPlan[] = [
  {
    key: "free",
    eyebrow: "Start here",
    title: "Free / Starter",
    summary:
      "Set up your first property, organize the basics, and understand the workflow before committing to a paid plan.",
    bestFor: "Trying RentChain with a simple first property workflow.",
    included: [
      "First property setup",
      "Basic tenant and property organization",
      "Core workflow preview",
      "Pay-per-use screening path when available",
    ],
    ctaKind: "start",
  },
  {
    key: "starter",
    eyebrow: "Daily operations",
    title: "Landlord / Operator",
    summary:
      "Coordinate the day-to-day rental workflow when applications, leases, messages, maintenance, and records need more structure.",
    bestFor: "Independent landlords and small operators managing active rentals.",
    included: [
      "Applicant, lease, and tenant workflow support",
      "Maintenance and work order coordination",
      "Operational inbox and message context",
      "Stronger rent and document readiness",
    ],
    ctaKind: "upgrade",
    highlighted: true,
  },
  {
    key: "pro",
    eyebrow: "Portfolio oversight",
    title: "Property Manager / Portfolio",
    summary:
      "Add stronger records, exports, reporting, and coordination for multi-property or team-based workflows.",
    bestFor: "Growing portfolios that need clearer handoffs and evidence workflows.",
    included: [
      "Portfolio-level oversight",
      "Team and delegated workflow coordination where available",
      "Stronger records and evidence workflows",
      "Exports and review-ready summaries",
    ],
    ctaKind: "upgrade",
  },
  {
    key: "elite",
    eyebrow: "Larger operations",
    title: "Enterprise / Institutional",
    summary:
      "Use RentChain with more support for larger housing operations, governance needs, and custom onboarding conversations.",
    bestFor: "Operators with governance, reporting, or institutional readiness needs.",
    included: [
      "Custom onboarding conversation",
      "Governance and reporting needs review",
      "Portfolio visibility and advanced oversight",
      "Support for stronger records and exports",
    ],
    ctaKind: "contact",
  },
];

const upgradeAreas: UpgradeArea[] = [
  {
    title: "Organization",
    free: "Start with property and tenant basics.",
    paid: "Add stronger operating structure as work grows.",
  },
  {
    title: "Maintenance coordination",
    free: "Preview the operational record.",
    paid: "Coordinate maintenance and work orders in the workflow.",
  },
  {
    title: "Records and evidence",
    free: "Keep basic history organized.",
    paid: "Use stronger records, summaries, and export paths.",
  },
  {
    title: "Team and portfolio visibility",
    free: "Understand a first-property flow.",
    paid: "Support larger portfolios and delegated coordination where available.",
  },
  {
    title: "Support and onboarding",
    free: "Self-serve setup.",
    paid: "Access deeper workflow and onboarding support as needed.",
  },
];

const pricingHeaderNav = [
  { label: "Home", href: "/site" },
  { label: "Pricing", href: "/site/pricing" },
  { label: "Request access", href: "/site/request-access" },
];

function firstQueryValue(search: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = search.get(key);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function formatPlanPrice(planKey: PlanKey, interval: PricingInterval, livePricing?: BillingPlanPricing) {
  if (planKey === "free") return "$0";
  if (livePricing) {
    const amountCents =
      interval === "yearly" ? livePricing.yearlyAmountCents : livePricing.monthlyAmountCents;
    const amount = `$${(amountCents / 100).toFixed(0)}`;
    return interval === "yearly" ? `${amount} / year` : `${amount} / month`;
  }
  const plan = DEFAULT_PLANS.find((item) => item.key === planKey);
  if (!plan) return "Pricing available in product";
  return interval === "yearly" ? `${plan.yearlyPrice} / year` : `${plan.monthlyPrice} / month`;
}

function trackSafely(eventName: string, props: Record<string, unknown>) {
  try {
    track(eventName, props);
  } catch {
    // Analytics must never interrupt public pricing.
  }
}

function ensureMarketingFonts() {
  if (typeof document === "undefined" || document.getElementById("rentchain-marketing-fonts")) {
    return;
  }

  const link = document.createElement("link");
  link.id = "rentchain-marketing-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&family=Source+Serif+4:wght@600;700&display=swap";
  document.head.appendChild(link);
}

function buildBillingUpgradePath(target: Exclude<PlanKey, "free">, interval: PricingInterval) {
  const params = new URLSearchParams({
    upgradePlan: target,
    upgradeInterval: interval === "yearly" ? "year" : "month",
  });
  return `/billing?${params.toString()}`;
}

function isPaidPlan(plan: PlanKey): plan is Exclude<PlanKey, "free"> {
  return plan !== "free";
}

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentPlan = normalizePlan(user?.plan || null);
  const isAuthed = Boolean(user?.id);
  const [interval, setInterval] = useState<PricingInterval>("monthly");
  const [pricingByPlan, setPricingByPlan] = useState<
    Partial<Record<BillingPlanPricing["key"], BillingPlanPricing>>
  >({});
  const trackedInitialInterval = useRef(false);

  const acquisition = useMemo(() => {
    const search = new URLSearchParams(location.search);
    return {
      source: firstQueryValue(search, "utm_source", "source"),
      medium: firstQueryValue(search, "utm_medium", "medium"),
      campaign: firstQueryValue(search, "utm_campaign", "campaign"),
      variant: firstQueryValue(search, "utm_content", "variant"),
    };
  }, [location.search]);

  useEffect(() => {
    document.title = "Pricing - RentChain";
    ensureMarketingFonts();
  }, []);

  useEffect(() => {
    trackSafely("pricing_page_viewed", {
      surface: "marketing_pricing",
      currentPlan,
      interval,
      route: location.pathname,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!trackedInitialInterval.current) {
      trackedInitialInterval.current = true;
      return;
    }
    trackSafely("pricing_interval_changed", {
      surface: "marketing_pricing",
      currentPlan,
      interval,
      route: location.pathname,
    });
  }, [currentPlan, interval, location.pathname]);

  useEffect(() => {
    if (!isAuthed) {
      setPricingByPlan({});
      return;
    }
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
  }, [isAuthed]);

  const handleStartFree = (locationName = "pricing") => {
    saveRegistryAcquisitionAttribution({
      ...acquisition,
      landingPath: `${location.pathname}${location.search}`,
    });

    trackSafely("registry_landing_cta_clicked", {
      source: acquisition.source,
      medium: acquisition.medium,
      campaign: acquisition.campaign,
      variant: acquisition.variant,
      location: locationName,
    });

    if (user?.id) {
      navigate("/properties?intent=registry_readiness");
      return;
    }

    navigate("/signup?next=/properties&intent=registry_readiness");
  };

  const handlePlanAction = (plan: PublicPlan) => {
    if (plan.ctaKind === "start") {
      handleStartFree("pricing_plan_free");
      return;
    }
    if (plan.ctaKind === "contact") {
      trackSafely("pricing_enterprise_cta_clicked", {
        surface: "marketing_pricing",
        currentPlan,
        interval,
        route: location.pathname,
      });
      navigate("/site/request-access");
      return;
    }
    if (!isPaidPlan(plan.key)) return;

    const action = isAuthed ? "open_billing_hub" : "signup_redirect";
    trackSafely("pricing_plan_cta_clicked", {
      surface: "marketing_pricing",
      currentPlan,
      targetPlan: plan.key,
      interval,
      action,
      route: location.pathname,
    });

    if (!isAuthed) {
      handleStartFree(`pricing_plan_${plan.key}`);
      return;
    }

    navigate(buildBillingUpgradePath(plan.key, interval));
  };

  const planCtaLabel = (plan: PublicPlan) => {
    if (plan.ctaKind === "contact") return "Request access";
    if (plan.ctaKind === "start") return "Start free";
    if (!isAuthed) return "Start free first";
    return `Review ${CANONICAL_TIER_MATRIX[plan.key].label} in billing`;
  };

  return (
    <div className="rc-landing rc-pricing-page">
      <style>{`${landingPageCss}\n${pricingPageCss}`}</style>
      <MarketingHeader onPrimaryCta={() => handleStartFree("pricing_header")} navItems={pricingHeaderNav} />
      <main>
        <section className="rc-pricing-hero" aria-labelledby="pricing-hero-title">
          <div className="rc-container rc-pricing-hero__inner">
            <div>
              <p className="rc-kicker">Pricing</p>
              <h1 id="pricing-hero-title">
                Start free. Grow when your rental operations need more support.
              </h1>
              <p className="rc-pricing-hero__body">
                Set up your first property, understand the workflow, and decide whether paid tools
                are worth it once you see the value in practice.
              </p>
              <div className="rc-cta-row">
                <button type="button" className="rc-button rc-button--accent" onClick={() => handleStartFree("pricing_hero")}>
                  Start free
                </button>
                <Link className="rc-link-button rc-link-button--ghost" to="/site/request-access">
                  Request access
                </Link>
              </div>
            </div>
            <aside className="rc-pricing-hero__note" aria-label="Pricing note">
              <span>Start simple</span>
              <strong>No pressure to choose a paid plan before the workflow is clear.</strong>
              <p>
                Paid plans add deeper operational tools, portfolio oversight, and stronger records
                as your rental work becomes more complex.
              </p>
            </aside>
          </div>
        </section>

        <section className="rc-section" aria-labelledby="pricing-plans-title">
          <div className="rc-container">
            <div className="rc-section-heading">
              <p className="rc-kicker">Plan fit</p>
              <h2 className="rc-section-title" id="pricing-plans-title">
                Choose the support level that matches the workflow.
              </h2>
              <p className="rc-section-subtitle">
                Pricing below follows the current product plan structure. Live checkout pricing is
                used when available.
              </p>
            </div>

            <div className="rc-pricing-interval" role="group" aria-label="Billing interval">
              <button
                type="button"
                className={interval === "monthly" ? "is-active" : ""}
                aria-pressed={interval === "monthly"}
                onClick={() => setInterval("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={interval === "yearly" ? "is-active" : ""}
                aria-pressed={interval === "yearly"}
                onClick={() => setInterval("yearly")}
              >
                Annual
              </button>
            </div>

            <div className="rc-pricing-plan-grid">
              {publicPlans.map((plan) => (
                <article
                  key={plan.key}
                  className={`rc-pricing-plan ${plan.highlighted ? "is-highlighted" : ""}`}
                >
                  <div>
                    <p className="rc-pricing-plan__eyebrow">{plan.eyebrow}</p>
                    <h3>{plan.title}</h3>
                    <p>{plan.summary}</p>
                  </div>
                  <div className="rc-pricing-plan__price">
                    <strong>{formatPlanPrice(plan.key, interval, pricingByPlan[plan.key])}</strong>
                    <span>{plan.key === "free" ? "No subscription required" : "Billed through the product when selected"}</span>
                  </div>
                  <div className="rc-pricing-plan__fit">
                    <span>Best for</span>
                    <strong>{plan.bestFor}</strong>
                  </div>
                  <ul>
                    {plan.included.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`rc-button ${
                      plan.highlighted ? "rc-button--primary" : plan.ctaKind === "contact" ? "rc-button--ghost" : "rc-button--accent"
                    }`}
                    onClick={() => handlePlanAction(plan)}
                  >
                    {planCtaLabel(plan)}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rc-section rc-section--band" aria-labelledby="pricing-upgrade-title">
          <div className="rc-container">
            <div className="rc-section-heading">
              <p className="rc-kicker">What changes when you upgrade</p>
              <h2 className="rc-section-title" id="pricing-upgrade-title">
                Upgrade when the workflow needs more support.
              </h2>
            </div>
            <div className="rc-pricing-upgrade-grid">
              {upgradeAreas.map((area) => (
                <article className="rc-card rc-pricing-upgrade-card" key={area.title}>
                  <h3>{area.title}</h3>
                  <dl>
                    <div>
                      <dt>Free</dt>
                      <dd>{area.free}</dd>
                    </div>
                    <div>
                      <dt>Paid plans</dt>
                      <dd>{area.paid}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rc-section" aria-labelledby="pricing-trust-title">
          <div className="rc-container rc-pricing-trust">
            <div>
              <p className="rc-kicker">Billing honesty</p>
              <h2 className="rc-section-title" id="pricing-trust-title">
                Clear starting point. Conservative promises.
              </h2>
            </div>
            <div className="rc-pricing-trust__cards">
              <article className="rc-card">
                <h3>No pressure to start</h3>
                <p>Use the free path to understand the workflow before deciding whether a paid plan is useful.</p>
              </article>
              <article className="rc-card">
                <h3>Availability can vary</h3>
                <p>
                  Region-specific tools may vary by province. Screening, payment, EFT, and legal
                  workflows may depend on provider availability and local requirements.
                </p>
              </article>
              <article className="rc-card">
                <h3>Records over promises</h3>
                <p>
                  RentChain supports clearer operating records and review workflows without
                  guaranteeing legal, screening, revenue, or dispute outcomes.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="rc-section" aria-labelledby="pricing-final-title">
          <div className="rc-container">
            <div className="rc-final-cta">
              <p className="rc-kicker">Ready when you are</p>
              <h2 className="rc-section-title" id="pricing-final-title">
                Start free, then grow only when the workflow needs it.
              </h2>
              <p className="rc-section-subtitle">
                Begin with the first property workflow or request access for a larger operating context.
              </p>
              <div className="rc-cta-row">
                <button type="button" className="rc-button rc-button--accent" onClick={() => handleStartFree("pricing_final")}>
                  Start free
                </button>
                <Link className="rc-link-button rc-link-button--dark" to="/site/request-access">
                  Request access
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
};

export default PricingPage;
