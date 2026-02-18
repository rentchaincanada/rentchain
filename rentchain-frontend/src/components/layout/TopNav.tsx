// rentchain-frontend/src/components/layout/TopNav.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { WorkspaceDrawer } from "./WorkspaceDrawer";
import { Button } from "../ui/Ui";
import { colors, radius, shadows, spacing, text, layout, blur } from "../../styles/tokens";
import { RentChainLogo } from "../brand/RentChainLogo";
import { billingTierLabel, useBillingStatus } from "@/hooks/useBillingStatus";

function roleLabel(raw: string): string {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "tenant") return "Tenant";
  return "Landlord";
}

const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, ready, isLoading, authStatus } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const authResolved = ready && !isLoading && authStatus !== "restoring" && !!user;
  const effectiveRole = authResolved ? String(user?.actorRole || user?.role || "landlord") : "";
  const billingStatus = useBillingStatus();
  const planLabel = billingTierLabel(billingStatus.tier);
  const roleBadge = authResolved ? roleLabel(effectiveRole) : "Loading...";

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
          paddingTop: "env(safe-area-inset-top)",
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
          <RentChainLogo href="/dashboard" size="sm" />

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: spacing.sm }}>
            <span
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.muted,
                boxShadow: shadows.sm,
                fontWeight: 700,
                fontSize: "0.75rem",
                padding: "8px 10px",
                whiteSpace: "nowrap",
              }}
            >
              Role: {roleBadge}
            </span>
            <button
              type="button"
              onClick={() => navigate("/billing")}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: text.primary,
                boxShadow: shadows.sm,
                fontWeight: 700,
                fontSize: "0.8rem",
                padding: "8px 10px",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
              aria-label={`Current plan ${planLabel}. Open billing`}
            >
              {billingStatus.isLoading ? "Plan..." : planLabel}
            </button>
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
        userRole={authResolved ? effectiveRole : null}
        onSignOut={() => {
          logout();
          navigate("/login");
        }}
      />
    </>
  );
};

export default TopNav;
