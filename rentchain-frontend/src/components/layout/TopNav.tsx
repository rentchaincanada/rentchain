// rentchain-frontend/src/components/layout/TopNav.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { WorkspaceDrawer } from "./WorkspaceDrawer";
import { Button } from "../ui/Ui";
import { colors, radius, shadows, spacing, text, layout, blur } from "../../styles/tokens";
import { RentChainLogo } from "../brand/RentChainLogo";
import { fetchLandlordConversations } from "../../api/messagesApi";
import { useCapabilities } from "@/hooks/useCapabilities";
import "./TopNav.css";

function roleLabel(raw: string): string {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "contractor") return "Contractor";
  if (normalized === "tenant") return "Tenant";
  return "Landlord";
}

function cleanName(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function initialsFromName(value: string): string {
  const parts = cleanName(value).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function initialsFromEmail(value: string): string {
  const localPart = cleanName(value).split("@")[0] || "";
  const parts = localPart.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
  return localPart.slice(0, 1).toUpperCase();
}

function userDisplayName(user: ReturnType<typeof useAuth>["user"]): string {
  return (
    cleanName(user?.verifiedName) ||
    cleanName(user?.displayName) ||
    cleanName(user?.fullName) ||
    cleanName([user?.firstName, user?.lastName].filter(Boolean).join(" ")) ||
    cleanName(user?.name)
  );
}

function userInitials(user: ReturnType<typeof useAuth>["user"]): string {
  const name = userDisplayName(user);
  return initialsFromName(name) || initialsFromEmail(user?.email || "") || "U";
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
  const accountName = userDisplayName(user);
  const accountInitials = userInitials(user);
  const accountButtonLabel = accountName ? `Account menu for ${accountName}` : "Account menu";
  const canShowSchedulingShortcut = authResolved && (effectiveRole === "landlord" || effectiveRole === "admin");
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
        className="rc-top-nav"
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
          className="rc-top-nav-inner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${spacing.sm} ${layout.pagePadding}`,
            gap: spacing.md,
          }}
        >
          <RentChainLogo href="/dashboard" size="sm" />

          <div className="rc-top-nav-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: spacing.sm }}>
            <span
              className="rc-top-nav-role"
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
                className="rc-top-nav-optional-action"
                variant="secondary"
                onClick={() => navigate("/landlord/inbox")}
                aria-label={hasUnreadMessages ? "Inbox (unread)" : "Inbox"}
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
                Inbox
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
            {canShowSchedulingShortcut ? (
              <Button
                className="rc-top-nav-optional-action"
                variant="secondary"
                onClick={() => navigate("/scheduling")}
                style={{
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.accent}`,
                  background: "rgba(37,99,235,0.12)",
                  color: text.primary,
                  boxShadow: shadows.sm,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CalendarDays size={16} aria-hidden="true" />
                Scheduling
              </Button>
            ) : null}
            <Button
              className="rc-top-nav-workspace-button rc-top-nav-account-button"
              variant="secondary"
              aria-label={accountButtonLabel}
              title={accountButtonLabel}
              onClick={() => setDrawerOpen(true)}
              style={{
                width: 42,
                height: 42,
                minWidth: 42,
                padding: 0,
                borderRadius: "50%",
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
                boxShadow: shadows.sm,
                fontWeight: 850,
                letterSpacing: 0,
              }}
            >
              {accountInitials}
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
