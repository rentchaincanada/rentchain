import React, { useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Card } from "../../components/ui/Ui";
import { track } from "../../lib/analytics";
import { useAuth } from "../../context/useAuth";
import { MarketingLayout } from "./MarketingLayout";
import { colors, radius, shadows, spacing, text, typography } from "../../styles/tokens";
import { saveRegistryAcquisitionAttribution } from "../../api/propertiesApi";

type HowItWorksStep = {
  title: string;
  body: string;
};

const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: "Prepare your draft",
    body: "Add a property, review prefilled owner details, and build a filing-ready record without leaving the product.",
  },
  {
    title: "See readiness clearly",
    body: "Spot missing fields, declarations, and compliance gaps before you try to file anything.",
  },
  {
    title: "Unlock filing workflow when ready",
    body: "Paid plans add tracked filing steps, retry safety, and attempts history once you move beyond draft prep.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What can I use for free?",
    answer:
      "Free includes draft preparation, readiness checks, JSON export, and ready-package preparation so you can understand your filing position before paying.",
  },
  {
    question: "What unlocks on paid plans?",
    answer:
      "Paid plans unlock the filing workflow, lifecycle tracking, retry safety, and attempts history so you can manage submissions instead of juggling notes and spreadsheets.",
  },
  {
    question: "Is this only for Halifax?",
    answer:
      "Halifax is the first live municipal workflow. Other Canadian properties can still use the registry-ready profile and compliance draft experience today.",
  },
];

