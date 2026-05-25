import React, { useEffect, useRef, useState } from "react";
import { FileText, LayoutDashboard, Menu, MessagesSquare, ScrollText, X } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import TopNav from "./TopNav";
import { useAuth } from "../../context/useAuth";
import { fetchLandlordConversations } from "../../api/messagesApi";
import { getVisibleNavItems } from "./navConfig";
import { useCapabilities } from "@/hooks/useCapabilities";
import { UpgradeNudgeHost } from "@/features/upgradeNudges/UpgradeNudgeHost";
import { getRoleDefaultDestination } from "@/lib/authDestination";
import { RentChainLogo } from "../brand/RentChainLogo";
import "./LandlordNav.css";

type Props = {
  children: React.ReactNode;
  unreadMessages?: boolean;
};

const landlordMobileTabs = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Documents", icon: FileText },
  { to: "/leases", label: "Leases", icon: ScrollText },
  { to: "/messages", label: "Messages", icon: MessagesSquare, requiresMessaging: true },
];

function includesAdminAuthority(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => includesAdminAuthority(entry));
  }
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "system.admin";
}

function isAdminContext(user: unknown): boolean {
  const candidate = user as Record<string, any> | null | undefined;
  if (!candidate) return false;
  return (
    includesAdminAuthority(candidate.role) ||
    includesAdminAuthority(candidate.actorRole) ||
    includesAdminAuthority(candidate.permissions) ||
    includesAdminAuthority(candidate.claims?.permissions) ||
    includesAdminAuthority(candidate.claims?.role) ||
    includesAdminAuthority(candidate.claims?.actorRole) ||
    candidate.isAdmin === true ||
    candidate.admin === true
  );
}

