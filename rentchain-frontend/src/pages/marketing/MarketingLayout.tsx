import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { colors, layout, radius, shadows, spacing, text, typography } from "../../styles/tokens";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    if ("addEventListener" in media) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        backgroundImage: colors.bgAmbient,
        color: text.primary,
        fontFamily: typography.fontFamily,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(12px)",
          background: "rgba(247,249,252,0.9)",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            maxWidth: layout.maxWidth,
            margin: "0 auto",
            padding: `${spacing.md} ${layout.pagePadding}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.lg,
          }}
        >
          <div style={{ flex: "1 1 0", display: "flex", alignItems: "center" }}>
            <Link
              to="/"
              style={{ fontWeight: 700, textDecoration: "none", color: text.primary, letterSpacing: "0.2px" }}
            >
              RentChain
            </Link>
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
              to="/"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              Home
            </Link>
            <Link
              to="/about"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              About
            </Link>
            <Link
              to="/pricing"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              Pricing
            </Link>
            <Link
              to="/legal"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              Legal &amp; Help
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
                style={{
                  border: "none",
                  background: colors.accentSoft,
                  color: text.primary,
                  borderRadius: radius.pill,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                aria-pressed="true"
              >
                EN
              </button>
              <span style={{ color: text.subtle }}>/</span>
              {/* TODO: Wire FR toggle once i18n is available. */}
              <button
                type="button"
                style={{
                  border: "none",
                  background: "transparent",
                  color: text.muted,
                  borderRadius: radius.pill,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                aria-pressed="false"
              >
                FR
              </button>
            </div>
            <Link
              to="/legal"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              Support
            </Link>
            <Link
              to="/login"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              Log in
            </Link>
            <Link
              to="/login"
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
              Get Started
            </Link>
          </div>
          {isMobile ? (
            <div
              style={{
                flex: "1 1 0",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Link
                to="/login"
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
                Get Started
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  color: text.primary,
                  borderRadius: radius.pill,
                  padding: "8px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                aria-expanded={menuOpen}
                aria-label="Toggle navigation menu"
              >
                Menu
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {isMobile && menuOpen ? (
        <div
          style={{
            borderBottom: `1px solid ${colors.border}`,
            background: colors.panel,
          }}
        >
          <div
            style={{
              maxWidth: layout.maxWidth,
              margin: "0 auto",
              padding: `${spacing.md} ${layout.pagePadding}`,
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, fontWeight: 500 }}>
              <Link
                to="/"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/about"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/pricing"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                to="/legal"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                Legal &amp; Help
              </Link>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
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
                  style={{
                    border: "none",
                    background: colors.accentSoft,
                    color: text.primary,
                    borderRadius: radius.pill,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  aria-pressed="true"
                >
                  EN
                </button>
                <span style={{ color: text.subtle }}>/</span>
                {/* TODO: Wire FR toggle once i18n is available. */}
                <button
                  type="button"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: text.muted,
                    borderRadius: radius.pill,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  aria-pressed="false"
                >
                  FR
                </button>
              </div>
              <Link
                to="/legal"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                Support
              </Link>
              <Link
                to="/login"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/login"
                style={{
                  color: "#fff",
                  background: colors.accent,
                  padding: "8px 14px",
                  borderRadius: radius.pill,
                  textDecoration: "none",
                  fontWeight: 600,
                  boxShadow: shadows.sm,
                }}
                onClick={() => setMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <main
        style={{
          maxWidth: layout.maxWidth,
          margin: "0 auto",
          padding: `${spacing.xl} ${layout.pagePadding}`,
        }}
      >
        <div
          style={{
            background: colors.panel,
            borderRadius: radius.xl,
            boxShadow: shadows.md,
            border: `1px solid ${colors.border}`,
            padding: spacing.xxl,
          }}
        >
          {children}
        </div>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: `${spacing.lg} ${layout.pagePadding}`,
          color: text.subtle,
          fontSize: "0.85rem",
        }}
      >
        © RentChain
      </footer>
    </div>
  );
};
