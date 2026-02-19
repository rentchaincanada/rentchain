import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { spacing, text } from "../../styles/tokens";
import { MarketingLayout } from "./MarketingLayout";
import { useAuth } from "../../context/useAuth";
import { useLanguage } from "../../context/LanguageContext";
import { marketingCopy } from "../../content/marketingCopy";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const copy = marketingCopy[locale];

  useEffect(() => {
    document.title = `RentChain - ${copy.home.heroTitle}`;
  }, [copy.home.heroTitle]);

  return (
    <MarketingLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "2.2rem" }}>RentChain</h1>
          <p style={{ margin: 0, color: text.secondary, fontSize: "1.1rem", fontWeight: 600 }}>
            {copy.home.heroTitle}
          </p>
          <p style={{ margin: 0, color: text.muted, fontSize: "1rem", maxWidth: 720 }}>
            {copy.home.heroSubtitle}
          </p>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm }}>
            <Button
              type="button"
              onClick={() => (user?.id ? navigate("/dashboard") : navigate("/signup"))}
            >
              {user?.id ? copy.home.authedPrimaryCta : copy.home.primaryCta}
            </Button>
            {!user?.id ? (
              <Button type="button" variant="secondary" onClick={() => navigate("/login")}>
                {copy.home.secondaryCta}
              </Button>
            ) : null}
            {!user?.id ? (
              <Button type="button" variant="ghost" onClick={() => navigate("/request-access")}>
                {copy.home.requestAccessCta}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => navigate("/site/pricing")}>
                {copy.home.pricingCta}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>{copy.home.heroTitle}</h2>
          <p style={{ color: text.muted, marginTop: 0, marginBottom: spacing.md }}>
            {copy.home.heroSubtitle}
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.7 }}>
            {copy.home.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default LandingPage;
