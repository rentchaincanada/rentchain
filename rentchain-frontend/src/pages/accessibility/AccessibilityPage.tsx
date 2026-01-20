import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const AccessibilityPage: React.FC = () => {
  useEffect(() => {
    document.title = "Accessibility - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Accessibility</h1>
        <p style={{ margin: 0, color: text.muted }}>
          We aim to make RentChain accessible and usable for all participants in the rental process.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          If you encounter accessibility barriers, please contact our support team.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default AccessibilityPage;
