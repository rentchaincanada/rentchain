import React, { useEffect } from "react";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useLocale } from "../../i18n";

const AboutPage: React.FC = () => {
  const { t } = useLocale();
  useEffect(() => {
    document.title = `${t("about.title")} — RentChain`;
  }, [t]);

  return (
    <MarketingLayout>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <h1 style={{ margin: 0 }}>{t("about.title")}</h1>
          <p style={{ margin: 0, color: text.muted }}>
            {t("about.p1")}
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            {t("about.p2")}
          </p>
          <p style={{ margin: 0, color: text.muted }}>{t("about.p3")}</p>
          <p style={{ margin: 0, color: text.muted }}>
            {t("about.p4")}
          </p>
          <p style={{ margin: 0, color: text.muted }}>
            {t("about.p5")}
          </p>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: text.secondary }}>
              {t("about.principles")}
            </h2>
            <ul style={{ marginTop: spacing.sm, marginBottom: 0, paddingLeft: "1.1rem", color: text.muted }}>
              <li>{t("about.principle1")}</li>
              <li>{t("about.principle2")}</li>
              <li>{t("about.principle3")}</li>
            </ul>
          </div>
        </div>
      </Card>
    </MarketingLayout>
  );
};

export default AboutPage;
