import React, { useEffect } from "react";
import { createPortal } from "react-dom";
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
  reserveBottomNavSpace?: boolean;
};

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({
  open,
  onClose,
  userEmail,
  userRole,
  onSignOut,
  reserveBottomNavSpace = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { features, loading: capsLoading } = useCapabilities();
  const isMobile = useIsMobile("(max-width: 1024px)");
  const navLoading = !userRole || capsLoading;
  const visibleItems = navLoading ? [] : getVisibleNavItems(userRole, features);
  const drawerItems = visibleItems.filter((item) => item.showInDrawer !== false);
  const primaryDrawerItems = drawerItems.filter((item) => !item.requiresAdmin);
  const orderedPrimaryDrawerItems = [...primaryDrawerItems].sort((a, b) => {
    if (a.id === "account") return -1;
    if (b.id === "account") return 1;
    return 0;
  });
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
    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const previous = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    };
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";
    return () => {
      bodyStyle.position = previous.position;
      bodyStyle.top = previous.top;
      bodyStyle.left = previous.left;
      bodyStyle.right = previous.right;
      bodyStyle.width = previous.width;
      bodyStyle.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };
  const mobileBottomNavOffset =
    reserveBottomNavSpace
      ? "var(--rc-mobile-drawer-bottom-offset, calc(104px + env(safe-area-inset-bottom, 0px)))"
      : "calc(12px + env(safe-area-inset-bottom, 0px))";

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

  const overlay = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: isMobile ? mobileBottomNavOffset : 0,
        zIndex: "var(--rc-landlord-z-drawer, 4020)",
        display: "flex",
        justifyContent: isMobile ? "center" : "flex-end",
        alignItems: isMobile ? "flex-end" : "flex-start",
        maxWidth: "100%",
        overflow: "hidden",
        overscrollBehavior: "none",
        touchAction: isMobile ? "auto" : "none",
        pointerEvents: "auto",
        isolation: "isolate",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          touchAction: isMobile ? "auto" : "none",
          overscrollBehavior: "none",
          pointerEvents: "auto",
          zIndex: 0,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Workspace navigation"
        style={{
          position: "relative",
          width: isMobile ? "min(420px, calc(100% - 24px))" : 320,
          maxWidth: isMobile ? "min(560px, calc(100% - 24px))" : "90vw",
          height: isMobile ? "auto" : "100dvh",
          maxHeight: isMobile ? `min(calc(100dvh - ${mobileBottomNavOffset} - 16px), 620px)` : "100dvh",
          margin: isMobile ? "0 auto 8px" : 0,
          minHeight: 0,
          minWidth: 0,
          background: colors.card,
          border: isMobile ? `1px solid ${colors.border}` : undefined,
          borderLeft: isMobile ? undefined : `1px solid ${colors.border}`,
          borderRadius: isMobile ? 20 : 0,
          boxShadow: shadows.lg,
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
          overflow: "hidden",
          overscrollBehaviorY: "contain",
          contain: "layout paint",
          isolation: "isolate",
          WebkitOverflowScrolling: "touch",
          paddingTop: isMobile ? 0 : "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          pointerEvents: "auto",
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
          onTouchMove={(event) => event.stopPropagation()}
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorY: "contain",
            touchAction: "pan-y",
          padding: `0 ${isMobile ? spacing.md : spacing.lg}`,
            minHeight: 0,
            maxHeight: "100%",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", color: text.muted, marginBottom: spacing.sm }}>Pages</div>
          <div
            style={{
              display: "grid",
              gap: isMobile ? 10 : 8,
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "1fr",
            }}
          >
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
            {orderedPrimaryDrawerItems.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => handleNav(link.to)}
                  style={{
                    textAlign: isMobile ? "center" : "left",
                    padding: isMobile ? "10px 8px" : "10px 12px",
                    minHeight: isMobile ? 48 : undefined,
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
              <div
                style={{
                  height: 1,
                  background: colors.border,
                  margin: `${spacing.xs} 0`,
                  gridColumn: isMobile ? "1 / -1" : undefined,
                }}
              />
            ) : null}
            {adminDrawerItems.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => handleNav(link.to)}
                  style={{
                    textAlign: isMobile ? "center" : "left",
                    padding: isMobile ? "10px 8px" : "10px 12px",
                    minHeight: isMobile ? 48 : undefined,
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

  return createPortal(overlay, document.body);
};