function firstQueryValue(search: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = search.get(key);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  lineHeight: 1.2,
};

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
    document.title = "RentChain - Check your property readiness";
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
      // analytics must never interrupt the landing flow
    }

    if (user?.id) {
      navigate("/properties?intent=registry_readiness");
      return;
    }

    navigate("/signup?next=/properties&intent=registry_readiness");
  };

  return (
    <MarketingLayout>
      <div
        style={{
          display: "grid",
          gap: spacing.lg,
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: spacing.lg,
            alignItems: "stretch",
          }}
        >
          <Card
            style={{
              padding: "clamp(22px, 3vw, 36px)",
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(244,247,252,0.96) 55%, rgba(228,239,255,0.92) 100%)",
              border: "1px solid rgba(15,23,42,0.08)",
              boxShadow: shadows.md,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "grid", gap: spacing.md }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.06)",
                  color: text.secondary,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Halifax and Nova Scotia readiness
              </div>
              <div style={{ display: "grid", gap: spacing.sm }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(2.4rem, 5vw, 4rem)",
                    lineHeight: 0.98,
                    letterSpacing: "-0.04em",
                    maxWidth: 760,
                  }}
                >
                  Check whether your property is registry-ready before you file.
                </h1>
                <p
                  style={{
                    margin: 0,
                    color: text.muted,
                    fontSize: "1.06rem",
                    lineHeight: 1.75,
                    maxWidth: 720,
                  }}
                >
                  Build a free registry draft, see what is missing, and export a clean readiness package.
                  When you are ready to move into tracked filing, paid plans unlock the workflow, retry
                  safety, and attempts history.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
                <Button type="button" onClick={handlePrimaryCta}>
                  Check your property readiness
                </Button>
                <div style={{ color: text.secondary, fontSize: "0.93rem", fontWeight: 600 }}>
                  Free to prepare. Upgrade only when you need filing workflow.
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: spacing.sm,
                  marginTop: spacing.xs,
                }}
              >
                {[
                  "Free draft + readiness + export",
                  "Halifax filing workflow on paid plans",
                  "Retry safety and attempts history",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      borderRadius: radius.lg,
                      border: "1px solid rgba(15,23,42,0.08)",
                      background: "rgba(255,255,255,0.76)",
                      padding: "14px 16px",
                      fontWeight: 700,
                      lineHeight: 1.45,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card
            style={{
              padding: "clamp(20px, 2.4vw, 28px)",
              background: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: shadows.md,
            }}
          >
            <div style={{ display: "grid", gap: spacing.md }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.8 }}>
                What landlords upgrade for
              </div>
              <div style={{ display: "grid", gap: spacing.sm }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.25 }}>
                  Turn a prepared draft into a tracked filing workflow.
                </div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
                  Paid workflow keeps submission status, preserves attempt history, and gives you a safer
                  recovery path when a filing needs follow-up or correction.
                </p>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  "Create and manage filing attempts without losing audit history",
                  "Track filed, confirmed, rejected, failed, or cancelled outcomes clearly",
                  "Retry safely when a filing needs to be re-opened or corrected",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      padding: "12px 14px",
                      borderRadius: radius.md,
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: spacing.md,
          }}
        >
          {HOW_IT_WORKS.map((step, index) => (
            <Card key={step.title} style={{ padding: "22px 22px 24px" }}>
              <div style={{ display: "grid", gap: spacing.sm }}>
                <div
                  style={{
                    display: "inline-flex",
                    width: 34,
                    height: 34,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    background: colors.accentSoft,
                    color: colors.accent,
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </div>
                <h2 style={sectionHeadingStyle}>{step.title}</h2>
                <p
                  style={{
                    margin: 0,
                    color: text.muted,
                    lineHeight: 1.7,
                    overflowWrap: "anywhere",
                  }}
                >
                  {step.body}
                </p>
              </div>
            </Card>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: spacing.md,
          }}
        >
          <Card style={{ padding: "22px 22px 24px" }}>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <h2 style={sectionHeadingStyle}>What stays free</h2>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.8 }}>
                <li>Draft preparation with property and contact details</li>
                <li>Readiness summary with missing fields and warnings</li>
                <li>Canonical JSON export for your own records</li>
                <li>Ready-package preparation before you decide to upgrade</li>
              </ul>
            </div>
          </Card>
          <Card style={{ padding: "22px 22px 24px" }}>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <h2 style={sectionHeadingStyle}>Why landlords upgrade</h2>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.8 }}>
                <li>Tracked filing workflow instead of manual notes</li>
                <li>Retry safety when a filing is rejected, failed, or cancelled</li>
                <li>Attempts history and audit trail for operator confidence</li>
                <li>Clear submission lifecycle visibility after filing starts</li>
              </ul>
            </div>
          </Card>
        </section>

        <Card style={{ padding: "24px" }}>
          <div style={{ display: "grid", gap: spacing.md }}>
            <div>
              <h2 style={{ ...sectionHeadingStyle, fontSize: "1.3rem" }}>Frequently asked questions</h2>
            </div>
            <div
              style={{
                display: "grid",
                gap: spacing.md,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              }}
            >
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.question}
                  style={{
                    display: "grid",
                    gap: spacing.xs,
                    padding: "16px 18px",
                    borderRadius: radius.lg,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "rgba(255,255,255,0.72)",
                  }}
                >
                  <div style={{ fontWeight: 800, lineHeight: 1.35 }}>{item.question}</div>
                  <div style={{ color: text.muted, lineHeight: 1.7, overflowWrap: "anywhere" }}>{item.answer}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card
          style={{
            padding: "26px",
            background: "linear-gradient(135deg, rgba(225,234,248,0.9) 0%, rgba(255,255,255,0.92) 100%)",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: spacing.md,
              alignItems: "center",
              justifyItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: spacing.xs }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: text.secondary,
                }}
              >
                Start with the free workflow
              </div>
              <div
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2rem)",
                  fontWeight: 800,
                  lineHeight: 1.05,
                  fontFamily: typography.fontFamily,
                }}
              >
                See what is missing before you file.
              </div>
              <p style={{ margin: 0, color: text.muted, lineHeight: 1.75, maxWidth: 760 }}>
                RentChain is most useful when the workflow starts in the product, not in a generic lead form.
                Add a property, prepare the draft, and let readiness drive the next step.
              </p>
            </div>
            <Button type="button" onClick={handlePrimaryCta}>
              Check your property readiness
            </Button>
          </div>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default LandingPage;