export const LandlordNav: React.FC<Props> = ({ children, unreadMessages }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const { logout, user, ready, isLoading, authStatus } = useAuth();
  const { features, loading: capsLoading } = useCapabilities();
  const [hasUnread, setHasUnread] = useState<boolean>(false);
  const unreadFlag = typeof unreadMessages === "boolean" ? unreadMessages : hasUnread;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const navLoading = !ready || isLoading || authStatus === "restoring" || !user || capsLoading;
  const isAdminLikeContext = React.useMemo(() => isAdminContext(user), [user]);
  const effectiveRole = React.useMemo(() => {
    if (navLoading) return "";
    if (isAdminLikeContext) return "admin";
    const actorRole = String(user?.actorRole || "").trim().toLowerCase();
    const role = String(user?.role || "").trim().toLowerCase();
    return actorRole || role || "landlord";
  }, [isAdminLikeContext, navLoading, user?.actorRole, user?.role]);
  const isLandlordWorkspace = effectiveRole === "landlord" || effectiveRole === "admin";
  if (import.meta.env.DEV) {
    console.debug("[nav] role resolved", {
      effectiveRole,
      rawRole: user?.role || null,
      actorRole: user?.actorRole || null,
    });
  }
  const visibleItems = navLoading || !isLandlordWorkspace ? [] : getVisibleNavItems(effectiveRole, features);
  const drawerItems = visibleItems.filter((item) => item.showInDrawer !== false);
  const primaryDrawerItems = drawerItems.filter((item) => !item.requiresAdmin);
  const adminDrawerItems = drawerItems.filter((item) => item.requiresAdmin);
  const orderedPrimaryDrawerItems = React.useMemo(
    () =>
      [...primaryDrawerItems].sort((a, b) => {
        if (a.id === "account") return -1;
        if (b.id === "account") return 1;
        return 0;
      }),
    [primaryDrawerItems]
  );
  const tabItems =
    effectiveRole === "landlord" && !isAdminLikeContext
      ? landlordMobileTabs.filter((item) => !item.requiresMessaging || features?.messaging !== false)
      : [];
  const showMobileBottomNav = effectiveRole === "landlord" && !isAdminLikeContext;
  const shellClassName = [
    "rc-landlord-shell",
    showMobileBottomNav ? "rc-landlord-shell--mobile-tabs" : "",
  ].filter(Boolean).join(" ");
  const contentClassName = [
    "rc-landlord-content",
    loc.pathname.startsWith("/messages") ? "rc-landlord-content--mobile-flush" : "",
  ].filter(Boolean).join(" ");

  const handleDrawerNavigation = (path: string) => {
    setDrawerOpen(false);
    nav(path);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  useEffect(() => {
    let mounted = true;
    if (navLoading || !isLandlordWorkspace || features?.messaging === false) {
      setHasUnread(false);
      return () => {
        mounted = false;
      };
    }
    const load = async () => {
      try {
        const list = await fetchLandlordConversations();
        if (!mounted) return;
        const unread = (list || []).some(
          (c: any) => c?.hasUnread === true || (c?.unreadCount ?? 0) > 0
        );
        setHasUnread(unread);
      } catch {
        if (!mounted) return;
        setHasUnread(false);
      }
    };
    void load();
    const t = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(t);
    };
  }, [features?.messaging, isLandlordWorkspace, navLoading]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      lastFocusedRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (navLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
          fontSize: "0.95rem",
          color: "#0f172a",
          background:
            "radial-gradient(circle at top left, rgba(37,99,235,0.08) 0, rgba(14,165,233,0.06) 45%, rgba(255,255,255,0.9) 100%)",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "min(420px, 90vw)",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            padding: "20px 22px",
            boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Loading your workspace...</div>
          <div style={{ color: "#475569" }}>Confirming your account role.</div>
        </div>
      </div>
    );
  }

  if (!isLandlordWorkspace) {
    return <Navigate to={getRoleDefaultDestination(effectiveRole as any)} replace />;
  }

  return (
    <div className={shellClassName}>
      <div className="rc-landlord-topnav">
        <TopNav />
      </div>

      <div className="rc-landlord-mobile-topbar">
        <RentChainLogo href="/dashboard" size="sm" />
        <span className="rc-landlord-mobile-role">{effectiveRole === "admin" ? "Admin" : "Landlord"}</span>
        <button
          type="button"
          className="rc-landlord-mobile-menu"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="rc-landlord-drawer"
          onClick={(event) => {
            lastFocusedRef.current = event.currentTarget;
            setDrawerOpen(true);
          }}
        >
          <Menu size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div
        className={[
          "rc-landlord-backdrop",
          showMobileBottomNav ? "rc-landlord-backdrop--nav-safe" : "",
          drawerOpen ? "is-open" : "",
        ].filter(Boolean).join(" ")}
        onClick={closeDrawer}
        aria-hidden={!drawerOpen}
      />

      <aside
        id="rc-landlord-drawer"
        className={[
          "rc-landlord-drawer",
          showMobileBottomNav ? "rc-landlord-drawer--nav-safe" : "",
          drawerOpen ? "is-open" : "",
        ].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal={drawerOpen ? "true" : undefined}
        aria-label="Navigation menu"
        aria-hidden={!drawerOpen}
      >
        <div className="rc-landlord-drawer-header">
          <span>Workspace</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeDrawer();
            }}
            aria-label="Close menu"
          >
            Close
          </button>
        </div>
        <div className="rc-landlord-drawer-scroll">
          {navLoading ? (
            <div className="rc-landlord-drawer-links">
              <button type="button" disabled className="active">
                Loading menu...
              </button>
            </div>
          ) : (
            <div className="rc-landlord-drawer-links">
              {orderedPrimaryDrawerItems.map(({ id, to, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleDrawerNavigation(to)}
                  className={loc.pathname.startsWith(to) ? "active" : ""}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="rc-landlord-drawer-divider" />
          <button type="button" className="rc-landlord-drawer-signout" onClick={logout}>
            Sign out
          </button>
          {adminDrawerItems.length ? (
            <div className="rc-landlord-drawer-divider" />
          ) : null}
          {adminDrawerItems.length ? (
            <div className="rc-landlord-drawer-links">
              {adminDrawerItems.map(({ id, to, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleDrawerNavigation(to)}
                  className={loc.pathname.startsWith(to) ? "active" : ""}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </aside>

      <UpgradeNudgeHost />
      <div className={contentClassName}>{children}</div>

      {showMobileBottomNav ? (
        <nav className="rc-landlord-mobile-tabbar" aria-label="Bottom navigation">
          {(navLoading ? [] : tabItems).map(({ to, label, icon: Icon }) => {
            if (!Icon) return null;
            const active = loc.pathname.startsWith(to);
            return (
              <button
                key={to}
                type="button"
                onClick={() => nav(to)}
                className={active ? "active" : ""}
              >
                <Icon size={20} strokeWidth={2.2} />
                <span className="rc-landlord-mobile-tabbar-label">
                  {label}
                  {label === "Messages" && unreadFlag ? (
                    <span className="rc-landlord-mobile-tabbar-dot" />
                  ) : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={(event) => {
              lastFocusedRef.current = event.currentTarget;
              setDrawerOpen((open) => !open);
            }}
            className={drawerOpen ? "active" : ""}
            aria-label="Open workspace pages"
            aria-expanded={drawerOpen}
            aria-controls="rc-landlord-drawer"
          >
            {drawerOpen ? <X size={20} strokeWidth={2.2} /> : <Menu size={20} strokeWidth={2.2} />}
            <span className="rc-landlord-mobile-tabbar-label">More</span>
          </button>
        </nav>
      ) : null}
    </div>
  );
};
