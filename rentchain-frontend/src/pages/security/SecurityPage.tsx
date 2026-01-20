import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const SecurityPage: React.FC = () => {
  useEffect(() => {
    document.title = "Security - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Security</h1>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain applies security best practices to protect sensitive data and maintain integrity of records.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          Access is controlled and activity is logged to support clear accountability.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default SecurityPage;
