import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { colors, layout, radius, shadows, spacing, text, typography } from "../../styles/tokens";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevMenuOpen = useRef(false);
  const prevBodyOverflow = useRef<string | null>(null);
  const location = useLocation();

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
          zIndex: 10,
          backdropFilter: "blur(12px)",
          background: "rgba(247,249,252,0.9)",
          borderBottom: `1px solid ${colors.border}`,
          paddingTop: "env(safe-area-inset-top)",
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
          }}
        >
          <div style={{ flex: "1 1 0", display: "flex", alignItems: "center" }}>
            <Link
              to="/site"
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
              to="/site/about"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              About
            </Link>
            <Link
              to="/site/pricing"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              Pricing
            </Link>
            <Link
              to="/site/legal"
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
              to="/login"
              style={{ color: text.muted, textDecoration: "none" }}
              onMouseEnter={(e) => onHover(e, true)}
              onMouseLeave={(e) => onHover(e, false)}
            >
              Log in
            </Link>
            <Link
              to="/site/pricing"
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
              Request access
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
                flexWrap: "wrap",
                rowGap: spacing.xs,
                maxWidth: "100%",
              }}
            >
              <Link
                to="/site/pricing"
                style={{
                  color: "#fff",
                  background: colors.accent,
                  padding: "8px 14px",
                  borderRadius: radius.pill,
                  textDecoration: "none",
                  fontWeight: 600,
                  boxShadow: shadows.sm,
                  whiteSpace: "nowrap",
                }}
              >
                Request access
              </Link>
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
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onFocus={(event) => {
                  event.currentTarget.style.boxShadow = shadows.focus;
                }}
                onBlur={(event) => {
                  event.currentTarget.style.boxShadow = "none";
                }}
              >
                Menu
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
                Home
              </Link>
              <Link
                to="/site/about"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/site/pricing"
                style={{ color: text.muted, textDecoration: "none" }}
                onMouseEnter={(e) => onHover(e, true)}
                onMouseLeave={(e) => onHover(e, false)}
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                to="/site/legal"
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
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
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
                to="/site/pricing"
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
                Request access
              </Link>
            </div>
          </div>
        </div>
      ) : null}

        <main
          style={{
            maxWidth: "100vw",
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
              Help Center
            </Link>
            <Link to="/help/templates" style={{ color: text.muted, textDecoration: "none" }}>
              Templates
            </Link>
            <Link to="/privacy" style={{ color: text.muted, textDecoration: "none" }}>
              Privacy
            </Link>
            <Link to="/terms" style={{ color: text.muted, textDecoration: "none" }}>
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
