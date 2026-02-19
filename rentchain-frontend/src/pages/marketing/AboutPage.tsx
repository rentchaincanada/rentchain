import React, { useEffect } from "react";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useLanguage } from "../../context/LanguageContext";

const AboutPage: React.FC = () => {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = t("marketing.about.document_title");
  }, [t]);

  return (
    <MarketingLayout>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <h1 style={{ margin: 0 }}>{t("marketing.about.title")}</h1>
          <p style={{ margin: 0, color: text.muted }}>
            {t("marketing.about.lead")}
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            {t("marketing.about.body1")}
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            {t("marketing.about.body2")}
          </p>

          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>
              {t("marketing.about.building.title")}
            </h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>{t("marketing.about.building.item1")}</li>
              <li>{t("marketing.about.building.item2")}</li>
              <li>{t("marketing.about.building.item3")}</li>
            </ul>
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>
              {t("marketing.about.not.title")}
            </h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>{t("marketing.about.not.item1")}</li>
              <li>{t("marketing.about.not.item2")}</li>
              <li>{t("marketing.about.not.item3")}</li>
            </ul>
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>
              {t("marketing.about.principles.title")}
            </h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>{t("marketing.about.principles.item1")}</li>
              <li>{t("marketing.about.principles.item2")}</li>
              <li>{t("marketing.about.principles.item3")}</li>
              <li>{t("marketing.about.principles.item4")}</li>
            </ul>
          </div>
        </div>
      </Card>
    </MarketingLayout>
  );
};

export default AboutPage;
