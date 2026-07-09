import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  colors as baseColors,
  layout,
  radius,
  shadows as baseShadows,
  spacing,
  text as baseText,
  typography,
} from "../../styles/tokens";
import { useAuth } from "../../context/useAuth";
import { useLanguage } from "../../context/LanguageContext";
import { RentChainLogo } from "../../components/brand/RentChainLogo";
import { marketingCopy } from "../../content/marketingCopy";

type MarketingLayoutTone = "default" | "warmNeutral";

interface MarketingLayoutProps {
  children: React.ReactNode;
  tone?: MarketingLayoutTone;
}

const warmMarketingColors = {
  ...baseColors,
  bg: "#f4efe6",
  bgAmbient:
    "radial-gradient(circle at 12% 10%, rgba(215, 173, 107, 0.18), transparent 30%), linear-gradient(135deg, #f4efe6 0%, #efe6d7 48%, #f8f3ea 100%)",
  panel: "#fffaf1",
  card: "#fffaf1",
  bgElevated: "#fff7ea",
  border: "rgba(105, 82, 49, 0.2)",
  borderStrong: "rgba(105, 82, 49, 0.34)",
  accent: "#171411",
  accentSoft: "rgba(36, 88, 66, 0.14)",
  navy: "#245842",
  navySoft: "rgba(36, 88, 66, 0.14)",
};

const warmMarketingText = {
  ...baseText,
  primary: "#171411",
  secondary: "#2c2924",
  muted: "#5f5a51",
  subtle: "#756f64",
};

