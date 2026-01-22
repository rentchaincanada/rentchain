import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";
import AskRentChainWidget from "../../components/help/AskRentChainWidget";
import { templateUrl } from "../../utils/templateUrl";

const HelpIndexPage: React.FC = () => {
  useEffect(() => {
    document.title = "Help Center - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>Help Center</h1>
          <p style={{ marginTop: spacing.sm, color: text.muted }}>
            Guides, downloads, and support resources for landlords and tenants.
          </p>
        </div>
        <AskRentChainWidget defaultOpen />
        <div style={{ display: "grid", gap: spacing.lg, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Landlords</h2>
            <p style={{ color: text.muted }}>
              Start here for onboarding, templates, and lifecycle guidance.
            </p>
            <div style={{ color: text.muted, fontWeight: 600 }}>Downloads</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>Getting Started</li>
              <li>Guides</li>
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
            <Link to="/help/landlords" style={{ display: "inline-block", marginTop: spacing.sm }}>
              View landlord help
            </Link>
          </div>
          <div>
            <h2 style={{ marginTop: 0 }}>Tenants</h2>
            <p style={{ color: text.muted }}>
              Learn how RentChain works and how to manage your records.
            </p>
            <div style={{ color: text.muted, fontWeight: 600 }}>Downloads</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>Understanding RentChain</li>
              <li>Guides</li>
              <li>
                <a
                  href={templateUrl("/templates/Rental_Application_Checklist_Tenant.pdf")}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Rental Application Checklist
                </a>
              </li>
              <li>
                <a
                  href={templateUrl("/templates/Tenant_Rights_Overview.pdf")}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Tenant Rights Overview
                </a>
              </li>
              <li>
                <a
                  href={templateUrl("/templates/Dispute_Documentation_Guide_Template.pdf")}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Dispute Documentation Guide
                </a>
              </li>
            </ul>
            <Link to="/help/tenants" style={{ display: "inline-block", marginTop: spacing.sm }}>
              View tenant help
            </Link>
          </div>
        </div>
        <div>
          <h2 style={{ marginTop: 0 }}>Need Assistance</h2>
          <p style={{ color: text.muted, margin: 0 }}>
            If you need help or have questions, visit the Contact page.
          </p>
          <Link to="/contact" style={{ display: "inline-block", marginTop: spacing.sm }}>
            Contact Support
          </Link>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default HelpIndexPage;
