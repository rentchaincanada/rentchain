import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const HelpTenantsPage: React.FC = () => {
  useEffect(() => {
    document.title = "Help for Tenants - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Help for Tenants</h1>
        <p style={{ color: text.muted, margin: 0 }}>
          Guidance on consent, screenings, and how your rental records are handled.
        </p>
        <h2 style={{ marginTop: spacing.lg }}>Getting Started</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Understanding RentChain</li>
          <li>Consent and transparency</li>
          <li>How to review your records</li>
        </ul>
        <h2 style={{ marginTop: spacing.lg }}>Downloads</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Tenant Rights Overview</li>
          <li>Rental Application Checklist</li>
          <li>Dispute Documentation Guide</li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default HelpTenantsPage;
