import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import AskRentChainWidget from "../../components/help/AskRentChainWidget";
import { Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useLanguage } from "../../context/LanguageContext";

const LegalHelpPage: React.FC = () => {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = t("marketing.legal.document_title");
  }, [t]);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div>
          <h1 style={{ margin: 0 }}>{t("marketing.legal.title")}</h1>
        </div>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <div>
              <h2 style={{ marginTop: 0 }}>{t("marketing.legal.privacy.title")}</h2>
              <p style={{ margin: 0, color: text.muted }}>
                {t("marketing.legal.privacy.body")}
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>{t("marketing.legal.consent.title")}</h2>
              <p style={{ margin: 0, color: text.muted }}>
                {t("marketing.legal.consent.body")}
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>{t("marketing.legal.screening.title")}</h2>
              <p style={{ margin: 0, color: text.muted }}>
                {t("marketing.legal.screening.body1")}
              </p>
              <p style={{ marginTop: spacing.sm, marginBottom: 0, color: text.muted }}>
                {t("marketing.legal.screening.body2")}
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>{t("marketing.legal.blackbox.title")}</h2>
              <p style={{ margin: 0, color: text.muted }}>
                {t("marketing.legal.blackbox.body")}
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>{t("marketing.legal.platform.title")}</h2>
              <p style={{ margin: 0, color: text.muted }}>
                {t("marketing.legal.platform.body")}
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>{t("marketing.legal.security.title")}</h2>
              <p style={{ margin: 0, color: text.muted }}>
                {t("marketing.legal.security.body")}
              </p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>{t("marketing.legal.contact.title")}</h2>
              <p style={{ margin: 0, color: text.muted }}>{t("marketing.legal.contact.privacy")}</p>
              <p style={{ marginTop: spacing.xs, marginBottom: 0, color: text.muted }}>
                {t("marketing.legal.contact.support")}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("marketing.legal.policies.title")}</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted }}>
            <li>
              <Link to="/terms" style={{ color: text.secondary }}>
                {t("marketing.legal.policies.terms")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" style={{ color: text.secondary }}>
                {t("marketing.legal.policies.privacy")}
              </Link>
            </li>
            <li>
              <Link to="/acceptable-use" style={{ color: text.secondary }}>
                {t("marketing.legal.policies.acceptable")}
              </Link>
            </li>
          </ul>
        </Card>

        <div>
          <h2 style={{ marginTop: 0 }}>{t("marketing.legal.assistance.title")}</h2>
          <AskRentChainWidget compact defaultOpen={false} />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default LegalHelpPage;
