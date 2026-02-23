import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { colors, radius, spacing, text, shadows } from "../../styles/tokens";
import { getVisibleNavItems } from "./navConfig";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useIsMobile } from "@/hooks/useIsMobile";

type WorkspaceDrawerProps = {
  open: boolean;
  onClose: () => void;
  userEmail?: string | null;
  userRole?: string | null;
  onSignOut?: () => void;
};

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({ open, onClose, userEmail, userRole, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { features, loading: capsLoading } = useCapabilities();
  const isMobile = useIsMobile("(max-width: 1024px)");
  const navLoading = !userRole || capsLoading;
  const visibleItems = navLoading ? [] : getVisibleNavItems(userRole, features);
  const drawerItems = visibleItems.filter((item) => item.showInDrawer !== false);
  const primaryDrawerItems = drawerItems.filter((item) => !item.requiresAdmin);
  const adminDrawerItems = drawerItems.filter((item) => item.requiresAdmin);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const footerContent = (
    <>
      {onSignOut ? (
        <button
          type="button"
          onClick={onSignOut}
          style={{
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: 700,
            textAlign: "left",
          }}
        >
          Sign out
        </button>
      ) : null}
      {userEmail ? <div style={{ fontSize: 12, color: text.muted }}>{userEmail}</div> : null}
    </>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-start",
        overscrollBehavior: "none",
        touchAction: "none",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          touchAction: "none",
          overscrollBehavior: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 320,
          maxWidth: "90vw",
          height: "100dvh",
          maxHeight: "100dvh",
          minHeight: 0,
          background: colors.card,
          borderLeft: `1px solid ${colors.border}`,
          boxShadow: shadows.lg,
          display: "flex",
          flexDirection: "column",
          zIndex: 3001,
          overflow: "hidden",
          overscrollBehaviorY: "contain",
          contain: "layout paint size",
          WebkitOverflowScrolling: "touch",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            flex: "0 0 auto",
            background: colors.card,
            padding: `${spacing.lg} ${spacing.lg} ${spacing.sm}`,
            zIndex: 1,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: text.primary }}>Workspace</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              borderRadius: radius.pill,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorY: "contain",
            touchAction: "pan-y",
            padding: `0 ${spacing.lg}`,
            minHeight: 0,
            maxHeight: "100%",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", color: text.muted, marginBottom: spacing.sm }}>Pages</div>
          <div style={{ display: "grid", gap: 8 }}>
            {navLoading ? (
              <div
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: text.muted,
                  fontWeight: 600,
                }}
              >
                Loading menu...
              </div>
            ) : null}
            {primaryDrawerItems.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => handleNav(link.to)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: radius.md,
                    border: `1px solid ${active ? colors.accent : colors.border}`,
                    background: active ? "rgba(37,99,235,0.08)" : colors.card,
                    color: text.primary,
                    fontWeight: active ? 700 : 600,
                    cursor: "pointer",
                  }}
                >
                  {link.label}
                </button>
              );
            })}
            {adminDrawerItems.length ? (
              <div style={{ height: 1, background: colors.border, margin: `${spacing.xs} 0` }} />
            ) : null}
            {adminDrawerItems.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => handleNav(link.to)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: radius.md,
                    border: `1px solid ${active ? colors.accent : colors.border}`,
                    background: active ? "rgba(37,99,235,0.08)" : colors.card,
                    color: text.primary,
                    fontWeight: active ? 700 : 600,
                    cursor: "pointer",
                  }}
                >
                  {link.label}
                </button>
              );
            })}
          </div>
          {isMobile ? (
            <div
              style={{
                marginTop: spacing.md,
                borderTop: `1px solid ${colors.border}`,
                paddingTop: spacing.sm,
                display: "grid",
                gap: 8,
              }}
            >
              {footerContent}
            </div>
          ) : null}
          <div aria-hidden style={{ height: "calc(84px + env(safe-area-inset-bottom, 0px))" }} />
        </div>
        {!isMobile ? (
          <div
            style={{
              flex: "0 0 auto",
              background: colors.card,
              borderTop: `1px solid ${colors.border}`,
              padding: `${spacing.sm} ${spacing.lg} calc(${spacing.sm} + env(safe-area-inset-bottom))`,
              display: "grid",
              gap: 8,
            }}
          >
            {footerContent}
          </div>
        ) : null}
      </div>
    </div>
  );
};
