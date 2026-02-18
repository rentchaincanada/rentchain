import React, { useEffect } from "react";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";

const AboutPage: React.FC = () => {
  useEffect(() => {
    document.title = "About RentChain — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <h1 style={{ margin: 0 }}>About RentChain</h1>
          <p style={{ margin: 0, color: text.muted }}>
            RentChain helps landlords and tenants work from the same set of clear, verifiable records.
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            Rental relationships generate important events applications, consents, payments, notices, maintenance
            requests, and outcomes. In many cases these records live across emails, PDFs, texts, and informal notes.
            When decisions or disputes arise, documentation is often incomplete or difficult to verify.
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            RentChain is designed to bring structure to that process by recording key rental events in a consistent,
            time-stamped format with clear attribution and auditability.
          </p>

          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>What we are building</h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>A neutral platform for rental workflows and record-keeping.</li>
              <li>
                Tenant-initiated screening and verification workflows designed to be consent-based and compliant.
              </li>
              <li>A dashboard for landlords and tenants to manage records transparently.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>What we are not</h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>A consumer reporting agency.</li>
              <li>A black-box scoring system.</li>
              <li>A substitute for legal advice or professional judgment.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>Guiding principles</h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>Verification over assumptions</li>
              <li>Records over memory</li>
              <li>Transparency over opacity</li>
              <li>Consent-first workflows for sensitive actions</li>
            </ul>
          </div>
        </div>
      </Card>
    </MarketingLayout>
  );
};

export default AboutPage;
