import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

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
              <li>Tenant Notice Templates (PDF / DOCX)</li>
              <li>Lease Event Log Template</li>
              <li>Move-In / Move-Out Checklist</li>
              <li>Rent Ledger Summary Sheet</li>
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
              <li>Tenant Rights Overview</li>
              <li>Rental Application Checklist</li>
              <li>Dispute Documentation Guide</li>
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
