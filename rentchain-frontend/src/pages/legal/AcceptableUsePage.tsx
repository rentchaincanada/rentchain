import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const AcceptableUsePage: React.FC = () => {
  useEffect(() => {
    document.title = "Acceptable Use - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Acceptable Use</h1>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain does not create hidden profiles or opaque risk scores. All recorded information is factual,
          time-stamped, and attributable.
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Use RentChain only for lawful rental screening and record keeping.</li>
          <li>Do not upload unlawful or discriminatory content.</li>
          <li>Respect tenant consent and privacy obligations.</li>
        </ul>
      </div>
    </MarketingLayout>
  );
};

export default AcceptableUsePage;
