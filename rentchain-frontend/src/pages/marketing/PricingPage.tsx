import React, { useEffect } from "react";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";

const PricingPage: React.FC = () => {
  useEffect(() => {
    document.title = "Pricing — RentChain";
  }, []);

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
        </div>

        <div style={{ display: "grid", gap: spacing.lg, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
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
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>$XX / month</div>
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
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>$XX / month</div>
            <div style={{ color: text.subtle, marginTop: spacing.xs }}>Screening: Pay-per-applicant</div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Advanced / Compliance (Coming Soon)</h2>
            <p style={{ color: text.muted, marginTop: 0 }}>
              For portfolio operators and compliance-focused landlords.
            </p>
            <ul style={{ paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
              <li>Enhanced audit and reporting tools</li>
              <li>Extended record retention</li>
              <li>Portfolio-level insights</li>
              <li>Future support for subsidy and compliance workflows</li>
            </ul>
            <div style={{ fontWeight: 600 }}>Limited early access</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: spacing.xs }}>Contact us</div>
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
    </MarketingLayout>
  );
};

export default PricingPage;
