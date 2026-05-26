import React, { useEffect, useMemo, useState } from "react";
import { FileText, Home, Menu, MessageSquare, ScrollText, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getTenantWorkspace } from "../../api/tenantPortal";
import { getTenantCommunicationSummary } from "../../api/tenantCommunicationsApi";
import { logoutTenant } from "../../lib/logoutTenant";
import "./TenantNav.css";

type Props = {
  children: React.ReactNode;
};

const navItems = [
  { label: "Dashboard", to: "/tenant/dashboard" },
  { label: "Screening Requests", to: "/tenant/screening" },
  { label: "Profile", to: "/tenant/profile" },
  { label: "Onboarding", to: "/tenant/onboarding-hardening" },
  { label: "Access", to: "/tenant/access" },
  { label: "Application", to: "/tenant/application" },
  { label: "Documents", to: "/tenant/documents" },
  { label: "History", to: "/tenant/activity" },
  { label: "Lease", to: "/tenant/lease" },
  { label: "Maintenance", to: "/tenant/maintenance" },
  { label: "Messages", to: "/tenant/messages" },
];

const mobileTabs = [
  {
    label: "Dashboard",
    to: "/tenant",
    icon: Home,
    isActive: (pathname: string) => pathname === "/tenant" || pathname.startsWith("/tenant/dashboard"),
  },
  {
    label: "Lease",
    to: "/tenant/lease",
    icon: ScrollText,
    isActive: (pathname: string) => pathname.startsWith("/tenant/lease"),
  },
  {
    label: "Documents",
    to: "/tenant/documents",
    icon: FileText,
    isActive: (pathname: string) => pathname.startsWith("/tenant/documents") || pathname.startsWith("/tenant/attachments"),
  },
  {
    label: "Messages",
    to: "/tenant/messages",
    icon: MessageSquare,
    isActive: (pathname: string) => pathname.startsWith("/tenant/messages"),
  },
];

export const TenantNav: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantEmail, setTenantEmail] = useState<string | null>(null);
  const [tenantUnit, setTenantUnit] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < 900
  );
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [unreadScreening, setUnreadScreening] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadIdentity = async () => {
      try {
        const workspace = await getTenantWorkspace();
        const name = String(workspace?.context?.invitedEmail || "").trim();
        const email = String(workspace?.context?.invitedEmail || "").trim();
        const unit = String(workspace?.unit?.label || "").trim();
        if (!cancelled) {
          setTenantName(name ? name.split("@")[0] : "Tenant workspace");
          setTenantEmail(email || null);
          setTenantUnit(unit || null);
        }
      } catch {
        if (!cancelled) {
          setTenantName(null);
          setTenantEmail(null);
          setTenantUnit(null);
        }
      } finally {
        if (!cancelled) {
          setIdentityLoading(false);
        }
      }
    };

    void loadIdentity();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summary = await getTenantCommunicationSummary();
        if (!cancelled) {
          setUnreadMessages(Number(summary?.unreadMessages || 0));
          setUnreadNotices(Number(summary?.unreadNotices || 0));
          setUnreadScreening(Number(summary?.unreadScreeningUpdates || 0));
        }
      } catch {
        if (!cancelled) {
          setUnreadMessages(0);
          setUnreadNotices(0);
          setUnreadScreening(0);
        }
      }
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkStyle = useMemo(
    () =>
      ({ isActive }: { isActive: boolean }) => ({
        color: isActive ? "#1d4ed8" : "#334155",
        background: isActive ? "#dbeafe" : "transparent",
        border: isActive ? "1px solid #bfdbfe" : "1px solid transparent",
        textDecoration: "none",
        fontWeight: 600,
        borderRadius: 10,
        padding: "8px 12px",
      }),
    []
  );

  const goTo = (path: string) => {
    navigate(path);
    setMoreOpen(false);
  };

  return (
    <div className="rc-tenant-shell">
      <header
        className="rc-tenant-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid #e2e8f0",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: isMobile ? "10px 12px" : "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontWeight: 700 }}>RentChain Tenant Space</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {identityLoading ? "Loading your space..." : tenantName || "Your tenant space"}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", minHeight: 16 }}>
              {identityLoading
                ? ""
                : [tenantEmail, tenantUnit ? `Unit ${tenantUnit}` : null].filter(Boolean).join(" • ")}
            </div>
          </div>
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: isMobile ? "nowrap" : "wrap",
              overflowX: isMobile ? "auto" : "visible",
              whiteSpace: isMobile ? "nowrap" : "normal",
              width: isMobile ? "100%" : "auto",
              paddingBottom: isMobile ? 2 : 0,
            }}
          >
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} style={linkStyle} end={item.to === "/tenant/dashboard"}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>{item.label}</span>
                  {item.to === "/tenant/messages" && unreadMessages > 0 ? (
                    <span
                      style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        background: "#1d4ed8",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: "0 5px",
                      }}
                    >
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  ) : null}
                  {item.to === "/tenant/screening" && unreadScreening > 0 ? (
                    <span
                      style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        background: "#0f766e",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: "0 5px",
                      }}
                    >
                      S
                    </span>
                  ) : null}
                  {item.to === "/tenant/notices" && unreadNotices > 0 ? (
                    <span
                      style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        background: "#475569",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: "0 5px",
                      }}
                    >
                      {unreadNotices > 99 ? "99+" : unreadNotices}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => logoutTenant("/tenant/login")}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                borderRadius: 10,
                padding: "8px 12px",
                cursor: "pointer",
                color: "#334155",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="rc-tenant-main" style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? 12 : 16 }}>
        {children}
      </main>
      <div
        className={`rc-tenant-mobile-backdrop${moreOpen ? " is-open" : ""}`}
        aria-hidden="true"
        onClick={() => setMoreOpen(false)}
      />
      <aside
        id="rc-tenant-mobile-menu"
        className={`rc-tenant-mobile-menu${moreOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Tenant menu"
      >
        <div className="rc-tenant-mobile-menu-header">
          <span>Tenant menu</span>
          <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close tenant menu">
            <X size={18} />
          </button>
        </div>
        <div className="rc-tenant-mobile-menu-links">
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to === "/tenant/documents" && location.pathname.startsWith("/tenant/attachments")) ||
              (item.to !== "/tenant/dashboard" && location.pathname.startsWith(`${item.to}/`));
            return (
              <button
                key={item.to}
                type="button"
                className={active ? "active" : undefined}
                onClick={() => goTo(item.to)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <button type="button" className="rc-tenant-mobile-menu-signout" onClick={() => logoutTenant("/tenant/login")}>
          Logout
        </button>
      </aside>
      <nav className="rc-tenant-mobile-tabbar" aria-label="Tenant bottom navigation">
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(location.pathname);
          const hasUnread = item.to === "/tenant/messages" && unreadMessages > 0;
          return (
            <button
              key={item.label}
              type="button"
              className={active ? "active" : undefined}
              onClick={() => goTo(item.to)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <Icon size={20} strokeWidth={2.2} />
              <span className="rc-tenant-mobile-tabbar-label">
                {item.label}
                {hasUnread ? <span className="rc-tenant-mobile-tabbar-dot" aria-hidden="true" /> : null}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className={moreOpen ? "active" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-controls="rc-tenant-mobile-menu"
          aria-label="More"
        >
          <Menu size={20} strokeWidth={2.2} />
          <span className="rc-tenant-mobile-tabbar-label">More</span>
        </button>
      </nav>
    </div>
  );
};

export default TenantNav;
