import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import AskRentChainWidget from "../../components/help/AskRentChainWidget";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";

const LegalHelpPage: React.FC = () => {
  useEffect(() => {
    document.title = "Legal — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>Legal</h1>
        </div>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <div>
              <h2 style={{ marginTop: 0 }}>Privacy & Data Protection</h2>
              <p style={{ margin: 0, color: text.muted }}>
                RentChain is built with privacy, security, and consent at its core. We collect, use, and retain
                personal information only for defined purposes and in accordance with applicable laws. Tenant
                information is not shared without authorization or a valid legal basis.
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>Consent & Transparency</h2>
              <p style={{ margin: 0, color: text.muted }}>
                Sensitive actions such as screening requests, identity verification, and creation of certain records
                require clear disclosure and, where required, explicit tenant consent. RentChain is designed to avoid
                hidden profiles and undisclosed records.
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>Consumer Reporting & Screening Partners</h2>
              <p style={{ margin: 0, color: text.muted }}>
                RentChain may facilitate tenant-initiated screening through authorized third-party providers,
                including TransUnion ShareAble for Rentals where available. RentChain is not a consumer reporting
                agency and does not generate independent credit files or consumer reports.
              </p>
              <p style={{ marginTop: spacing.sm, marginBottom: 0, color: text.muted }}>
                Landlords are responsible for ensuring they have a lawful basis and permissible purpose for requesting
                and using screening information, and for complying with applicable housing, human rights, and consumer
                reporting laws.
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>No Black-Box Scoring</h2>
              <p style={{ margin: 0, color: text.muted }}>
                RentChain does not generate informal tenant ratings or opaque risk scores. Where the platform displays
                information, it is presented as documented records, statuses, or provider outputs, with clear
                time stamps and attribution.
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>Platform Role & Responsibility</h2>
              <p style={{ margin: 0, color: text.muted }}>
                RentChain provides software tools and record-keeping infrastructure. Landlords and tenants remain
                responsible for their actions, decisions, and compliance obligations. RentChain does not provide legal
                advice and does not make rental decisions.
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>Security Overview</h2>
              <p style={{ margin: 0, color: text.muted }}>
                We employ reasonable administrative, technical, and organizational safeguards designed to protect
                sensitive data, including encryption in transit, access controls, audit logging, and secure cloud
                infrastructure. No system is perfectly secure, but we continuously improve our safeguards.
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>Contact</h2>
              <p style={{ margin: 0, color: text.muted }}>For privacy and compliance matters: privacy@rentchain.ai</p>
              <p style={{ marginTop: spacing.xs, marginBottom: 0, color: text.muted }}>For support: support@rentchain.ai</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Policies</h2>
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

        <div>
          <h2 style={{ marginTop: 0 }}>Need Assistance</h2>
          <AskRentChainWidget compact defaultOpen={false} />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default LegalHelpPage;
