import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { useCapabilities } from "../../hooks/useCapabilities";
import { startCheckout } from "../../billing/startCheckout";

type PlanKey = "free" | "starter" | "pro" | "elite";

const PLAN_ORDER: PlanKey[] = ["free", "starter", "pro", "elite"];

const PLAN_LABEL: Record<PlanKey, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  elite: "Elite",
};

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: [
    "Unlimited properties and units",
    "Manual tenant and application entry",
    "Pay-per-screening access",
  ],
  starter: [
    "Tenant invites",
    "Applications",
    "Messaging",
    "Basic ledger",
  ],
  pro: [
    "Verified ledger",
    "Basic exports",
    "Compliance reports",
    "Portfolio dashboard",
    "Team tools",
  ],
  elite: [
    "AI summaries",
    "Advanced exports",
    "Audit logs",
    "Portfolio analytics",
  ],
};

const TABLE_ROWS: Array<{ feature: string; values: Record<PlanKey, string> }> = [
  {
    feature: "Properties + units",
    values: { free: "Unlimited", starter: "Unlimited", pro: "Unlimited", elite: "Unlimited" },
  },
  {
    feature: "Manual tenant/application entry",
    values: { free: "Included", starter: "Included", pro: "Included", elite: "Included" },
  },
  {
    feature: "Tenant invites",
    values: { free: "-", starter: "Included", pro: "Included", elite: "Included" },
  },
  {
    feature: "Messaging",
    values: { free: "-", starter: "Included", pro: "Included", elite: "Included" },
  },
  {
    feature: "Ledger",
    values: { free: "-", starter: "Basic", pro: "Verified", elite: "Verified + audit" },
  },
  {
    feature: "Exports",
    values: { free: "-", starter: "-", pro: "Basic", elite: "Advanced" },
  },
  {
    feature: "Portfolio insights",
    values: { free: "-", starter: "-", pro: "Dashboard", elite: "Analytics + AI" },
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
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);
  const isAuthed = Boolean(user?.id);

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
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.1 }}>Pricing</h1>
          <p style={{ marginTop: spacing.sm, color: text.primary, maxWidth: 860, fontWeight: 700, fontSize: "1.1rem" }}>
            Free to run your core rental workflow. Upgrade only when you need more workflow and intelligence.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 860 }}>
            Pay per screening - no credits, no bundles. Only pay when you screen.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted, maxWidth: 860 }}>
            Example: Consumer report $19.55 + optional score add-on $1. If no file returned, we&apos;ll apply the reduced/no-result price policy.
          </p>
        </div>

        <div className="rc-pricing-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {PLAN_ORDER.map((plan) => (
            <Card key={plan} style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{PLAN_LABEL[plan]}</div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
                {PLAN_FEATURES[plan].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div style={{ marginTop: spacing.sm }}>
                {plan === "free" ? (
                  <Button type="button" onClick={handleStartFree}>
                    Start Free
                  </Button>
                ) : (
                  <Button type="button" onClick={() => handleUpgrade(plan)}>
                    Upgrade
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h2 style={{ marginTop: 0, marginBottom: spacing.sm }}>Comparison</h2>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>Capability</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>Free</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>Starter</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>Pro</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.12)" }}>Elite</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)", fontWeight: 600 }}>{row.feature}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{row.values.free}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{row.values.starter}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{row.values.pro}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>{row.values.elite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>FAQ</h2>
          <details open style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Do I need a subscription to screen tenants?</summary>
            <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>
              No. Screening is pay-per-use.
            </p>
          </details>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default PricingPage;
