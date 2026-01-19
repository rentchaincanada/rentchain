import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { colors, radius, spacing, text, shadows } from "../../styles/tokens";

type WorkspaceDrawerProps = {
  open: boolean;
  onClose: () => void;
  userEmail?: string | null;
  userRole?: string | null;
  onSignOut?: () => void;
};

const links = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/properties", label: "Properties" },
  { path: "/tenants", label: "Tenants" },
  { path: "/payments", label: "Payments" },
  { path: "/applications", label: "Applications" },
  { path: "/billing", label: "Billing" },
  { path: "/maintenance", label: "Maintenance" },
];

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({ open, onClose, userEmail, userRole, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();

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
          height: "100%",
          background: colors.card,
          borderLeft: `1px solid ${colors.border}`,
          boxShadow: shadows.lg,
          padding: spacing.lg,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          zIndex: 3001,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
          {links.map((link) => {
            const active = location.pathname.startsWith(link.path);
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => handleNav(link.path)}
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
          {String(userRole || "").toLowerCase() === "admin" ? (
            <>
              <button
                type="button"
                onClick={() => handleNav("/admin")}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${location.pathname === "/admin" ? colors.accent : colors.border}`,
                  background: location.pathname === "/admin" ? "rgba(37,99,235,0.08)" : colors.card,
                  color: text.primary,
                  fontWeight: location.pathname === "/admin" ? 700 : 600,
                  cursor: "pointer",
                }}
              >
                Admin Dashboard
              </button>
              <button
                type="button"
                onClick={() => handleNav("/admin/verified-screenings")}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${location.pathname.startsWith("/admin/verified-screenings") ? colors.accent : colors.border}`,
                  background: location.pathname.startsWith("/admin/verified-screenings") ? "rgba(37,99,235,0.08)" : colors.card,
                  color: text.primary,
                  fontWeight: location.pathname.startsWith("/admin/verified-screenings") ? 700 : 600,
                  cursor: "pointer",
                }}
              >
                Verified Screenings
              </button>
            </>
          ) : null}
        </div>

        <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
          {userEmail ? <div style={{ fontSize: 12, color: text.muted }}>{userEmail}</div> : null}
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
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
