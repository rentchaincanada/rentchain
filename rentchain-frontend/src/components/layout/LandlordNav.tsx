import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TopNav from "./TopNav";
import { useAuth } from "../../context/useAuth";
import { fetchLandlordConversations } from "../../api/messagesApi";
import { getVisibleNavItems } from "./navConfig";
import { useCapabilities } from "@/hooks/useCapabilities";
import { billingTierLabel, useBillingStatus } from "@/hooks/useBillingStatus";
import { UpgradeNudgeHost } from "@/features/upgradeNudges/UpgradeNudgeHost";
import "./LandlordNav.css";

type Props = {
  children: React.ReactNode;
  unreadMessages?: boolean;
};

export const LandlordNav: React.FC<Props> = ({ children, unreadMessages }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const { logout, user, ready } = useAuth();
  const { features } = useCapabilities();
  const billingStatus = useBillingStatus();
  const planLabel = billingTierLabel(billingStatus.tier);
  const [hasUnread, setHasUnread] = useState<boolean>(false);
  const unreadFlag = typeof unreadMessages === "boolean" ? unreadMessages : hasUnread;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const effectiveRole = String(user?.actorRole || user?.role || "landlord");
  if (import.meta.env.DEV) {
    console.debug("[nav] role resolved", {
      effectiveRole,
      rawRole: user?.role || null,
      actorRole: user?.actorRole || null,
    });
  }
  const visibleItems = ready ? getVisibleNavItems(effectiveRole, features) : [];
  const drawerItems = visibleItems.filter((item) => item.showInDrawer !== false);
  const primaryDrawerItems = drawerItems.filter((item) => !item.requiresAdmin);
  const adminDrawerItems = drawerItems.filter((item) => item.requiresAdmin);
  const tabItems = visibleItems.filter((item) => item.showInTabs);

  useEffect(() => {
    let mounted = true;
    if (features?.messaging === false) {
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
  }, [features?.messaging]);

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

  return (
    <div className="rc-landlord-shell">
      <div className="rc-landlord-topnav">
        <TopNav />
      </div>

      <button
        type="button"
        className="rc-landlord-plan-badge"
        onClick={() => nav("/billing")}
        aria-label={`Current plan ${planLabel}. Open billing`}
      >
        {billingStatus.isLoading ? "Plan..." : planLabel}
      </button>

      <button
        type="button"
        className="rc-landlord-hamburger"
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        aria-controls="rc-landlord-drawer"
        onClick={(event) => {
          lastFocusedRef.current = event.currentTarget;
          setDrawerOpen(true);
        }}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        className={`rc-landlord-backdrop ${drawerOpen ? "is-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />

      <aside
        id="rc-landlord-drawer"
        className={`rc-landlord-drawer ${drawerOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="rc-landlord-drawer-header">
          <span>Workspace</span>
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            Close
          </button>
        </div>
        <div className="rc-landlord-drawer-scroll">
          <div className="rc-landlord-drawer-links">
            {primaryDrawerItems.map(({ to, label }) => (
              <button
                key={to}
                type="button"
                onClick={() => nav(to)}
                className={loc.pathname.startsWith(to) ? "active" : ""}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rc-landlord-drawer-divider" />
          <button type="button" className="rc-landlord-drawer-signout" onClick={logout}>
            Sign out
          </button>
          {adminDrawerItems.length ? (
            <div className="rc-landlord-drawer-divider" />
          ) : null}
          {adminDrawerItems.length ? (
            <div className="rc-landlord-drawer-links">
              {adminDrawerItems.map(({ to, label }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => nav(to)}
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
      <div className="rc-landlord-content">{children}</div>

      <nav className="rc-mobile-tabbar" aria-label="Bottom navigation">
        {tabItems.map(({ to, label, icon: Icon }) => {
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
              <span className="rc-mobile-tabbar-label">
                {label}
                {label === "Messages" && unreadFlag ? (
                  <span className="rc-mobile-tabbar-dot" />
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
