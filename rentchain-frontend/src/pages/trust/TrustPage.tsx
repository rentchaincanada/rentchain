import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const TrustPage: React.FC = () => {
  useEffect(() => {
    document.title = "Trust - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Trust</h1>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain is designed to support transparency, auditability, and clear documentation across the rental
          lifecycle.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          We focus on verified data, consent, and structured records to reduce disputes and increase accountability.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default TrustPage;
