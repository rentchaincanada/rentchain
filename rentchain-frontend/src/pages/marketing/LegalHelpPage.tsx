import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import AskRentChainWidget from "../../components/help/AskRentChainWidget";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useLanguage } from "../../context/LanguageContext";
import { marketingCopy } from "../../content/marketingCopy";

const LegalHelpPage: React.FC = () => {
  const { locale } = useLanguage();
  const copy = marketingCopy[locale];

  useEffect(() => {
    document.title = `${copy.legal.headline} - RentChain`;
  }, [copy.legal.headline]);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>{copy.legal.headline}</h1>
          <p style={{ marginTop: spacing.sm, marginBottom: 0, color: text.muted }}>{copy.legal.intro}</p>
        </div>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            {copy.legal.sections.map((section) => (
              <div key={section.title}>
                <h2 style={{ marginTop: 0 }}>{section.title}</h2>
                <p style={{ margin: 0, color: text.muted }}>{section.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{copy.legal.policyTitle}</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
            <li>
              <Link to="/terms" style={{ color: text.secondary }}>
                {copy.legal.policyTerms}
              </Link>
            </li>
            <li>
              <Link to="/privacy" style={{ color: text.secondary }}>
                {copy.legal.policyPrivacy}
              </Link>
            </li>
            <li>
              <Link to="/acceptable-use" style={{ color: text.secondary }}>
                {copy.legal.policyAcceptableUse}
              </Link>
            </li>
          </ul>
        </Card>

        <div>
          <h2 style={{ marginTop: 0 }}>{copy.legal.assistanceTitle}</h2>
          <AskRentChainWidget compact defaultOpen={false} />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default LegalHelpPage;
