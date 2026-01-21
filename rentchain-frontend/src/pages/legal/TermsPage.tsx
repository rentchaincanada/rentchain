import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const TermsPage: React.FC = () => {
  useEffect(() => {
    document.title = "Terms of Service — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <div>
          <h1 style={{ margin: 0 }}>Terms of Service</h1>
          <div style={{ marginTop: spacing.xs, color: text.subtle }}>Effective date: 2026-01-21</div>
        </div>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain provides tools and record-keeping infrastructure. Landlords remain responsible for decisions,
          compliance, and outcomes.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          By using the platform, you agree to follow applicable laws and use the service for lawful rental processes.
        </p>
        <h2 style={{ marginTop: spacing.lg }}>Platform Role</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>RentChain supplies record-keeping infrastructure and verification workflows.</li>
          <li>Landlords and tenants remain responsible for their decisions and compliance.</li>
          <li>RentChain does not provide legal advice.</li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default TermsPage;
