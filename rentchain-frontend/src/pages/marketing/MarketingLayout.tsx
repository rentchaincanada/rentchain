import React from "react";
import { Link } from "react-router-dom";
import { colors, layout, radius, shadows, spacing, text, typography } from "../../styles/tokens";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
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
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1fr) auto minmax(220px, 1fr)",
            alignItems: "center",
            gap: spacing.lg,
          }}
        >
          <Link
            to="/"
            style={{ fontWeight: 700, textDecoration: "none", color: text.primary, letterSpacing: "0.2px" }}
          >
            RentChain
          </Link>
          <nav style={{ display: "flex", gap: spacing.md, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/" style={{ color: text.muted, textDecoration: "none" }}>
              Home
            </Link>
            <Link to="/about" style={{ color: text.muted, textDecoration: "none" }}>
              About
            </Link>
            <Link to="/pricing" style={{ color: text.muted, textDecoration: "none" }}>
              Pricing
            </Link>
            <Link to="/legal" style={{ color: text.muted, textDecoration: "none" }}>
              Legal &amp; Help
            </Link>
          </nav>
          <div
            style={{
              display: "flex",
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
            <a href="mailto:support@rentchain.ai" style={{ color: text.muted, textDecoration: "none" }}>
              Support
            </a>
            <Link to="/login" style={{ color: text.muted, textDecoration: "none" }}>
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
        </div>
      </header>

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
