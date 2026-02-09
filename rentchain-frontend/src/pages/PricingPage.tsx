import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";
import { SUPPORT_EMAIL } from "../config/support";
import { NotifyMeModal } from "../components/billing/NotifyMeModal";
import { useAuth } from "../context/useAuth";
import { fetchBillingPricing, fetchPricingHealth } from "../api/billingApi";
import { apiFetch } from "@/lib/apiClient";
import { BillingPlansPanel } from "@/components/billing/BillingPlansPanel";
import { type PlanKey } from "@/billing/planVisibility";
import { useCapabilities } from "@/hooks/useCapabilities";

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyPlan, setNotifyPlan] = useState<"core" | "pro" | "elite">("core");
  const [pricing, setPricing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingError, setPricingError] = useState(false);
  const [pricingHealth, setPricingHealth] = useState<any | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const { caps } = useCapabilities();

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
          console.warn("[pricing] fetch failed", { message: err?.message || err });
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

  useEffect(() => {
    let active = true;
    fetchPricingHealth()
      .then((res) => {
        if (!active) return;
        setPricingHealth(res);
      })
      .finally(() => {
        if (active) setHealthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pricingUnavailable =
    (!healthLoading && pricingHealth && pricingHealth.ok === false) ||
    (!loading && pricingError);

  const normalizePlan = (input?: string | null): PlanKey => {
    const raw = String(input || "").trim().toLowerCase();
    if (raw === "starter" || raw === "core") return "starter";
    if (raw === "pro") return "pro";
    if (raw === "business") return "business";
    if (raw === "elite") return "elite";
    return "screening";
  };

  const currentPlanKey = normalizePlan(caps?.plan || user?.plan || null);

  const handlePlanAction = async (planKey: "starter" | "pro" | "business") => {
    if (pricingUnavailable) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (currentPlanKey === planKey) return;
    try {
      if (import.meta.env.DEV) {
        console.debug("[billing] subscribe interval", { interval });
      }
      const hasSubscription = ["starter", "pro", "business", "elite"].includes(currentPlanKey);
      const endpoint = hasSubscription ? "/billing/upgrade" : "/billing/subscribe";
      const res: any = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          planKey,
          interval,
          featureKey: "pricing",
          source: "pricing_page",
          redirectTo: "/billing",
        }),
      });
      const url = res?.url || res?.checkoutUrl;
      if (url && typeof window !== "undefined") {
        window.location.assign(url);
        return;
      }
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.warn("[pricing] subscribe failed", { message: err?.message || err });
      }
    }
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
            {pricingUnavailable ? (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Pricing unavailable. Please try again later.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Plans</h2>
            <BillingIntervalToggle value={interval} onChange={setInterval} />
            <BillingPlansPanel
              pricing={pricing}
              pricingLoading={loading}
              pricingUnavailable={pricingUnavailable}
              interval={interval}
              onIntervalChange={setInterval}
              currentPlan={currentPlanKey}
              role={user?.actorRole || user?.role || null}
              mode="pricing"
              onSelectPlan={handlePlanAction}
            />
            <div style={{ fontSize: "0.85rem", color: text.subtle }}>
              Questions? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </div>
            {(import.meta.env.DEV ||
              (typeof window !== "undefined" &&
                new URLSearchParams(window.location.search).get("debug") === "1")) &&
            pricingHealth?.env ? (
              <div style={{ fontSize: 12, color: text.subtle }}>
                Environment: {String(pricingHealth.env).toUpperCase()}
              </div>
            ) : null}
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
