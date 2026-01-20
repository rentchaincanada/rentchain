import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const HelpLandlordsPage: React.FC = () => {
  useEffect(() => {
    document.title = "Help for Landlords - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Help for Landlords</h1>
        <p style={{ color: text.muted, margin: 0 }}>
          Resources to help you screen applicants, manage tenants, and keep records organized.
        </p>
        <h2 style={{ marginTop: spacing.lg }}>Getting Started</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Account setup and onboarding</li>
          <li>Inviting tenants</li>
          <li>Creating and tracking lease events</li>
        </ul>
        <h2 style={{ marginTop: spacing.lg }}>Downloads</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Tenant Notice Templates (PDF / DOCX)</li>
          <li>Lease Event Log Template</li>
          <li>Move-In / Move-Out Checklist</li>
          <li>Rent Ledger Summary Sheet</li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default HelpLandlordsPage;
