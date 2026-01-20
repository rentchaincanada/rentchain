import React, { useEffect } from "react";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "../marketing/MarketingLayout";

const ContactPage: React.FC = () => {
  useEffect(() => {
    document.title = "Contact - RentChain";
  }, []);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 760 }}>
        <h1 style={{ margin: 0 }}>Contact</h1>
        <p style={{ margin: 0, color: text.muted }}>
          For support or questions, email support@rentchain.ai.
        </p>
        <p style={{ margin: 0, color: text.muted }}>
          We respond to inquiries during standard business hours.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default ContactPage;
