import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { useLanguage } from "../../context/LanguageContext";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    document.title = `RentChain — ${t("home.tagline")}`;
  }, [t]);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "2.2rem" }}>RentChain</h1>
          <p style={{ margin: 0, color: text.secondary, fontSize: "1.1rem", fontWeight: 600 }}>
            {t("home.tagline")}
          </p>
          <p style={{ margin: 0, color: text.muted, fontSize: "1rem", maxWidth: 720 }}>
            {t("home.intro")}
          </p>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm }}>
            <Button
              type="button"
              onClick={() => (user?.id ? navigate("/dashboard") : navigate("/signup"))}
            >
              {user?.id ? t("home.cta.dashboard") : t("nav.sign_up_free")}
            </Button>
            {!user?.id ? (
              <Button type="button" variant="secondary" onClick={() => navigate("/login")}>
                {t("home.cta.signin")}
              </Button>
            ) : null}
            {!user?.id ? (
              <Button type="button" variant="ghost" onClick={() => navigate("/request-access")}>
                {t("home.cta.request_access")}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => navigate("/site/pricing")}>
                {t("home.cta.pricing")}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("home.landlords.title")}</h2>
          <h3 style={{ marginTop: 0, color: text.secondary }}>
            {t("home.landlords.subtitle")}
          </h3>
          <p style={{ color: text.muted, marginBottom: spacing.md }}>
            {t("home.landlords.body")}
          </p>
          <p style={{ color: text.muted, margin: 0 }}>
            {t("home.landlords.footer")}
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("home.tenants.title")}</h2>
          <h3 style={{ marginTop: 0, color: text.secondary }}>
            {t("home.tenants.subtitle")}
          </h3>
          <p style={{ color: text.muted, marginBottom: spacing.md }}>
            {t("home.tenants.body")}
          </p>
          <p style={{ color: text.muted, margin: 0 }}>
            {t("home.tenants.footer")}
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>{t("home.what.title")}</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
            <li>{t("home.what.item1")}</li>
            <li>{t("home.what.item2")}</li>
            <li>{t("home.what.item3")}</li>
            <li>{t("home.what.item4")}</li>
            <li>{t("home.what.item5")}</li>
          </ul>
          <p style={{ color: text.muted, marginTop: spacing.md, marginBottom: 0 }}>
            {t("home.what.footer")}
          </p>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default LandingPage;
