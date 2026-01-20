import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";
import { TEMPLATES_VERSION } from "../../constants/templates";

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
        <div style={{ display: "grid", gap: spacing.lg, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Landlords</h2>
            <p style={{ color: text.muted }}>
              Start here for onboarding, templates, and lifecycle guidance.
            </p>
            <div style={{ color: text.muted, fontWeight: 600 }}>Downloads (coming soon)</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>Getting Started</li>
              <li>Guides</li>
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
            <Link to="/help/landlords" style={{ display: "inline-block", marginTop: spacing.sm }}>
              View landlord help
            </Link>
          </div>
          <div>
            <h2 style={{ marginTop: 0 }}>Tenants</h2>
            <p style={{ color: text.muted }}>
              Learn how RentChain works and how to manage your records.
            </p>
            <div style={{ color: text.muted, fontWeight: 600 }}>Downloads (coming soon)</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>Understanding RentChain</li>
              <li>Guides</li>
              <li>
                <a href={`/templates/Tenant_Rights_Overview.pdf?v=${TEMPLATES_VERSION}`}>Tenant Rights Overview</a>
              </li>
              <li>
                <a href={`/templates/Rental_Application_Checklist.pdf?v=${TEMPLATES_VERSION}`}>Rental Application Checklist</a>
              </li>
              <li>
                <a href={`/templates/Dispute_Documentation_Guide.pdf?v=${TEMPLATES_VERSION}`}>Dispute Documentation Guide</a>
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
