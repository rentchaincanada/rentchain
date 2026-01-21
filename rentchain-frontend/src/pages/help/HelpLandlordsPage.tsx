import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";
import { templateUrl } from "../../utils/templateUrl";

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
          <li>
            <a
              href={templateUrl("/templates/Late_Rent_Notice_Template.pdf")}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Late Rent Notice Template
            </a>
          </li>
          <li>
            <a
              href={templateUrl("/templates/Tenant_Notice_Templates.pdf")}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Tenant Notice Templates
            </a>
          </li>
          <li>
            <a
              href={templateUrl("/templates/Notice_of_Entry_Template.pdf")}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Notice of Entry Template
            </a>
          </li>
          <li>
            <a
              href={templateUrl("/templates/Lease_Event_Log_Template.pdf")}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Lease Event Log Template
            </a>
          </li>
          <li>
            <a
              href={templateUrl("/templates/Move_In_Out_Inspection_Checklist_Template.pdf")}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Move-In / Move-Out Inspection Checklist
            </a>
          </li>
          <li>
            <a
              href={templateUrl("/templates/Rent_Ledger_Summary_Template.pdf")}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Rent Ledger Summary Template
            </a>
          </li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default HelpLandlordsPage;
