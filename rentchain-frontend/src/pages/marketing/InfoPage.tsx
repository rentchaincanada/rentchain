import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";

interface InfoPageProps {
  title: string;
  description: string;
}

export const InfoPage: React.FC<InfoPageProps> = ({ title, description }) => {
  useEffect(() => {
    document.title = `${title} — RentChain`;
  }, [title]);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p style={{ margin: 0, color: text.muted }}>{description}</p>
      </div>
    </MarketingLayout>
  );
};
