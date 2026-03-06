import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Section, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import { useAuth } from "../context/useAuth";
import { useBillingStatus, billingTierLabel } from "@/hooks/useBillingStatus";
import { openUpgradeFlow } from "@/billing/openUpgradeFlow";
import { useAccountSummary } from "./account/useAccountSummary";

type HubCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function HubCard({ title, description, children }: HubCardProps) {
  return (
    <Card style={{ display: "grid", gap: spacing.sm, border: `1px solid ${colors.border}` }}>
      <div style={{ fontWeight: 800, fontSize: "1rem" }}>{title}</div>
      <div style={{ color: text.muted, fontSize: "0.9rem" }}>{description}</div>
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>{children}</div>
    </Card>
  );
}

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const billingStatus = useBillingStatus();
  const planLabel = billingTierLabel(billingStatus.tier);
  const { loading: summaryLoading, error: summaryError, summary } = useAccountSummary();

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : "Unavailable";
  const formatAmount = (amountCents?: number | null) =>
    typeof amountCents === "number" ? `${(amountCents / 100).toFixed(2)} CAD` : "Unavailable";

  return (
    <Section style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: spacing.md }}>
      <Card elevated>
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>My Account</h1>
          <p style={{ margin: 0, color: text.muted }}>
            Manage your security, billing, legal documents, and account preferences.
          </p>
          <div style={{ color: text.secondary, fontSize: "0.9rem" }}>
            {user?.email ? `Signed in as ${user.email}` : "Signed in"} · Plan: {planLabel}
          </div>
        </div>
      </Card>

      <Card style={{ display: "grid", gap: spacing.sm, border: `1px solid ${colors.border}` }}>
        <div style={{ fontWeight: 800, fontSize: "1rem" }}>Account Summary</div>
        {summaryLoading ? (
          <div style={{ display: "grid", gap: 6, color: text.muted, fontSize: 13 }}>
            <div>Loading summary...</div>
            <div>Fetching billing status...</div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: spacing.sm,
              fontSize: 14,
            }}
          >
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>Plan</div>
              <div style={{ fontWeight: 700 }}>
                {summary.planNormalized ? summary.planNormalized.replace("_", " ") : planLabel}
              </div>
            </div>
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>Billing status</div>
              <div style={{ fontWeight: 700 }}>{summary.status || "Unavailable"}</div>
            </div>
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>Next renewal</div>
              <div style={{ fontWeight: 700 }}>{formatDate(summary.nextRenewalAt)}</div>
            </div>
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>Last invoice</div>
              <div style={{ fontWeight: 700 }}>
                {formatDate(summary.lastInvoiceAt)} · {formatAmount(summary.lastInvoiceAmountCents)}
              </div>
            </div>
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>Receipts</div>
              <div style={{ fontWeight: 700 }}>{summary.receiptsCount ?? "Unavailable"}</div>
            </div>
          </div>
        )}
        {summaryError ? (
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, color: text.muted, fontSize: 13 }}>
            <span>{summaryError}</span>
            <Button type="button" variant="secondary" onClick={() => navigate("/billing")}>
              Go to Billing
            </Button>
          </div>
        ) : null}
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: spacing.md,
        }}
      >
        <HubCard title="Personal" description="Profile and notification preferences.">
          <Button type="button" variant="secondary" onClick={() => navigate("/account/profile")}>
            Profile
          </Button>
        </HubCard>

        <HubCard title="Security" description="Two-factor authentication and account security settings.">
          <Button type="button" onClick={() => navigate("/account/security")}>
            Account security
          </Button>
        </HubCard>

        <HubCard title="Billing & Plans" description="View your plan, receipts, and manage upgrades.">
          <Button type="button" onClick={() => navigate("/billing")}>
            Billing
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/site/pricing")}>
            Pricing & plans
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void openUpgradeFlow({ navigate, fallbackPath: "/pricing" });
            }}
          >
            Manage plan
          </Button>
        </HubCard>

        <HubCard title="Receipts" description="Download invoices and payment receipts.">
          <Button type="button" onClick={() => navigate("/billing#receipts")}>
            View receipts
          </Button>
        </HubCard>

        <HubCard title="Data management" description="Export your data and manage retention (coming soon).">
          <Button type="button" variant="secondary" onClick={() => navigate("/account/data")}>
            Manage data
          </Button>
        </HubCard>

        <HubCard title="Legal" description="Privacy, Terms, and compliance documents.">
          <Button type="button" variant="secondary" onClick={() => navigate("/privacy")}>
            Privacy
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/terms")}>
            Terms
          </Button>
        </HubCard>
      </div>
    </Section>
  );
};

export default AccountPage;
