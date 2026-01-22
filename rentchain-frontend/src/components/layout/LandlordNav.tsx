import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Users, ScrollText, MessagesSquare } from "lucide-react";
import TopNav from "./TopNav";
import { useAuth } from "../../context/useAuth";
import { fetchLandlordConversations } from "../../api/messagesApi";
import "./LandlordNav.css";

type Props = {
  children: React.ReactNode;
  unreadMessages?: boolean;
};

const tabs = [
  { path: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { path: "/properties", label: "Properties", Icon: Building2 },
  { path: "/tenants", label: "Tenants", Icon: Users },
  { path: "/applications", label: "Applications", Icon: ScrollText },
  { path: "/messages", label: "Messages", Icon: MessagesSquare },
];

const topLinks = [
  { path: "/pricing", label: "Pricing" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/properties", label: "Properties" },
  { path: "/tenants", label: "Tenants" },
  { path: "/billing", label: "Billing" },
  { path: "/applications", label: "Applications" },
  { path: "/payments", label: "Payments" },
  { path: "/messages", label: "Messages" },
];

export const LandlordNav: React.FC<Props> = ({ children, unreadMessages }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const { logout } = useAuth();
  const [hasUnread, setHasUnread] = useState<boolean>(false);
  const unreadFlag = typeof unreadMessages === "boolean" ? unreadMessages : hasUnread;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;
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
  }, []);

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

  useEffect(() => {
    const t = window.setTimeout(() => {
      setShellReady(true);
    }, 200);
    return () => window.clearTimeout(t);
  }, []);

  if (!shellReady) {
    return (
      <div
        className="rc-landlord-shell"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "min(980px, 95vw)",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Loading dashboard…</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ height: 14, borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
            <div style={{ height: 14, width: "85%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
            <div style={{ height: 14, width: "60%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }} />
            <div style={{ height: 220, borderRadius: 12, background: "rgba(15,23,42,0.05)" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rc-landlord-shell">
      <div className="rc-landlord-topnav">
        <TopNav />
      </div>

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
          <span>Menu</span>
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            Close
          </button>
        </div>
        <div className="rc-landlord-drawer-links">
          {topLinks.map(({ path, label }) => (
            <button
              key={path}
              type="button"
              onClick={() => nav(path)}
              className={loc.pathname.startsWith(path) ? "active" : ""}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="rc-landlord-drawer-footer">
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="rc-landlord-content">{children}</div>

      <nav className="rc-mobile-tabbar" aria-label="Bottom navigation">
        {tabs.map(({ path, label, Icon }) => {
          const active = loc.pathname.startsWith(path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => nav(path)}
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
