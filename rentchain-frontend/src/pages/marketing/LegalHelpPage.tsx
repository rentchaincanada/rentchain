import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import AskRentChainWidget from "../../components/help/AskRentChainWidget";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { templateUrl } from "../../utils/templateUrl";

const LegalHelpPage: React.FC = () => {
  useEffect(() => {
    document.title = "Legal & Help — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>Legal &amp; Help</h1>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>Need help? Ask RentChain</h2>
          <AskRentChainWidget compact defaultOpen={false} />
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>Legal</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <div>
              <h3 style={{ marginTop: 0 }}>Privacy &amp; Data Protection</h3>
              <p style={{ margin: 0, color: text.muted }}>
                RentChain is built with privacy, security, and consent at its core. Personal data is collected, stored,
                and processed in accordance with applicable laws and is only used for clearly defined purposes. Tenant
                information is never shared without proper authorization or legal basis.
              </p>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>Consent &amp; Transparency</h3>
              <p style={{ margin: 0, color: text.muted }}>
                Tenants are informed when screening or records are created and must provide consent where required.
                RentChain does not create hidden profiles or undisclosed records.
              </p>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>No Black-Box Scoring</h3>
              <p style={{ margin: 0, color: text.muted }}>
                RentChain does not generate informal tenant ratings or opaque risk scores. All recorded information is
                factual, time-stamped, and attributable.
              </p>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>Platform Role</h3>
              <p style={{ margin: 0, color: text.muted }}>
                RentChain provides tools and record-keeping infrastructure. Landlords remain responsible for decisions,
                compliance, and outcomes.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Terms &amp; Policies</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
            <li>
              <Link to="/terms" style={{ color: text.secondary }}>
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/privacy" style={{ color: text.secondary }}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/acceptable-use" style={{ color: text.secondary }}>
                Acceptable Use Policy
              </Link>
            </li>
          </ul>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Help Center</h2>
          <p style={{ marginTop: 0, color: text.muted }}>
            Looking for the full library?{" "}
            <Link to="/help/templates" style={{ color: text.secondary }}>
              View all templates →
            </Link>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.lg }}>
            <div style={{ flex: "1 1 280px" }}>
              <h3 style={{ marginTop: 0 }}>Help for Landlords</h3>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
                <li>Getting Started</li>
                <li>Guides</li>
              </ul>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted, display: "grid", gap: spacing.xs }}>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>Late Rent Notice</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Late_Rent_Notice_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Late_Rent_Notice_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>Notice of Entry</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Notice_of_Entry_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Notice_of_Entry_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>Lease Event Log</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Lease_Event_Log_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Lease_Event_Log_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                    <a href={templateUrl("/templates/Lease_Event_Log_Template.csv")} download target="_blank" rel="noopener noreferrer">CSV</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>Move-In / Move-Out Inspection Checklist</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Move_In_Out_Inspection_Checklist_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Move_In_Out_Inspection_Checklist_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>Rent Ledger Summary Sheet</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Rent_Ledger_Summary_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Rent_Ledger_Summary_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                    <a href={templateUrl("/templates/Rent_Ledger_Summary_Template.csv")} download target="_blank" rel="noopener noreferrer">CSV</a>
                  </span>
                </li>
              </ul>
            </div>
            <div style={{ flex: "1 1 280px" }}>
              <h3 style={{ marginTop: 0 }}>Help for Tenants</h3>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
                <li>Understanding RentChain</li>
                <li>Guides</li>
              </ul>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted, display: "grid", gap: spacing.xs }}>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>Rental Application Checklist (Tenant)</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Rental_Application_Checklist_Tenant.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Rental_Application_Checklist_Tenant.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <span>Dispute Documentation Guide</span>
                  <span style={{ display: "flex", gap: spacing.xs }}>
                    <a href={templateUrl("/templates/Dispute_Documentation_Guide_Template.pdf")} download target="_blank" rel="noopener noreferrer">PDF</a>
                    <a href={templateUrl("/templates/Dispute_Documentation_Guide_Template.docx")} download target="_blank" rel="noopener noreferrer">DOCX</a>
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: spacing.sm, color: text.subtle }}>
            Templates are general-purpose and not legal advice. Customize for your jurisdiction and consult counsel as needed.
          </p>
          <p style={{ marginTop: spacing.md, color: text.muted }}>
            If you need help or have questions, visit the Help Center or contact our support team.
          </p>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default LegalHelpPage;
