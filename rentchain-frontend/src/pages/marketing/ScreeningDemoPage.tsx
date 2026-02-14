import React, { useEffect, useMemo, useState } from "react";
import { Button, Card } from "../../components/ui/Ui";
import { MarketingLayout } from "./MarketingLayout";
import { RequestAccessModal } from "../../components/marketing/RequestAccessModal";
import { spacing, text } from "../../styles/tokens";
import { track } from "../../lib/analytics";

type DemoTier = "basic" | "verify" | "verify_ai";

const tierLabels: Record<DemoTier, string> = {
  basic: "Basic",
  verify: "Verify",
  verify_ai: "Verify + AI",
};

const tierAmounts: Record<DemoTier, number> = {
  basic: 1999,
  verify: 2999,
  verify_ai: 3999,
};

const addonAmounts = {
  creditScore: 499,
  expedited: 999,
};

const ScreeningDemoPage: React.FC = () => {
  const [requestOpen, setRequestOpen] = useState(false);
  const [tier, setTier] = useState<DemoTier>("verify");
  const [addons, setAddons] = useState({
    creditScore: false,
    expedited: false,
  });

  useEffect(() => {
    document.title = "Screening Demo - RentChain";
    track("demo_opened", { source: "site_screening_demo" });
  }, []);

  const totalCents = useMemo(() => {
    const base = tierAmounts[tier];
    const withCreditScore = addons.creditScore ? addonAmounts.creditScore : 0;
    const withExpedited = addons.expedited ? addonAmounts.expedited : 0;
    return base + withCreditScore + withExpedited;
  }, [addons.creditScore, addons.expedited, tier]);

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 2.8rem)" }}>Screening Demo</h1>
          <p style={{ margin: 0, color: text.muted, maxWidth: 760 }}>
            Explore pricing and what&apos;s included. Demo uses sample data. No credit checks are
            performed.
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
            <h2 style={{ marginTop: 0 }}>Sample application</h2>
            <div style={{ color: text.muted, lineHeight: 1.7 }}>
              <div>
                <strong>Sample Property:</strong> 123 Example St, Halifax, NS
              </div>
              <div>
                <strong>Sample Applicant:</strong> Jordan Tenant
              </div>
              <div>
                <strong>Sample Rent:</strong> $2,100 / month
              </div>
              <div>
                <strong>Sample Move-in:</strong> May 1
              </div>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Sample quote breakdown</h2>
            <div style={{ display: "grid", gap: spacing.sm }}>
              {(Object.keys(tierLabels) as DemoTier[]).map((option) => (
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
                    name="demo-tier"
                    checked={tier === option}
                    onChange={() => {
                      setTier(option);
                      track("demo_plan_selected", { plan: option });
                    }}
                  />
                  <span style={{ flex: 1 }}>{tierLabels[option]}</span>
                  <strong>{money(tierAmounts[option])}</strong>
                </label>
              ))}

              <label style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                <input
                  type="checkbox"
                  checked={addons.creditScore}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setAddons((prev) => ({ ...prev, creditScore: enabled }));
                    track("demo_addon_toggled", { addon: "credit_score", enabled });
                  }}
                />
                Credit score ({money(addonAmounts.creditScore)})
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                <input
                  type="checkbox"
                  checked={addons.expedited}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setAddons((prev) => ({ ...prev, expedited: enabled }));
                    track("demo_addon_toggled", { addon: "expedited", enabled });
                  }}
                />
                Expedited ({money(addonAmounts.expedited)})
              </label>
            </div>

            <div
              style={{
                marginTop: spacing.md,
                borderTop: "1px solid rgba(15,23,42,0.12)",
                paddingTop: spacing.sm,
                display: "grid",
                gap: 6,
                color: text.muted,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{tierLabels[tier]}</span>
                <span>{money(tierAmounts[tier])}</span>
              </div>
              {addons.creditScore ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Credit score</span>
                  <span>{money(addonAmounts.creditScore)}</span>
                </div>
              ) : null}
              {addons.expedited ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Expedited</span>
                  <span>{money(addonAmounts.expedited)}</span>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", color: text.primary, marginTop: 8 }}>
                <strong>Total</strong>
                <strong>{money(totalCents)}</strong>
              </div>
            </div>

            <div className="rc-wrap-row" style={{ marginTop: spacing.md }}>
              <Button
                type="button"
                onClick={() => {
                  track("demo_request_access_clicked", { plan: tier, totalCents });
                  setRequestOpen(true);
                }}
              >
                Create account to run screening
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  track("demo_back_to_pricing_clicked");
                  window.location.href = "/site/pricing";
                }}
              >
                Back to pricing
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

