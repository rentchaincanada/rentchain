import React from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";
import { useAuth } from "../context/useAuth";
import { useCapabilities } from "../hooks/useCapabilities";
import { startCheckout } from "../billing/startCheckout";
import { createBillingPortalSession } from "../api/billingApi";

type PlanKey = "free" | "starter" | "pro" | "elite";

const PLAN_ORDER: PlanKey[] = ["free", "starter", "pro", "elite"];

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: [
    "Unlimited properties and units",
    "Manual tenant and application entry",
    "Pay-per-screening access",
  ],
  starter: ["Tenant invites", "Applications", "Messaging", "Basic ledger"],
  pro: ["Verified ledger", "Basic exports", "Compliance reports", "Portfolio dashboard", "Team tools"],
  elite: ["AI summaries", "Advanced exports", "Audit logs", "Portfolio analytics"],
};

function normalizePlan(input?: string | null): PlanKey {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "elite" || raw === "business" || raw === "enterprise") return "elite";
  return "free";
}

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { caps } = useCapabilities();
  const currentPlan = normalizePlan((caps?.plan as string) || user?.plan || null);

  const handleUpgrade = async (target: Exclude<PlanKey, "free">) => {
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
      tier: target === "elite" ? "business" : target,
      interval: "monthly",
      featureKey: "pricing",
      source: "workspace_pricing",
      redirectTo: "/billing",
    });
  };

  return (
    <MacShell title="RentChain · Pricing">
      <Section style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: spacing.md }}>
        <Card elevated>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Pricing</h1>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>
            Free includes unlimited properties and units. Upgrades unlock more workflow and intelligence.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted }}>
            Pay per screening - no credits, no bundles. Only pay when you screen.
          </p>
          <p style={{ marginTop: spacing.xs, color: text.muted }}>
            Example: Consumer report $19.55 + optional score add-on $1. If no file returned, we&apos;ll apply the reduced/no-result price policy.
          </p>
        </Card>

        <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {PLAN_ORDER.map((plan) => (
            <Card key={plan} style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontWeight: 800, fontSize: 18, textTransform: "capitalize" }}>{plan}</div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
                {PLAN_FEATURES[plan].map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <div>
                {plan === "free" ? (
                  <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")}>
                    Start Free
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void handleUpgrade(plan)}>
                    Upgrade
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
            <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted }}>No. Screening is pay-per-use.</p>
          </details>
        </Card>
      </Section>
    </MacShell>
  );
};

export default PricingPage;
