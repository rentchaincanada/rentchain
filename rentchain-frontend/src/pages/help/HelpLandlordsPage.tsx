import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";
import { TEMPLATES_VERSION } from "../../constants/templates";

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
        <h2 style={{ marginTop: spacing.lg }}>Downloads (coming soon)</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>
            <a href={`/templates/Tenant_Notice_Templates.pdf?v=${TEMPLATES_VERSION}`}>Tenant Notice Templates (PDF)</a>{" "}
            /{" "}
            <a href={`/templates/Tenant_Notice_Templates.docx?v=${TEMPLATES_VERSION}`}>DOCX</a>
          </li>
          <li>
            <a href={`/templates/Lease_Event_Log_Template.pdf?v=${TEMPLATES_VERSION}`}>Lease Event Log Template</a>
          </li>
          <li>
            <a href={`/templates/Move_In_Move_Out_Checklist.pdf?v=${TEMPLATES_VERSION}`}>Move-In / Move-Out Checklist</a>
          </li>
          <li>
            <a href={`/templates/Rent_Ledger_Summary_Sheet.pdf?v=${TEMPLATES_VERSION}`}>Rent Ledger Summary Sheet</a>
          </li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default HelpLandlordsPage;
