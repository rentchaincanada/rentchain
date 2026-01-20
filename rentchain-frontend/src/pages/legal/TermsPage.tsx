import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const TermsPage: React.FC = () => {
  useEffect(() => {
    document.title = "Terms of Service - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Terms of Service</h1>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain provides tools and record-keeping infrastructure. Landlords remain responsible for decisions,
          compliance, and outcomes.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          By using the platform, you agree to follow applicable laws and use the service for lawful rental processes.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default TermsPage;
