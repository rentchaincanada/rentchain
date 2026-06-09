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
    title: "Set up your property",
    body: "Add your first property, keep the important details together, and start the workflow without piecing it together across different tools.",
  },
  {
    title: "See what needs attention",
    body: "See what is missing early so tenant work, maintenance follow-up, and rental admin are easier to finish cleanly.",
  },
  {
    title: "Add deeper support when you need it",
    body: "Paid plans add deeper workflow support only when your rental operations outgrow the basics you can already start using now.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What can I use for free?",
    answer:
      "Free lets you organize a property, see what is missing, and try the core workflow before deciding whether you need more support.",
  },
  {
    question: "What unlocks on paid plans?",
    answer:
      "Paid plans unlock stronger day-to-day tools, clearer filing support, safer follow-through, and a better record of what happened over time.",
  },
  {
    question: "Is this available across Canada?",
    answer:
      "Yes. RentChain is built for landlords across Canada. You can use it to organize your properties, manage tenants, and stay on top of what needs attention—no matter where your rentals are located. Some region-specific tools, like lease templates and compliance workflows, vary by province and continue to expand.",
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

const ctaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: spacing.sm,
  alignItems: "center",
};

const ctaButtonStyle: React.CSSProperties = {
  minHeight: 48,
  minWidth: 148,
  padding: "13px 20px",
  fontWeight: 800,
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
    document.title = "RentChain - Keep your rentals organized";
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

  const handleLoginCta = () => {
    navigate("/login");
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
                Built for landlords across Canada
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
                  Keep your rentals organized and your day moving across Canada.
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
                  RentChain helps landlords across Canada stay on top of property details, tenant activity,
                  maintenance, and the tasks that tend to fall through the cracks. When you need deeper
                  lease, filing, or compliance support, those tools can vary by province and continue to expand.
                </p>
                <p
                  style={{
                    margin: 0,
                    color: text.secondary,
                    fontSize: "0.98rem",
                    lineHeight: 1.7,
                    maxWidth: 720,
                    fontWeight: 600,
                  }}
                >
                  Start with your first property, see how the workflow works, and decide on paid plans only after you understand the value inside the product.
                </p>
              </div>
              <div style={ctaRowStyle}>
                <Button
                  type="button"
                  onClick={handlePrimaryCta}
                  aria-label="Sign Up Free"
                  style={ctaButtonStyle}
                >
                  Sign Up Free
                </Button>
                <Button
                  type="button"
                  variant="navy"
                  onClick={handleLoginCta}
                  aria-label="Log In"
                  style={ctaButtonStyle}
                >
                  Log In
                </Button>
                <div style={{ color: text.secondary, fontSize: "0.93rem", fontWeight: 600 }}>
                  No commitment to explore. Start free and upgrade only when your workflow needs more support.
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
                  "Set up your first property and tenant workflow in one place",
                  "See what is missing before it becomes a larger admin problem",
                  "Add deeper workflow support only when you actually need it",
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
                  Get more help as your rental operations get busier.
                </div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
                  Paid plans are for landlords who want cleaner day-to-day control, clearer records, and
                  stronger support when a property task needs follow-through.
                </p>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  "Keep property tasks, notes, and next steps easier to follow",
                  "Get clearer filing support when a jurisdiction requires extra work",
                  "Keep a better record of what was done and what happens next",
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
                <li>Set up your first property and keep the important details together</li>
                <li>Track the basics before a task turns messy</li>
                <li>Use the platform to get organized before paying</li>
                <li>Try the workflow before deciding whether you need more support</li>
              </ul>
            </div>
          </Card>
          <Card style={{ padding: "22px 22px 24px" }}>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <h2 style={sectionHeadingStyle}>Why landlords upgrade</h2>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: text.muted, lineHeight: 1.8 }}>
                <li>Run day-to-day rental work with stronger tools and less friction</li>
                <li>Keep better oversight as you manage more units or properties</li>
                <li>Get clearer filing and compliance support when you need it</li>
                <li>Keep a cleaner record of what was done and what happens next</li>
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
                Start with the free basics
              </div>
              <div
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2rem)",
                  fontWeight: 800,
                  lineHeight: 1.05,
                  fontFamily: typography.fontFamily,
                }}
              >
                Start simple, then grow into the tools you need.
              </div>
              <p style={{ margin: 0, color: text.muted, lineHeight: 1.75, maxWidth: 760 }}>
                Add a property, get organized, and see how the workflow feels in practice. Filing and
                compliance support are there when you need them, but you do not have to learn the whole
                system to get value on day one.
              </p>
            </div>
              <div style={ctaRowStyle}>
                <Button
                  type="button"
                  onClick={handlePrimaryCta}
                  aria-label="Sign Up Free"
                  style={ctaButtonStyle}
                >
                  Sign Up Free
                </Button>
                <Button
                  type="button"
                  variant="navy"
                  onClick={handleLoginCta}
                  aria-label="Log In"
                  style={ctaButtonStyle}
                >
                  Log In
                </Button>
              </div>
          </div>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default LandingPage;
