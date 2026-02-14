import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { fetchBillingPricing } from "../../api/billingApi";
import { startCheckout } from "../../billing/startCheckout";
import { RequestAccessModal } from "../../components/marketing/RequestAccessModal";
import { PlanIntervalToggle } from "../../components/billing/PlanIntervalToggle";
import { useLocale } from "../../i18n";
import { track } from "../../lib/analytics";

const FAQ_ITEMS = [
  {
    q: "How does tenant consent work?",
    a: "Tenants provide consent as part of the screening flow. Screening is tenant-initiated and clearly disclosed before purchase.",
  },
  {
    q: "Who pays for screening?",
    a: "Screening is pay-per-applicant. The applicant pays during checkout (or you can choose to reimburse outside the platform).",
  },
  {
    q: "What do I get with Professional?",
    a: "Professional includes screening access plus verified record-keeping and reporting tools built for landlord compliance.",
  },
  {
    q: "Is payment secure?",
    a: "Payments are processed securely through Stripe. RentChain does not store full card details.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can upgrade or change plans as your portfolio grows.",
  },
];

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthed = Boolean(user?.id);
  const { t } = useLocale();
  const [pricing, setPricing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingError, setPricingError] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  useEffect(() => {
    document.title = `${t("pricing.title")} — RentChain`;
  }, [t]);

  useEffect(() => {
    let active = true;
    fetchBillingPricing()
      .then((res) => {
        if (!active) return;
        if (!res) {
          setPricingError(true);
          return;
        }
        setPricing(res);
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn("[marketing/pricing] fetch failed", { message: err?.message || err });
        }
        setPricingError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const planMap = useMemo(() => {
    const map = new Map<string, any>();
    if (pricing?.plans) {
      pricing.plans.forEach((plan: any) => map.set(plan.key, plan));
    }
    return map;
  }, [pricing]);

  const renderPrice = (planKey: "starter" | "pro" | "business") => {
    const plan = planMap.get(planKey);
    if (!plan) return "—";
    if (plan.monthlyAmountCents === 0) return "Free";

    const amountCents = interval === "year" ? plan.yearlyAmountCents : plan.monthlyAmountCents;
    if (!amountCents) return "—";

    const suffix = interval === "year" ? "year" : "month";
    return `$${Math.round(amountCents / 100)} / ${suffix}`;
  };

  const readOrFallback = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const proPlus = readOrFallback("pricing.pro.plus", "Everything in Starter, plus:");
  const proItems = [
    readOrFallback("pricing.pro.item1", "Tenant screening access"),
    readOrFallback("pricing.pro.item2", "Ledger tools for audit-ready events"),
    readOrFallback("pricing.pro.item3", "Exports for reporting and audits"),
    readOrFallback("pricing.pro.item4", "Compliance-ready notices and timelines"),
  ];

  const pricingUnavailable = !loading && pricingError;

  const handlePlanAction = (planKey: "starter" | "pro" | "business") => {
    if (planKey === "starter") track("pricing_cta_starter_clicked", { interval, isAuthed });
    if (planKey === "pro") track("pricing_cta_pro_clicked", { interval, isAuthed });
    if (planKey === "business") track("pricing_cta_business_clicked", { interval, isAuthed });

    if (pricingUnavailable) return;
    if (planKey === "business" || !isAuthed) {
      setRequestOpen(true);
      return;
    }

    startCheckout({
      tier: planKey,
      interval,
      featureKey: "pricing",
      source: "marketing_pricing",
      redirectTo: "/billing",
    });
  };

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.1 }}>{t("pricing.title")}</h1>
          <p style={{ marginTop: spacing.sm, color: text.primary, maxWidth: 760, fontWeight: 700, fontSize: "1.15rem" }}>
            {t("pricing.headline")}
          </p>
          <p style={{ marginTop: spacing.sm, color: text.muted, maxWidth: 760 }}>{t("pricing.subline")}</p>

          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm }}>
            {isAuthed ? (
              <>
                <Button type="button" onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    track("pricing_cta_manage_billing_clicked", { interval, isAuthed });
                    navigate("/billing");
                  }}
                >
                  Manage billing
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => {
                    track("pricing_cta_start_screening_clicked", { interval, isAuthed });
                    setRequestOpen(true);
                  }}
                >
                  Start screening
                </Button>
                <Button type="button" variant="ghost" onClick={() => navigate("/login")}>Sign in</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    track("pricing_demo_clicked", { source: "pricing_hero" });
                    navigate("/site/screening-demo");
                  }}
                >
                  Try demo
                </Button>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: spacing.lg,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            alignItems: "stretch",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <PlanIntervalToggle value={interval} onChange={setInterval} />
          </div>

          {pricingUnavailable ? (
            <Card>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{t("pricing.banner.unavailable")}</div>
              <div style={{ color: text.muted, marginTop: spacing.xs }}>Please try again shortly.</div>
            </Card>
          ) : null}

          <Card>
            <h2 style={{ marginTop: 0 }}>{t("pricing.starter.title")}</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>{t("pricing.starter.subtitle")}</p>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>{t("pricing.starter.item1")}</li>
              <li>{t("pricing.starter.item2")}</li>
              <li>{t("pricing.starter.item3")}</li>
              <li>{t("pricing.starter.item4")}</li>
              <li>{t("pricing.starter.item5")}</li>
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{loading ? "—" : renderPrice("starter")}</div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("starter")} disabled={pricingUnavailable}>
                Get started
              </Button>
            </div>
          </Card>

          <Card
            style={{
              border: "1px solid rgba(15, 23, 42, 0.18)",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
              transform: "translateY(-2px)",
            }}
          >
            <div
              style={{
                display: "inline-block",
                background: "#0b1220",
                color: "#fff",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginBottom: spacing.sm,
              }}
            >
              Most Popular
            </div>

            <h2 style={{ marginTop: 0 }}>{t("pricing.pro.title")}</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>{t("pricing.pro.subtitle")}</p>
            <div style={{ color: text.muted, fontWeight: 600, marginTop: spacing.sm }}>{proPlus}</div>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              {proItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{loading ? "—" : renderPrice("pro")}</div>
            <div style={{ color: text.subtle, marginTop: spacing.xs }}>{t("pricing.pro.screening_note")}</div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("pro")} disabled={pricingUnavailable}>
                Start screening
              </Button>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>{t("pricing.business.title")}</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>{t("pricing.business.subtitle")}</p>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>{t("pricing.business.item1")}</li>
              <li>{t("pricing.business.item2")}</li>
              <li>{t("pricing.business.item3")}</li>
              <li>{t("pricing.business.item4")}</li>
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{loading ? "—" : renderPrice("business")}</div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("business")} disabled={pricingUnavailable}>
                Contact sales
              </Button>
            </div>
          </Card>
        </div>

        <Card>
          <div
            style={{
              display: "grid",
              gap: spacing.sm,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div style={{ fontWeight: 600, color: text.primary }}>Secure, encrypted data handling</div>
            <div style={{ fontWeight: 600, color: text.primary }}>Tenant-consented screening</div>
            <div style={{ fontWeight: 600, color: text.primary }}>Canadian-based platform</div>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Frequently asked questions</h2>
          {FAQ_ITEMS.map((item, index) => (
            <details
              key={item.q}
              open={faqOpen === index}
              onToggle={(event) => {
                if ((event.currentTarget as HTMLDetailsElement).open) {
                  setFaqOpen(index);
                } else if (faqOpen === index) {
                  setFaqOpen(null);
                }
              }}
              style={{
                border: "1px solid rgba(15, 23, 42, 0.12)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: spacing.sm,
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 700, color: text.primary }}>{item.q}</summary>
              <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>{item.a}</p>
            </details>
          ))}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Screening fees (pay-per-applicant)</h2>
          <p style={{ margin: 0, color: text.muted }}>{t("pricing.notice")}</p>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>{t("pricing.notice2")}</p>
        </Card>
      </div>

      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </MarketingLayout>
  );
};

export default PricingPage;
