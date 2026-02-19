import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { useCapabilities } from "../../hooks/useCapabilities";
import { startCheckout } from "../../billing/startCheckout";
import { DEFAULT_PLANS, type PricingInterval, type PricingPlanKey } from "../../constants/pricingPlans";
import { useLanguage } from "../../context/LanguageContext";
import { marketingCopy } from "../../content/marketingCopy";

type PlanKey = PricingPlanKey;

const PLAN_ORDER: PlanKey[] = ["free", "starter", "pro", "elite"];

function normalizePlan(input?: string | null): PlanKey {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "elite" || raw === "business" || raw === "enterprise") return "elite";
  return "free";
}

function isAtOrAbove(plan: PlanKey, target: PlanKey) {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(target);
}

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { caps } = useCapabilities();
  const { locale } = useLanguage();
  const copy = marketingCopy[locale];
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);
  const isAuthed = Boolean(user?.id);
  const [interval, setInterval] = React.useState<PricingInterval>("monthly");

  const renderPrice = (planKey: PlanKey) => {
    const plan = DEFAULT_PLANS.find((item) => item.key === planKey);
    if (!plan) return "-";
    const value = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    if (planKey === "free") return value;
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
    if (!isAuthed) {
      navigate("/login?next=/site/pricing");
      return;
    }
    if (isAtOrAbove(currentPlan, plan)) {
      navigate("/billing");
      return;
    }
    void startCheckout({
      tier: plan === "elite" ? "business" : plan,
      interval: "monthly",
      featureKey: "pricing",
      source: "marketing_pricing",
      redirectTo: "/billing",
    });
  };

  return (
    <MarketingLayout>
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto", display: "grid", gap: spacing.lg }}>
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
        </div>

        <div className="rc-pricing-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
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
            <Card key={plan} style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.xs, flexWrap: "wrap" }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{copy.pricing.tierLabels[plan]}</div>
                {copy.pricing.tierBadges[plan] ? (
                  <span
                    style={{
                      border: "1px solid rgba(15,23,42,0.18)",
                      borderRadius: 999,
                      padding: "2px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: text.primary,
                      background: "rgba(15,23,42,0.06)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copy.pricing.tierBadges[plan]}
                  </span>
                ) : null}
              </div>
              <div style={{ color: text.muted, fontSize: "0.92rem", minHeight: 40 }}>
                {copy.pricing.tierTaglines[plan]}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{renderPrice(plan)}</div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
                {copy.pricing.featureGroups.map((group) => (
                  <li key={`${plan}-${group.title}`}>
                    <span style={{ color: text.secondary, fontWeight: 600 }}>{group.title}:</span>{" "}
                    {group.items[plan]}
                  </li>
                ))}
                <li>
                  {copy.pricing.screeningRow.label}: {copy.pricing.screeningRow.subtext}
                </li>
              </ul>
              <div style={{ marginTop: spacing.sm }}>
                {plan === "free" ? (
                  <Button type="button" onClick={handleStartFree}>
                    {copy.pricing.ctaStartFree}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => handleUpgrade(plan)}>
                    {copy.pricing.ctaUpgrade}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h2 style={{ marginTop: 0, marginBottom: spacing.sm }}>{copy.pricing.comparisonTitle}</h2>
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
                        {group.items[plan]}
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
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{copy.pricing.faqTitle}</h2>
          <details open style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{copy.pricing.faqQuestion}</summary>
            <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>{copy.pricing.faqAnswer}</p>
          </details>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default PricingPage;
