import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const AcceptableUsePage: React.FC = () => {
  useEffect(() => {
    document.title = "Acceptable Use Policy — RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <div>
          <h1 style={{ margin: 0 }}>Acceptable Use Policy</h1>
          <div style={{ marginTop: spacing.xs, color: text.subtle }}>Effective date: 2026-01-21</div>
        </div>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain is designed for lawful rental screening and record keeping. You must use the platform responsibly
          and in compliance with applicable laws.
        </p>
        <p style={{ margin: 0, color: text.muted }}>You agree not to:</p>
        <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
          <li>Use the platform for unlawful discrimination or violations of housing/human rights laws</li>
          <li>Request, use, or share screening information without authorization or permissible purpose</li>
          <li>Upload unlawful content, malware, or content that infringes third-party rights</li>
          <li>Attempt to access, scrape, or export data you are not authorized to access</li>
          <li>Misrepresent identity, consent, or the purpose of a screening request</li>
          <li>Harass, threaten, or abuse other users</li>
        </ul>
        <p style={{ margin: 0, color: text.muted }}>
          RentChain may suspend or terminate access for violations of this policy.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default AcceptableUsePage;
