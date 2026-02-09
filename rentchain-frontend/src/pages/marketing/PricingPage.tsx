import React, { useEffect, useMemo, useState } from "react";
import { Card, Button } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { fetchBillingPricing } from "../../api/billingApi";
import { startCheckout } from "../../billing/startCheckout";
import { RequestAccessModal } from "../../components/marketing/RequestAccessModal";
import { PlanIntervalToggle } from "../../components/billing/PlanIntervalToggle";

const PricingPage: React.FC = () => {
  const { user } = useAuth();
  const isAuthed = Boolean(user?.id);
  const [pricing, setPricing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingError, setPricingError] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [interval, setInterval] = useState<"month" | "year">("month");

  useEffect(() => {
    document.title = "Pricing — RentChain";
  }, []);

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
            RentChain offers simple, transparent pricing designed to support landlords at every stage — from individual
            units to growing portfolios.
          </p>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>
            There are no long-term contracts, and you can change plans as your needs evolve.
          </p>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm }}>
            <Button type="button" variant="secondary" onClick={() => setRequestOpen(true)}>
              Request access
            </Button>
            <Button type="button" variant="ghost" onClick={() => (window.location.href = "/login")}>
              Sign in
            </Button>
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
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Pricing unavailable</div>
              <div style={{ color: text.muted, marginTop: spacing.xs }}>
                Please try again shortly.
              </div>
            </Card>
          ) : null}
          <Card>
            <h2 style={{ marginTop: 0 }}>Starter</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>For individual landlords and small portfolios.</p>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>Property and unit management</li>
              <li>Send application links</li>
              <li>Tenant invitations and onboarding</li>
              <li>Lease and tenant lifecycle tracking</li>
              <li>Core rental event records</li>
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {loading ? "—" : renderPrice("starter")}
            </div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("starter")} disabled={pricingUnavailable}>
                {isAuthed ? "Choose plan" : "Get started"}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Professional</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>For landlords who require screening and verified records.</p>
            <div style={{ color: text.muted, fontWeight: 600, marginTop: spacing.sm }}>Everything in Starter, plus:</div>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>Tenant screening access</li>
              <li>Ledger tools for audit-ready events</li>
              <li>Exports for reporting and audits</li>
              <li>Compliance-ready notices and timelines</li>
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {loading ? "—" : renderPrice("pro")}
            </div>
            <div style={{ color: text.subtle, marginTop: spacing.xs }}>Screening: Pay-per-applicant</div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("pro")} disabled={pricingUnavailable}>
                {isAuthed ? "Choose plan" : "Get started"}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Business</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>
              For portfolio operators who need advanced workflows and reporting.
            </p>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>Advanced exports and audit logs</li>
              <li>Compliance reporting</li>
              <li>Portfolio analytics</li>
              <li>Priority support</li>
            </ul>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {loading ? "—" : renderPrice("business")}
            </div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.sm }}>
              <Button type="button" onClick={() => handlePlanAction("business")} disabled={pricingUnavailable}>
                {isAuthed ? "Choose plan" : "Get started"}
              </Button>
            </div>
          </Card>
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>Screening Fees</h2>
          <p style={{ margin: 0, color: text.muted }}>
            Tenant screening services are charged per applicant and clearly disclosed before purchase.
          </p>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>
            RentChain does not bundle or obscure third-party screening costs.
          </p>
        </Card>
      </div>
      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </MarketingLayout>
  );
};

export default PricingPage;