const warmMarketingShadows = {
  ...baseShadows,
  sm: "0 8px 18px rgba(69, 55, 33, 0.09)",
  md: "0 22px 52px rgba(69, 55, 33, 0.14)",
  focus: "0 0 0 3px rgba(105, 82, 49, 0.22)",
};

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children, tone = "default" }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevMenuOpen = useRef(false);
  const prevBodyOverflow = useRef<string | null>(null);
  const location = useLocation();
  const { user } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const copy = marketingCopy[locale];
  const isAuthed = Boolean(user?.id);
  const colors = tone === "warmNeutral" ? warmMarketingColors : baseColors;
  const text = tone === "warmNeutral" ? warmMarketingText : baseText;
  const shadows = tone === "warmNeutral" ? warmMarketingShadows : baseShadows;

  const localeButtonStyle = (active: boolean) => ({
    border: "none",
    background: active ? colors.accentSoft : "transparent",
    color: active ? text.primary : text.muted,
    borderRadius: radius.pill,
    padding: "4px 10px",
    cursor: "pointer",
    fontWeight: 600,
  });

  const primaryNavCtaStyle: React.CSSProperties = {
    color: "#fff",
    background: colors.accent,
    padding: "9px 16px",
    borderRadius: radius.pill,
    textDecoration: "none",
    fontWeight: 700,
    boxShadow: shadows.sm,
    whiteSpace: "nowrap",
  };

  const outlinedNavCtaStyle: React.CSSProperties = {
    color: text.primary,
    border: `1px solid ${colors.navy}`,
    background: colors.panel,
    padding: "9px 16px",
    borderRadius: radius.pill,
    textDecoration: "none",
    fontWeight: 700,
    boxShadow: shadows.sm,
    whiteSpace: "nowrap",
  };

  const onHover = (event: React.MouseEvent<HTMLElement>, active: boolean) => {
    event.currentTarget.style.color = active ? text.primary : text.muted;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) {
        setMenuOpen(false);
      }
    };
    update();
    const legacy = media as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    if (typeof legacy.addEventListener === "function") {
      legacy.addEventListener("change", update);
      return () => legacy.removeEventListener("change", update);
    }
    if (typeof legacy.addListener === "function") {
      legacy.addListener(update);
      return () => legacy.removeListener?.(update);
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      setMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isMobile) return;
    if (!menuOpen && prevMenuOpen.current) {
      menuButtonRef.current?.focus();
    }
    prevMenuOpen.current = menuOpen;
  }, [menuOpen, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    if (menuOpen) {
      if (typeof document !== "undefined") {
        prevBodyOverflow.current = document.body.style.overflow || "";
        document.body.style.overflow = "hidden";
      }
      return;
    }
    if (typeof document !== "undefined") {
      document.body.style.overflow = prevBodyOverflow.current ?? "";
      prevBodyOverflow.current = null;
    }
  }, [menuOpen, isMobile]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        backgroundImage: colors.bgAmbient,
        color: text.primary,
        fontFamily: typography.fontFamily,
        overflowX: "hidden",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1200,
          background: colors.bg,
          borderBottom: `1px solid ${colors.border}`,
          paddingTop: "env(safe-area-inset-top)",
          boxShadow: shadows.sm,
        }}
      >
        <div
          style={{
            maxWidth: layout.maxWidth,
            width: "100%",
            margin: "0 auto",
            padding: `${spacing.md} clamp(12px, 4vw, ${layout.pagePadding})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.lg,
            minWidth: 0,
            boxSizing: "border-box",
            flexWrap: isMobile ? "wrap" : "nowrap",
            minHeight: isMobile ? 76 : 88,
          }}
        >
          <div style={{ flex: "1 1 0", display: "flex", alignItems: "center" }}>
            <RentChainLogo href="/" size="md" />
          </div>
          <nav
            style={{
              flex: "1 1 auto",
              display: isMobile ? "none" : "flex",
              justifyContent: "center",
              gap: "24px",
              fontWeight: 500,
              color: text.muted,
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/site/pricing"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              {t("nav.pricing")}
            </Link>
            <Link
              to="/site/legal"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              {t("nav.legal")}
            </Link>
          </nav>
          <div
            style={{
              flex: "1 1 0",
              display: isMobile ? "none" : "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: spacing.xs,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.pill,
                padding: "4px 6px",
                fontSize: "0.85rem",
                color: text.muted,
                background: colors.panel,
              }}
            >
              <button
                type="button"
                style={localeButtonStyle(locale === "en")}
                aria-pressed={locale === "en"}
                onClick={() => setLocale("en")}
              >
                EN
              </button>
              <span style={{ color: text.subtle }}>/</span>
              <button
                type="button"
                style={localeButtonStyle(locale === "fr")}
                aria-pressed={locale === "fr"}
                onClick={() => setLocale("fr")}
              >
                FR
              </button>
            </div>
            {isAuthed ? (
              <Link
                to="/dashboard"
                style={{
                  color: "#fff",
                  background: colors.accent,
                  padding: "8px 14px",
                  borderRadius: radius.pill,
                  textDecoration: "none",
                  fontWeight: 600,
                  boxShadow: shadows.sm,
                }}
              >
                {t("nav.dashboard")}
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  style={primaryNavCtaStyle}
                >
                  {t("nav.sign_up_free")}
                </Link>
                <Link
                  to="/login"
                  style={outlinedNavCtaStyle}
                >
                  {t("nav.login")}
                </Link>
              </>
            )}
          </div>
          {isMobile ? (
            <div
              style={{
                flex: "1 1 0",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: spacing.sm,
                flexWrap: "wrap",
                rowGap: spacing.xs,
                maxWidth: "100%",
              }}
            >
              <Link
                to={isAuthed ? "/dashboard" : "/signup"}
                style={primaryNavCtaStyle}
                >
                {isAuthed ? t("nav.dashboard") : t("nav.sign_up_free")}
              </Link>
              {!isAuthed ? (
                <Link
                  to="/login"
                  style={outlinedNavCtaStyle}
                >
                  {t("nav.login")}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                ref={menuButtonRef}
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  color: text.primary,
                  borderRadius: radius.pill,
                  padding: "8px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  outline: "none",
                  whiteSpace: "nowrap",
                }}
                aria-expanded={menuOpen}
                aria-controls="marketing-header-menu"
                aria-label={menuOpen ? t("nav.close_menu") : t("nav.open_menu")}
                onFocus={(event) => {
                  event.currentTarget.style.boxShadow = shadows.focus;
                }}
                onBlur={(event) => {
                  event.currentTarget.style.boxShadow = "none";
                }}
              >
                {t("nav.menu")}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {isMobile && menuOpen ? (
        <div
          role="presentation"
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.18)",
            zIndex: 5,
          }}
        />
      ) : null}
      {isMobile && menuOpen ? (
        <div
          id="marketing-header-menu"
          style={{
            borderBottom: `1px solid ${colors.border}`,
            background: colors.panel,
            position: "relative",
            zIndex: 6,
            overflowX: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: layout.maxWidth,
              width: "100%",
              margin: "0 auto",
              padding: `${spacing.md} ${layout.pagePadding}`,
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, fontWeight: 500 }}>
              <Link
                to="/site"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                {t("nav.home")}
              </Link>
              <Link
                to="/site/pricing"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                {t("nav.pricing")}
              </Link>
              <Link
                to="/site/legal"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                {t("nav.legal")}
              </Link>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: spacing.sm,
                alignItems: "center",
                width: "100%",
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: spacing.xs,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.pill,
                  padding: "4px 6px",
                  fontSize: "0.85rem",
                  color: text.muted,
                  background: colors.panel,
                }}
              >
                <button
                  type="button"
                  style={localeButtonStyle(locale === "en")}
                  aria-pressed={locale === "en"}
                  onClick={() => setLocale("en")}
                >
                  EN
                </button>
                <span style={{ color: text.subtle }}>/</span>
                <button
                  type="button"
                  style={localeButtonStyle(locale === "fr")}
                  aria-pressed={locale === "fr"}
                  onClick={() => setLocale("fr")}
                >
                  FR
                </button>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: spacing.sm,
                alignItems: "center",
                width: "100%",
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              {isAuthed ? (
                <Link
                  to="/dashboard"
                  style={{
                    color: "#fff",
                    background: colors.accent,
                    padding: "8px 14px",
                    borderRadius: radius.pill,
                    textDecoration: "none",
                    fontWeight: 600,
                    boxShadow: shadows.sm,
                    maxWidth: "100%",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  {t("nav.dashboard")}
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    style={{
                      color: "#fff",
                      background: colors.accent,
                      padding: "8px 14px",
                      borderRadius: radius.pill,
                      textDecoration: "none",
                      fontWeight: 600,
                      boxShadow: shadows.sm,
                      maxWidth: "100%",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t("nav.sign_up_free")}
                  </Link>
                  <Link
                    to="/request-access"
                    style={{
                      color: text.primary,
                      border: `1px solid ${colors.border}`,
                      background: colors.panel,
                      padding: "8px 14px",
                      borderRadius: radius.pill,
                      textDecoration: "none",
                      fontWeight: 600,
                      maxWidth: "100%",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t("nav.request_access")}
                  </Link>
                  <Link
                    to="/invite"
                    style={{
                      color: text.muted,
                      textDecoration: "none",
                      maxWidth: "100%",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                    onMouseEnter={(e) => onHover(e, true)}
                    onMouseLeave={(e) => onHover(e, false)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t("nav.have_invite")}
                  </Link>
                  <Link
                    to="/login"
                    style={{
                      color: text.muted,
                      textDecoration: "none",
                      maxWidth: "100%",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                    onMouseEnter={(e) => onHover(e, true)}
                    onMouseLeave={(e) => onHover(e, false)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t("nav.login")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

        <main
          style={{
            maxWidth: "100%",
            width: "100%",
            margin: "0 auto",
            padding: `clamp(16px, 4vw, 40px) ${layout.pagePadding}`,
            boxSizing: "border-box",
          }}
        >
        <div
          style={{
            background: colors.panel,
            borderRadius: radius.xl,
            boxShadow: shadows.md,
            border: `1px solid ${colors.border}`,
            padding: "clamp(20px, 6vw, 48px)",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          {children}
        </div>
      </main>

      <section
        style={{
          maxWidth: layout.maxWidth,
          width: "100%",
          margin: "0 auto",
          padding: `0 ${layout.pagePadding} ${spacing.xl}`,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.xl,
            background: colors.panel,
            boxShadow: shadows.sm,
            padding: "clamp(20px, 5vw, 32px)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "clamp(1.3rem, 2.5vw, 1.8rem)", color: text.primary }}>
            {copy.trust.testimonialsTitle}
          </h2>
          <p style={{ margin: `${spacing.sm} 0 ${spacing.lg}`, color: text.muted, maxWidth: "68ch" }}>
            {copy.trust.testimonialsSubtitle}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            {copy.trust.testimonials.map((item) => (
              <article
                key={`${item.author}-${item.role}`}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.lg,
                  background: colors.bgElevated,
                  padding: spacing.md,
                }}
              >
                <p style={{ margin: 0, color: text.primary, lineHeight: 1.6 }}>"{item.quote}"</p>
                <p style={{ margin: `${spacing.sm} 0 0`, color: text.muted, fontWeight: 600 }}>
                  {item.author}
                </p>
                <p style={{ margin: `${spacing.xs} 0 0`, color: text.subtle, fontSize: "0.88rem" }}>
                  {item.role}
                </p>
              </article>
            ))}
          </div>
          <p style={{ margin: 0, color: text.primary, fontWeight: 600 }}>{copy.trust.credibilityLine}</p>
        </div>
      </section>

      <footer
        style={{
          textAlign: "center",
          padding: `${spacing.lg} ${layout.pagePadding}`,
          color: text.subtle,
          fontSize: "0.85rem",
        }}
      >
        <div
          style={{
            maxWidth: layout.maxWidth,
            width: "100%",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            flexWrap: "wrap",
          }}
        >
          <span>&copy; RentChain</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.md,
              flexWrap: "wrap",
            }}
          >
            <Link to="/legal" style={{ color: text.muted, textDecoration: "none" }}>
              {t("footer.help_center")}
            </Link>
            <Link to="/help/templates" style={{ color: text.muted, textDecoration: "none" }}>
              {t("footer.templates")}
            </Link>
            <Link to="/privacy" style={{ color: text.muted, textDecoration: "none" }}>
              {t("footer.privacy")}
            </Link>
            <Link to="/terms" style={{ color: text.muted, textDecoration: "none" }}>
              {t("footer.terms")}
            </Link>
            <a href="https://status.rentchain.ai" style={{ color: text.muted, textDecoration: "none" }}>
              System Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
