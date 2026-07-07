import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { saveRegistryAcquisitionAttribution } from "../../api/propertiesApi";
import { useAuth } from "../../context/useAuth";
import { track } from "../../lib/analytics";
import {
  AboutVisionSection,
  AudienceSection,
  FeatureShowcaseSection,
  FinalCtaSection,
  HeroSection,
  LifecycleSection,
  MarketingFooter,
  MarketingHeader,
  OperationalTrustSection,
  PricingStartSection,
  TrustFlowSection,
  WhyRentChainSection,
} from "./landing/LandingSections";
import { landingPageCss } from "./landing/landingPageCss";

function firstQueryValue(search: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = search.get(key);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function ensureMarketingFonts() {
  if (typeof document === "undefined" || document.getElementById("rentchain-marketing-fonts")) {
    return;
  }

  const link = document.createElement("link");
  link.id = "rentchain-marketing-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&family=Source+Serif+4:wght@600;700&display=swap";
  document.head.appendChild(link);
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const acquisition = useMemo(() => {
    const search = new URLSearchParams(location.search);
    return {
      source: firstQueryValue(search, "utm_source", "source"),
      medium: firstQueryValue(search, "utm_medium", "medium"),
      campaign: firstQueryValue(search, "utm_campaign", "campaign"),
      variant: firstQueryValue(search, "utm_content", "variant"),
    };
  }, [location.search]);

  useEffect(() => {
    document.title = "RentChain - Housing operations. Connected.";
    ensureMarketingFonts();
  }, []);

  const handlePrimaryCta = () => {
    saveRegistryAcquisitionAttribution({
      ...acquisition,
      landingPath: `${location.pathname}${location.search}`,
    });

    try {
      track("registry_landing_cta_clicked", {
        source: acquisition.source,
        medium: acquisition.medium,
        campaign: acquisition.campaign,
        variant: acquisition.variant,
        location: "landing_hero",
      });
    } catch {
      // Analytics must never interrupt the landing flow.
    }

    if (user?.id) {
      navigate("/properties?intent=registry_readiness");
      return;
    }

    navigate("/signup?next=/properties&intent=registry_readiness");
  };

  return (
    <div className="rc-landing">
      <style>{landingPageCss}</style>
      <MarketingHeader onPrimaryCta={handlePrimaryCta} />
      <main>
        <HeroSection onPrimaryCta={handlePrimaryCta} />
        <TrustFlowSection />
        <WhyRentChainSection />
        <AudienceSection />
        <LifecycleSection />
        <FeatureShowcaseSection />
        <OperationalTrustSection />
        <PricingStartSection onPrimaryCta={handlePrimaryCta} />
        <AboutVisionSection />
        <FinalCtaSection onPrimaryCta={handlePrimaryCta} />
      </main>
      <MarketingFooter />
    </div>
  );
};

export default LandingPage;
