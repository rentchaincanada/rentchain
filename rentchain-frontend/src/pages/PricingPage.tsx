import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";
import { SUPPORT_EMAIL } from "../config/support";
import { NotifyMeModal } from "../components/billing/NotifyMeModal";
import { useAuth } from "../context/useAuth";
import { fetchBillingPricing } from "../api/billingApi";
import { startCheckout } from "../billing/startCheckout";

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyPlan, setNotifyPlan] = useState<"core" | "pro" | "elite">("core");
  const [pricing, setPricing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchBillingPricing()
      .then((res) => {
        if (!active) return;
        setPricing(res);
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
    const monthly = `$${(plan.monthlyAmountCents / 100).toFixed(0)} / month`;
    const yearly = plan.yearlyAmountCents
      ? `$${(plan.yearlyAmountCents / 100).toFixed(0)} / year`
      : "";
    return yearly ? `${monthly} • ${yearly}` : monthly;
  };

  const handlePlanAction = (planKey: "starter" | "pro") => {
    if (!user) {
      navigate("/login");
      return;
    }
    startCheckout({
      tier: planKey,
      interval: "monthly",
      featureKey: "pricing",
      source: "pricing_page",
      redirectTo: "/billing",
    });
  };

  return (
    <MacShell title="RentChain · Pricing">
      <Section style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 860, margin: "0 auto" }}>
        <Card elevated>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Pricing</h1>
            <div style={{ color: text.muted }}>
              Transparent pricing for Screening Credits and rental management.
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Plans</h2>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${text.muted}`,
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>Starter</div>
                <div style={{ color: text.muted, fontSize: 13 }}>
                  {loading ? "Loading..." : renderPrice("starter")}
                </div>
                <Button type="button" onClick={() => handlePlanAction("starter")}>
                  Get started
                </Button>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${text.muted}`,
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>Pro</div>
                <div style={{ color: text.muted, fontSize: 13 }}>
                  {loading ? "Loading..." : renderPrice("pro")}
                </div>
                <Button type="button" onClick={() => handlePlanAction("pro")}>
                  Upgrade to Pro
                </Button>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${text.muted}`,
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>Business</div>
                <div style={{ color: text.muted, fontSize: 13 }}>
                  {loading ? "Loading..." : renderPrice("business")}
                </div>
                <Button type="button" onClick={() => navigate(user ? "/billing" : "/login")}>
                  Contact sales
                </Button>
              </div>
            </div>
            <div style={{ fontSize: "0.85rem", color: text.subtle }}>
              Questions? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </div>
          </div>
        </Card>
      </Section>
      <NotifyMeModal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        desiredPlan={notifyPlan}
        context="pricing_page"
        defaultEmail={user?.email}
      />
    </MacShell>
  );
};

export default PricingPage;
