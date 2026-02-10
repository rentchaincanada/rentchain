import React, { useEffect, useMemo, useState } from "react";
import { Card, Button } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { fetchBillingPricing } from "../../api/billingApi";
import { startCheckout } from "../../billing/startCheckout";
import { RequestAccessModal } from "../../components/marketing/RequestAccessModal";
import { PlanIntervalToggle } from "../../components/billing/PlanIntervalToggle";
import { useLocale } from "../../i18n";

const PricingPage: React.FC = () => {
  const { user } = useAuth();
  const isAuthed = Boolean(user?.id);
  const { t } = useLocale();
  const [pricing, setPricing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingError, setPricingError] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [interval, setInterval] = useState<"month" | "year">("month");

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
    const amountCents =
      interval === "year" ? plan.yearlyAmountCents : plan.monthlyAmountCents;
    if (!amountCents) return "—";
    const suffix = interval === "year" ? "year" : "month";
    return `$${Math.round(amountCents / 100)} / ${suffix}`;
  };

  const pricingUnavailable = !loading && pricingError;

  const handlePlanAction = (planKey: "starter" | "pro" | "business") => {
    if (pricingUnavailable) return;
    if (!isAuthed) {
      window.location.href = "/login";
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
          <h1 style={{ margin: 0 }}>Pricing</h1>
          <p style={{ marginTop: spacing.sm, color: text.muted, maxWidth: 760 }}>
            {t("pricing.headline")}
          </p>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>
            {t("pricing.subline")}
          </p>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm }}>
            {isAuthed ? (
              <Button type="button" onClick={() => (window.location.href = "/dashboard")}>
                {t("pricing.go_dashboard")}
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={() => setRequestOpen(true)}>
                  {t("pricing.request_access")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => (window.location.href = "/login")}>
                  {t("pricing.sign_in")}
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
              <div style={{ color: text.muted, marginTop: spacing.xs }}>
                Please try again shortly.
              </div>
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
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {loading ? "—" : renderPrice("starter")}
            </div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("starter")} disabled={pricingUnavailable}>
                {isAuthed ? t("pricing.choose_plan") : t("pricing.get_started")}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>{t("pricing.pro.title")}</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>{t("pricing.pro.subtitle")}</p>
            <div style={{ color: text.muted, fontWeight: 600, marginTop: spacing.sm }}>{t("pricing.pro.plus")}</div>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>{t("pricing.pro.item1")}</li>
              <li>{t("pricing.pro.item2")}</li>
              <li>{t("pricing.pro.item3")}</li>
              <li>{t("pricing.pro.item4")}</li>
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {loading ? "—" : renderPrice("pro")}
            </div>
            <div style={{ color: text.subtle, marginTop: spacing.xs }}>{t("pricing.pro.screening_note")}</div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("pro")} disabled={pricingUnavailable}>
                {isAuthed ? t("pricing.choose_plan") : t("pricing.get_started")}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>{t("pricing.business.title")}</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>
              {t("pricing.business.subtitle")}
            </p>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>{t("pricing.business.item1")}</li>
              <li>{t("pricing.business.item2")}</li>
              <li>{t("pricing.business.item3")}</li>
              <li>{t("pricing.business.item4")}</li>
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {loading ? "—" : renderPrice("business")}
            </div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("business")} disabled={pricingUnavailable}>
                {isAuthed ? t("pricing.choose_plan") : t("pricing.get_started")}
              </Button>
            </div>
          </Card>
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("pricing.screening_fees")}</h2>
          <p style={{ margin: 0, color: text.muted }}>
            {t("pricing.notice")}
          </p>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>
            {t("pricing.notice2")}
          </p>
        </Card>
      </div>
      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </MarketingLayout>
  );
};

export default PricingPage;
