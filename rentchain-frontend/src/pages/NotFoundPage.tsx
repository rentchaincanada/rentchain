import React, { useEffect } from "react";
import { spacing, text } from "../styles/tokens";
import { MarketingLayout } from "./marketing/MarketingLayout";

const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = "Page not found - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Page not found</h1>
        <p style={{ margin: 0, color: text.muted }}>
          The page you are looking for does not exist.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default NotFoundPage;
