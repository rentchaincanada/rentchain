import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text } from "../styles/tokens";
import { SUPPORT_EMAIL } from "../config/support";
import { NotifyMeModal } from "../components/billing/NotifyMeModal";
import { useAuth } from "../context/useAuth";

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyPlan, setNotifyPlan] = useState<"core" | "pro" | "elite">("core");

  return (
    <MacShell title="RentChain · Pricing">
      <Section style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 860, margin: "0 auto" }}>
        <Card elevated>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Pricing</h1>
            <div style={{ color: text.muted }}>Transparent pricing for Screening Credits.</div>
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
                <div style={{ color: text.muted, fontSize: 13 }}>Free</div>
                <Button type="button" onClick={() => navigate(user ? "/billing" : "/login")}>
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
                <div style={{ color: text.muted, fontSize: 13 }}>$29 / month • $290 / year</div>
                <Button type="button" onClick={() => navigate(user ? "/billing" : "/login")}>
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
                <div style={{ color: text.muted, fontSize: 13 }}>$79 / month • $790 / year</div>
                <Button type="button" onClick={() => navigate(user ? "/billing" : "/login")}>
                  Get started
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
