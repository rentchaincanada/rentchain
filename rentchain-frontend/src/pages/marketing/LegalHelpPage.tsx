import React, { useEffect } from "react";
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
          {/* TODO: Replace placeholder links when policies are published. */}
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
            <li>
              <a href="/legal/terms" style={{ color: text.secondary }}>
                Terms of Service
              </a>
            </li>
            <li>
              <a href="/legal/privacy" style={{ color: text.secondary }}>
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="/legal/acceptable-use" style={{ color: text.secondary }}>
                Acceptable Use Policy
              </a>
            </li>
          </ul>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Help Center</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.lg }}>
            <div style={{ flex: "1 1 280px" }}>
              <h3 style={{ marginTop: 0 }}>Help for Landlords</h3>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
                <li>Getting Started</li>
                <li>Guides</li>
                <li>Downloads list:</li>
              </ul>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
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
            <div style={{ flex: "1 1 280px" }}>
              <h3 style={{ marginTop: 0 }}>Help for Tenants</h3>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
                <li>Understanding RentChain</li>
                <li>Guides</li>
                <li>Downloads list:</li>
              </ul>
              <ul style={{ paddingLeft: "1.1rem", color: text.muted }}>
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
            </div>
          </div>
          <p style={{ marginTop: spacing.md, color: text.muted }}>
            If you need help or have questions, visit the Help Center or contact our support team.
          </p>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default LegalHelpPage;
