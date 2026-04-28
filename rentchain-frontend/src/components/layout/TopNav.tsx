// rentchain-frontend/src/components/layout/TopNav.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { WorkspaceDrawer } from "./WorkspaceDrawer";
import { Button } from "../ui/Ui";
import { colors, radius, shadows, spacing, text, layout, blur } from "../../styles/tokens";
import { RentChainLogo } from "../brand/RentChainLogo";
import { fetchLandlordConversations } from "../../api/messagesApi";
import { useCapabilities } from "@/hooks/useCapabilities";

function roleLabel(raw: string): string {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "contractor") return "Contractor";
  if (normalized === "tenant") return "Tenant";
  return "Landlord";
}

const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, ready, isLoading, authStatus } = useAuth();
  const { features } = useCapabilities();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const authResolved = ready && !isLoading && authStatus !== "restoring" && !!user;
  const effectiveRole = React.useMemo(() => {
    if (!authResolved) return "";
    const actorRole = String(user?.actorRole || "").trim().toLowerCase();
    const role = String(user?.role || "").trim().toLowerCase();
    if (actorRole === "admin" || role === "admin") return "admin";
    return actorRole || role || "landlord";
  }, [authResolved, user?.actorRole, user?.role]);
  const roleBadge = authResolved ? roleLabel(effectiveRole) : "Loading...";
  const accountPath = effectiveRole === "contractor" ? "/contractor/profile" : "/account";
  const canShowMessagesShortcut =
    authResolved &&
    (effectiveRole === "landlord" || effectiveRole === "admin") &&
    features?.messaging !== false;

  React.useEffect(() => {
    if (!canShowMessagesShortcut) {
      setHasUnreadMessages(false);
      return;
    }
    let mounted = true;
    const loadUnreadState = async () => {
      try {
        const conversations = await fetchLandlordConversations();
        if (!mounted) return;
        setHasUnreadMessages((conversations || []).some((conversation: any) => conversation?.hasUnread === true));
      } catch {
        if (!mounted) return;
        setHasUnreadMessages(false);
      }
    };
    void loadUnreadState();
    const interval = window.setInterval(loadUnreadState, 30000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [canShowMessagesShortcut]);

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
            {canShowMessagesShortcut ? (
              <Button
                variant="secondary"
                onClick={() => navigate("/messages")}
                aria-label={hasUnreadMessages ? "Messages (unread)" : "Messages"}
                style={{
                  position: "relative",
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  color: text.primary,
                  boxShadow: shadows.sm,
                  fontWeight: 700,
                  paddingRight: hasUnreadMessages ? "16px" : undefined,
                }}
              >
                Messages
                {hasUnreadMessages ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: colors.accent,
                    }}
                  />
                ) : null}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => navigate(accountPath)}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.accent}`,
                background: "rgba(37,99,235,0.12)",
                color: text.primary,
                boxShadow: shadows.sm,
                fontWeight: 700,
              }}
            >
              My Account
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
