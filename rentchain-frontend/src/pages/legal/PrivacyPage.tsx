import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const PrivacyPage: React.FC = () => {
  useEffect(() => {
    document.title = "Privacy Policy - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Privacy Policy</h1>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain is built with privacy, security, and consent at its core. Personal data is collected, stored, and
          processed in accordance with applicable laws and is only used for clearly defined purposes.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          Tenant information is never shared without proper authorization or legal basis.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default PrivacyPage;
