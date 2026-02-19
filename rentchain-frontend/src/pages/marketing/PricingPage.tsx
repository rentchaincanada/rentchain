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

type PlanKey = PricingPlanKey;

const PLAN_ORDER: PlanKey[] = ["free", "starter", "pro", "elite"];

const PLAN_FEATURE_KEYS: Record<PlanKey, string[]> = {
  free: [
    "marketing.pricing.feature.unlimited_properties_units",
    "marketing.pricing.feature.manual_tenant_application_entry",
    "marketing.pricing.feature.pay_per_screening_access",
  ],
  starter: [
    "marketing.pricing.feature.tenant_invites",
    "marketing.pricing.feature.applications",
    "marketing.pricing.feature.messaging",
    "marketing.pricing.feature.basic_ledger",
  ],
  pro: [
    "marketing.pricing.feature.verified_ledger",
    "marketing.pricing.feature.basic_exports",
    "marketing.pricing.feature.compliance_reports",
    "marketing.pricing.feature.portfolio_dashboard",
    "marketing.pricing.feature.team_tools",
  ],
  elite: [
    "marketing.pricing.feature.ai_summaries",
    "marketing.pricing.feature.advanced_exports",
    "marketing.pricing.feature.audit_logs",
    "marketing.pricing.feature.portfolio_analytics",
  ],
};

const TABLE_ROWS: Array<{ featureKey: string; values: Record<PlanKey, string> }> = [
  {
    featureKey: "marketing.pricing.table.properties_units.feature",
    values: {
      free: "marketing.pricing.table.properties_units.free",
      starter: "marketing.pricing.table.properties_units.starter",
      pro: "marketing.pricing.table.properties_units.pro",
      elite: "marketing.pricing.table.properties_units.elite",
    },
  },
  {
    featureKey: "marketing.pricing.table.manual_entry.feature",
    values: {
      free: "marketing.pricing.table.manual_entry.free",
      starter: "marketing.pricing.table.manual_entry.starter",
      pro: "marketing.pricing.table.manual_entry.pro",
      elite: "marketing.pricing.table.manual_entry.elite",
    },
  },
  {
    featureKey: "marketing.pricing.table.tenant_invites.feature",
    values: {
      free: "marketing.pricing.table.tenant_invites.free",
      starter: "marketing.pricing.table.tenant_invites.starter",
      pro: "marketing.pricing.table.tenant_invites.pro",
      elite: "marketing.pricing.table.tenant_invites.elite",
    },
  },
  {
    featureKey: "marketing.pricing.table.messaging.feature",
    values: {
      free: "marketing.pricing.table.messaging.free",
      starter: "marketing.pricing.table.messaging.starter",
      pro: "marketing.pricing.table.messaging.pro",
      elite: "marketing.pricing.table.messaging.elite",
    },
  },
  {
    featureKey: "marketing.pricing.table.ledger.feature",
    values: {
      free: "marketing.pricing.table.ledger.free",
      starter: "marketing.pricing.table.ledger.starter",
      pro: "marketing.pricing.table.ledger.pro",
      elite: "marketing.pricing.table.ledger.elite",
    },
  },
  {
    featureKey: "marketing.pricing.table.exports.feature",
    values: {
      free: "marketing.pricing.table.exports.free",
      starter: "marketing.pricing.table.exports.starter",
      pro: "marketing.pricing.table.exports.pro",
      elite: "marketing.pricing.table.exports.elite",
    },
  },
  {
    featureKey: "marketing.pricing.table.insights.feature",
    values: {
      free: "marketing.pricing.table.insights.free",
      starter: "marketing.pricing.table.insights.starter",
      pro: "marketing.pricing.table.insights.pro",
      elite: "marketing.pricing.table.insights.elite",
    },
  },
];

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
  const { t } = useLanguage();
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);
  const isAuthed = Boolean(user?.id);
  const [interval, setInterval] = React.useState<PricingInterval>("monthly");

  const renderPrice = (planKey: PlanKey) => {
    const plan = DEFAULT_PLANS.find((item) => item.key === planKey);
    if (!plan) return t("marketing.pricing.price_unavailable");
    const value = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    if (planKey === "free") return value;
    return interval === "yearly"
      ? `${value} ${t("marketing.pricing.price_suffix.year")}`
      : `${value} ${t("marketing.pricing.price_suffix.month")}`;
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
            {t("marketing.pricing.title")}
          </h1>
          <p style={{ marginTop: spacing.sm, color: text.primary, maxWidth: 860, fontWeight: 700, fontSize: "1.1rem" }}>
            {t("marketing.pricing.headline")}
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 860 }}>
            {t("marketing.pricing.subhead1")}
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 860 }}>
            {t("marketing.pricing.subhead2")}
          </p>
        </div>

        <div className="rc-pricing-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          <Card style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "inline-flex", gap: 8, border: "1px solid rgba(15,23,42,0.12)", borderRadius: 999, padding: 4 }}>
              <Button
                type="button"
                variant={interval === "monthly" ? "primary" : "ghost"}
                onClick={() => setInterval("monthly")}
                style={{ padding: "6px 12px" }}
              >
                {t("marketing.pricing.interval.monthly")}
              </Button>
              <Button
                type="button"
                variant={interval === "yearly" ? "primary" : "ghost"}
                onClick={() => setInterval("yearly")}
                style={{ padding: "6px 12px" }}
              >
                {t("marketing.pricing.interval.yearly")}
              </Button>
            </div>
          </Card>
          {PLAN_ORDER.map((plan) => (
            <Card key={plan} style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{t(`marketing.pricing.plan.${plan}`)}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{renderPrice(plan)}</div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
                {PLAN_FEATURE_KEYS[plan].map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
              <div style={{ marginTop: spacing.sm }}>
                {plan === "free" ? (
                  <Button type="button" onClick={handleStartFree}>
                    {t("marketing.pricing.cta.start_free")}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => handleUpgrade(plan)}>
                    {t("marketing.pricing.cta.upgrade")}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h2 style={{ marginTop: 0, marginBottom: spacing.sm }}>{t("marketing.pricing.comparison.title")}</h2>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>
                    {t("marketing.pricing.comparison.capability")}
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>
                    {t("marketing.pricing.plan.free")}
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>
                    {t("marketing.pricing.plan.starter")}
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>
                    {t("marketing.pricing.plan.pro")}
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>
                    {t("marketing.pricing.plan.elite")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row) => (
                  <tr key={row.featureKey}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)", fontWeight: 600 }}>
                      {t(row.featureKey)}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{t(row.values.free)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{t(row.values.starter)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{t(row.values.pro)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{t(row.values.elite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("marketing.pricing.faq.title")}</h2>
          <details open style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{t("marketing.pricing.faq.subscription_required.q")}</summary>
            <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>
              {t("marketing.pricing.faq.subscription_required.a")}
            </p>
          </details>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default PricingPage;
