import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import AskRentChainWidget from "../../components/help/AskRentChainWidget";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useLanguage } from "../../context/LanguageContext";
import { marketingCopy } from "../../content/marketingCopy";

const legalWarmCardStyle: React.CSSProperties = {
  background: "#fffaf1",
  border: "1px solid rgba(105, 82, 49, 0.2)",
  boxShadow: "0 18px 42px rgba(69, 55, 33, 0.12)",
  color: "#171411",
};

const legalWarmLinkStyle: React.CSSProperties = {
  color: "#245842",
  fontWeight: 700,
  textUnderlineOffset: 3,
};

const LegalHelpPage: React.FC = () => {
  const { locale } = useLanguage();
  const copy = marketingCopy[locale];

  useEffect(() => {
    document.title = `${copy.legal.headline} - RentChain`;
  }, [copy.legal.headline]);

  return (
    <MarketingLayout tone="warmNeutral">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>{copy.legal.headline}</h1>
          <p style={{ marginTop: spacing.sm, marginBottom: 0, color: "#5f5a51" }}>{copy.legal.intro}</p>
        </div>

        <Card style={legalWarmCardStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            {copy.legal.sections.map((section) => (
              <div key={section.title}>
                <h2 style={{ marginTop: 0 }}>{section.title}</h2>
                <p style={{ margin: 0, color: "#5f5a51" }}>{section.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card style={legalWarmCardStyle}>
          <h2 style={{ marginTop: 0 }}>{copy.legal.policyTitle}</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#5f5a51" }}>
            <li>
              <Link to="/terms" style={legalWarmLinkStyle}>
                {copy.legal.policyTerms}
              </Link>
            </li>
            <li>
              <Link to="/privacy" style={legalWarmLinkStyle}>
                {copy.legal.policyPrivacy}
              </Link>
            </li>
            <li>
              <Link to="/acceptable-use" style={legalWarmLinkStyle}>
                {copy.legal.policyAcceptableUse}
              </Link>
            </li>
          </ul>
        </Card>

        <div>
          <h2 style={{ marginTop: 0 }}>{copy.legal.assistanceTitle}</h2>
          <AskRentChainWidget compact defaultOpen={false} tone="warmNeutral" />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default LegalHelpPage;
