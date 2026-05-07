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
          We focus on permissioned workflows, consent-aware governance, review-controlled operations, evidence lineage,
          and structured records to reduce disputes and increase accountability.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          Screening and interoperability workflows remain governed by role-based access, consent or lawful-basis
          requirements, provider requirements, and operational review controls. RentChain does not present itself as a
          credit bureau, consumer reporting agency, government authority, collections platform, or public enforcement
          system.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          Institutional-readiness features are designed to organize review, evidence, audit, and interoperability
          metadata. They do not represent institutional approval, government approval, legal certification, autonomous
          onboarding, or uncontrolled external data sharing.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default TrustPage;
