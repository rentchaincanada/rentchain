import React, { useEffect } from "react";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";

const AboutPage: React.FC = () => {
  useEffect(() => {
    document.title = "About — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <h1 style={{ margin: 0 }}>About RentChain</h1>
          <p style={{ margin: 0, color: text.muted }}>
            RentChain was created to address a simple but persistent problem in the rental market: important decisions
            are often made without reliable, standardized records.
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            Rental relationships generate critical information — screening results, payments, notices, disputes — yet
            this information is often scattered across emails, PDFs, and informal systems. When clarity matters most,
            records are incomplete or difficult to verify.
          </p>
          <p style={{ margin: 0, color: text.muted }}>RentChain exists to change that.</p>
          <p style={{ margin: 0, color: text.muted }}>
            We are building a neutral platform that helps landlords and tenants interact through verified data,
            transparent processes, and clearly documented events. Our focus is not on scoring people or replacing
            human judgment, but on ensuring that rental decisions are grounded in accurate, time-stamped records.
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            RentChain is designed to serve independent landlords and tenants today, while laying the foundation for
            future compliance-driven and public-sector housing programs where transparency, auditability, and trust are
            essential.
          </p>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>
              Our guiding principles are simple:
            </h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>Verification over assumptions</li>
              <li>Records over memory</li>
              <li>Transparency over opacity</li>
            </ul>
          </div>
        </div>
      </Card>
    </MarketingLayout>
  );
};

export default AboutPage;
