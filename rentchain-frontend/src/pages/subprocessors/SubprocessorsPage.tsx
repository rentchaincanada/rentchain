import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const SubprocessorsPage: React.FC = () => {
  useEffect(() => {
    document.title = "Subprocessors - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Subprocessors</h1>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain works with vetted service providers to deliver infrastructure and operational support.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          A current list of subprocessors is available upon request.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default SubprocessorsPage;
