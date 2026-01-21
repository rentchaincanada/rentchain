import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const PrivacyPage: React.FC = () => {
  useEffect(() => {
    document.title = "Privacy Policy — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <div>
          <h1 style={{ margin: 0 }}>Privacy Policy</h1>
          <div style={{ marginTop: spacing.xs, color: text.subtle }}>Effective date: 2026-01-21</div>
        </div>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain is built with privacy, security, and consent at its core. Personal data is collected, stored, and
          processed in accordance with applicable laws and is only used for clearly defined purposes.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          Tenant information is never shared without proper authorization or legal basis.
        </p>
        <h2 style={{ marginTop: spacing.lg }}>Key Principles</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Consent and transparency for all screening and record activity.</li>
          <li>Data minimization and purpose limitation.</li>
          <li>Access controls and auditability for sensitive records.</li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default PrivacyPage;
