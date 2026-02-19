import React, { useEffect } from "react";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useLanguage } from "../../context/LanguageContext";
import { marketingCopy } from "../../content/marketingCopy";

const AboutPage: React.FC = () => {
  const { locale } = useLanguage();
  const copy = marketingCopy[locale];

  useEffect(() => {
    document.title = `${copy.about.headline} - RentChain`;
  }, [copy.about.headline]);

  return (
    <MarketingLayout>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <h1 style={{ margin: 0 }}>{copy.about.headline}</h1>
          <p style={{ margin: 0, color: text.muted }}>{copy.about.story}</p>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>{copy.about.bulletsTitle}</h2>
          <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
            {copy.about.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </Card>
    </MarketingLayout>
  );
};

export default AboutPage;
