import React, { useEffect, useRef, useState } from "react";
import { Building2, ClipboardList, Inbox, LayoutDashboard, Menu, ScrollText, X } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
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
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/applications", label: "Applicants", icon: ScrollText },
  { to: "/landlord/unified-inbox", label: "Inbox", icon: Inbox },
  { to: "/operations", label: "Operations", icon: ClipboardList },
];

const stickyWorkspaceIds = new Set([
  "dashboard",
  "operations",
  "properties",
  "tenants",
  "leases",
  "payments",
  "scheduling",
  "unified-inbox",
  "work-orders",
  "delegated-access",
  "pm-company-management",
]);

const workspaceAliases: Array<{ prefix: string; label: string }> = [
  { prefix: "/account/property-manager-companies", label: "PM Companies" },
  { prefix: "/account/delegated-access", label: "Delegate Management" },
  { prefix: "/landlord/inbox", label: "Inbox" },
  { prefix: "/landlord/unified-inbox", label: "Inbox" },
  { prefix: "/work-orders", label: "Work Orders" },
  { prefix: "/maintenance", label: "Maintenance" },
  { prefix: "/scheduling", label: "Scheduling" },
];

function isRouteActive(pathname: string, target: string): boolean {
  return pathname === target || pathname.startsWith(`${target}/`);
}

function resolveWorkspaceLabel(pathname: string, items: Array<{ to: string; label: string }>): string {
  const alias = workspaceAliases.find((entry) => isRouteActive(pathname, entry.prefix));
  if (alias) return alias.label;
  const match = [...items]
    .sort((left, right) => right.to.length - left.to.length)
    .find((item) => isRouteActive(pathname, item.to));
  return match?.label || "Workspace";
}

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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const stickyShellRef = useRef<HTMLDivElement | null>(null);
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
  const workspaceItems = visibleItems.filter((item) => stickyWorkspaceIds.has(item.id));
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
  const workspaceLabel = resolveWorkspaceLabel(loc.pathname, visibleItems);
  const shellClassName = [
    "rc-landlord-shell",
    showMobileBottomNav ? "rc-landlord-shell--mobile-tabs" : "",
  ].filter(Boolean).join(" ");
  const contentClassName = [
    "rc-landlord-content",
    "rc-landlord-content--sticky-offset",
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

  React.useLayoutEffect(() => {
    const shell = shellRef.current;
    const stickyShell = stickyShellRef.current;
    if (!shell || !stickyShell) return undefined;

    const syncStickyOffset = () => {
      const height = Math.ceil(stickyShell.getBoundingClientRect().height);
      if (height > 0) {
        shell.style.setProperty("--rc-landlord-sticky-shell-measured-height", `${height}px`);
      }
    };

    syncStickyOffset();
    window.addEventListener("resize", syncStickyOffset);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncStickyOffset())
        : null;
    observer?.observe(stickyShell);

    return () => {
      window.removeEventListener("resize", syncStickyOffset);
      observer?.disconnect();
    };
  }, [workspaceItems.length, workspaceLabel]);

  if (navLoading) {
    return (
      <div className="rc-landlord-loading-shell">
        <div className="rc-landlord-loading-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Loading your workspace...</div>
          <div className="rc-landlord-loading-copy">Confirming your account role.</div>
        </div>
      </div>
    );
  }

  if (!isLandlordWorkspace) {
    return <Navigate to={getRoleDefaultDestination(effectiveRole as any)} replace />;
  }

  return (
    <div className={shellClassName} ref={shellRef}>
      <div className="rc-landlord-topnav" ref={stickyShellRef}>
        <TopNav />
        <div className="rc-landlord-workspace-bar" aria-label="Workspace context">
          <div className="rc-landlord-workspace-context">
            <span>Current workspace</span>
            <strong>{workspaceLabel}</strong>
          </div>
          <nav className="rc-landlord-workspace-links" aria-label="Workspace navigation">
            {workspaceItems.map(({ id, to, label }) => (
              <Link
                key={id}
                to={to}
                className={isRouteActive(loc.pathname, to) || (id === "unified-inbox" && isRouteActive(loc.pathname, "/landlord/inbox")) ? "active" : ""}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="rc-landlord-mobile-topbar">
        <RentChainLogo href="/dashboard" size="sm" />
        <span className="rc-landlord-mobile-role">{workspaceLabel}</span>
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

      {drawerOpen ? (
        <>
          <div
            className="rc-landlord-backdrop is-open"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          <aside
            id="rc-landlord-drawer"
            className="rc-landlord-drawer is-open"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
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
        </>
      ) : null}

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
