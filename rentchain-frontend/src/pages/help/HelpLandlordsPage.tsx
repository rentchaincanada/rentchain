import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";
import { templateUrl } from "@/utils/templateUrl";

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
            <a href={templateUrl("/templates/Tenant_Notice_Templates.pdf")}>Tenant Notice Templates (PDF)</a>{" "}
            /{" "}
            <a href={templateUrl("/templates/Tenant_Notice_Templates.docx")}>DOCX</a>
          </li>
          <li>
            <a href={templateUrl("/templates/Lease_Event_Log_Template.pdf")}>Lease Event Log Template</a>
          </li>
          <li>
            <a href={templateUrl("/templates/Move_In_Move_Out_Checklist.pdf")}>Move-In / Move-Out Checklist</a>
          </li>
          <li>
            <a href={templateUrl("/templates/Rent_Ledger_Summary_Sheet.pdf")}>Rent Ledger Summary Sheet</a>
          </li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default HelpLandlordsPage;
