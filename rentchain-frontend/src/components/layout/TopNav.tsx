// rentchain-frontend/src/components/layout/TopNav.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { WorkspaceDrawer } from "./WorkspaceDrawer";
import { Button } from "../ui/Ui";
import { colors, radius, shadows, spacing, text, layout, blur } from "../../styles/tokens";

const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2000,
          background: "#fff",
          borderBottom: `1px solid ${colors.border}`,
          boxShadow: shadows.sm,
          backdropFilter: blur.sm,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${spacing.sm} ${layout.pagePadding}`,
            gap: spacing.md,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "999px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: colors.accentSoft,
                boxShadow: shadows.sm,
                color: text.primary,
                fontWeight: 700,
                fontSize: "0.95rem",
              }}
            >
              R
            </span>
            <span style={{ color: text.primary, fontWeight: 700 }}>RentChain</span>
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: spacing.sm }}>
            <Button
              variant="ghost"
              onClick={() => navigate("/site")}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: text.primary,
                boxShadow: shadows.sm,
              }}
            >
              About RentChain
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDrawerOpen(true)}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
                boxShadow: shadows.sm,
              }}
            >
              Workspace
            </Button>
          </div>
        </div>
      </header>

      <WorkspaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userEmail={user?.email || ""}
        userRole={user?.role || ""}
        onSignOut={() => {
          logout();
          navigate("/login");
        }}
      />
    </>
  );
};

export default TopNav;
