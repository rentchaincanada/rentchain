import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const StatusPage: React.FC = () => {
  useEffect(() => {
    document.title = "Status - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Status</h1>
        <p style={{ margin: 0, color: text.muted }}>
          This page provides service availability updates and operational notices.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          If you are experiencing issues, please contact support.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default StatusPage;
