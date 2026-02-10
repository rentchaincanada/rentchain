import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { colors, radius, spacing, text, shadows } from "../../styles/tokens";
import { getVisibleNavItems } from "./navConfig";
import { useCapabilities } from "@/hooks/useCapabilities";

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
  const { features } = useCapabilities();
  const visibleItems = getVisibleNavItems(userRole, features);
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

  if (!open) return null;

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 320,
          maxWidth: "90vw",
          maxHeight: "calc(100vh - 24px)",
          background: colors.card,
          borderLeft: `1px solid ${colors.border}`,
          boxShadow: shadows.lg,
          padding: `${spacing.lg} ${spacing.lg} calc(${spacing.lg} + env(safe-area-inset-bottom))`,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          zIndex: 3001,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            background: colors.card,
            paddingBottom: spacing.sm,
            zIndex: 1,
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

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", color: text.muted }}>Pages</div>
        <div style={{ display: "grid", gap: 8 }}>
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

        <div style={{ height: 1, background: colors.border, marginTop: spacing.sm }} />
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
      </div>
    </div>
  );
};
