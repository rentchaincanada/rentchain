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
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Screening Credits</h2>
            <div style={{ color: text.primary, fontSize: "1rem", fontWeight: 600 }}>
              Pay-per-report: $29.99 CAD / screening
            </div>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              Bundles (display only):
              <ul style={{ margin: "6px 0 0 16px" }}>
                <li>Starter Pack: 5 credits for $129</li>
                <li>Pro Pack: 20 credits for $399</li>
              </ul>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, color: text.primary }}>
              <div style={{ fontWeight: 600 }}>What’s included:</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: text.muted }}>
                <li>Tenant-consented credit screening</li>
                <li>Secure report delivery</li>
                <li>PDF download</li>
                <li>Activity timeline</li>
              </ul>
            </div>
            <div>
              <Button type="button" onClick={() => navigate("/applications")}>
                Start screening
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNotifyPlan("core");
                  setNotifyOpen(true);
                }}
                style={{ marginLeft: 8 }}
              >
                Notify me about Core/Pro
              </Button>
            </div>
            <div style={{ fontSize: "0.85rem", color: text.subtle }}>
              Credit screening requires applicant consent.
            </div>
            <div style={{ fontSize: "0.85rem", color: text.muted }}>
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
