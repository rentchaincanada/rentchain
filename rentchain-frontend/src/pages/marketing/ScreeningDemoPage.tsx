import React, { useEffect, useMemo, useState } from "react";
import { Button, Card } from "../../components/ui/Ui";
import { MarketingLayout } from "./MarketingLayout";
import { RequestAccessModal } from "../../components/marketing/RequestAccessModal";
import { spacing, text } from "../../styles/tokens";
import { fetchBillingPricing } from "../../api/billingApi";
import { track } from "../../lib/analytics";

type Tier = "basic" | "verify" | "verify_ai";

const tierLabels: Record<Tier, string> = {
  basic: "Basic screening",
  verify: "Verify",
  verify_ai: "Verify + AI",
};

function getTierPriceCents(pricing: any, tier: Tier): number {
  const screening = pricing?.screening || {};
  if (tier === "basic") return Number(screening.basicCents || 1999);
  if (tier === "verify") return Number(screening.verifyCents || 3999);
  return Number(screening.verifyAiCents || 6999);
}

const ScreeningDemoPage: React.FC = () => {
  const [pricing, setPricing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [tier, setTier] = useState<Tier>("verify");
  const [addons, setAddons] = useState({
    creditScore: false,
    expedited: false,
  });

  useEffect(() => {
    document.title = "Screening demo - RentChain";
    track("demo_opened", { source: "marketing_pricing" });
  }, []);

  useEffect(() => {
    let active = true;
    fetchBillingPricing()
      .then((res) => {
        if (active) setPricing(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const quote = useMemo(() => {
    const screening = pricing?.screening || {};
    const tierAmount = getTierPriceCents(pricing, tier);
    const creditScore = addons.creditScore ? Number(screening.creditScoreCents || 999) : 0;
    const expedited = addons.expedited ? Number(screening.expeditedCents || 1499) : 0;
    const total = tierAmount + creditScore + expedited;
    return { tierAmount, creditScore, expedited, total };
  }, [addons.creditScore, addons.expedited, pricing?.screening, tier]);

  useEffect(() => {
    if (loading) return;
    track("demo_quote_viewed", {
      tier,
      creditScore: addons.creditScore,
      expedited: addons.expedited,
      totalCents: quote.total,
    });
  }, [addons.creditScore, addons.expedited, loading, quote.total, tier]);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 2.8rem)" }}>Try demo screening</h1>
          <p style={{ margin: 0, color: text.muted, maxWidth: 780 }}>
            Explore a sample property, applicant profile, and quote breakdown before creating your account.
          </p>
          <p style={{ margin: 0, color: text.subtle, fontSize: "0.92rem" }}>
            Demo uses sample data. No credit checks are performed.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: spacing.lg,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "start",
          }}
        >
          <Card>
            <h2 style={{ marginTop: 0 }}>Sample property</h2>
            <div style={{ color: text.muted, lineHeight: 1.7 }}>
              <div><strong>Property:</strong> Harborview Residences</div>
              <div><strong>Unit:</strong> 12B</div>
              <div><strong>Address:</strong> 125 King St W, Toronto, ON</div>
              <div><strong>Rent:</strong> $2,300 / month</div>
              <div><strong>Applicant:</strong> Alex Martin</div>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Sample quote</h2>
            <div style={{ display: "grid", gap: spacing.sm }}>
              {(["basic", "verify", "verify_ai"] as Tier[]).map((option) => (
                <label
                  key={option}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.sm,
                    border: "1px solid rgba(15,23,42,0.12)",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <input
                    type="radio"
                    name="tier"
                    checked={tier === option}
                    onChange={() => setTier(option)}
                  />
                  <span style={{ flex: 1 }}>{tierLabels[option]}</span>
                  <strong>${Math.round(getTierPriceCents(pricing, option) / 100)}</strong>
                </label>
              ))}
              <label style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                <input
                  type="checkbox"
                  checked={addons.creditScore}
                  onChange={(event) => setAddons((prev) => ({ ...prev, creditScore: event.target.checked }))}
                />
                Add credit score
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                <input
                  type="checkbox"
                  checked={addons.expedited}
                  onChange={(event) => setAddons((prev) => ({ ...prev, expedited: event.target.checked }))}
                />
                Expedited processing
              </label>
            </div>
            <div
              style={{
                marginTop: spacing.md,
                borderTop: "1px solid rgba(15,23,42,0.12)",
                paddingTop: spacing.sm,
                color: text.muted,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{tierLabels[tier]}</span>
                <span>${(quote.tierAmount / 100).toFixed(2)}</span>
              </div>
              {quote.creditScore > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Credit score add-on</span>
                  <span>${(quote.creditScore / 100).toFixed(2)}</span>
                </div>
              ) : null}
              {quote.expedited > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Expedited add-on</span>
                  <span>${(quote.expedited / 100).toFixed(2)}</span>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, color: text.primary }}>
                <strong>Total</strong>
                <strong>${(quote.total / 100).toFixed(2)} CAD</strong>
              </div>
            </div>
            <div className="rc-wrap-row" style={{ marginTop: spacing.md }}>
              <Button
                type="button"
                onClick={() => {
                  track("demo_request_access_clicked", { tier, totalCents: quote.total });
                  setRequestOpen(true);
                }}
              >
                Create account to run screening
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </MarketingLayout>
  );
};

export default ScreeningDemoPage;
