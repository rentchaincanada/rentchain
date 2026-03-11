import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { tenantApiFetch } from "../../api/tenantApiFetch";
import { getTenantCommunicationSummary } from "../../api/tenantCommunicationsApi";
import { logoutTenant } from "../../lib/logoutTenant";

type Props = {
  children: React.ReactNode;
};

type TenantMeResponse = {
  ok: boolean;
  data?: {
    tenant?: {
      name?: string | null;
      email?: string | null;
      shortId?: string | null;
    };
    unit?: {
      label?: string | null;
    };
  };
};

const navItems = [
  { label: "Dashboard", to: "/tenant" },
  { label: "Activity", to: "/tenant/activity" },
  { label: "Ledger", to: "/tenant/ledger" },
  { label: "Documents", to: "/tenant/attachments" },
  { label: "Messages", to: "/tenant/messages" },
  { label: "Notices", to: "/tenant/notices" },
  { label: "Profile", to: "/tenant/profile" },
  { label: "Account", to: "/tenant/account" },
];

export const TenantNav: React.FC<Props> = ({ children }) => {
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantEmail, setTenantEmail] = useState<string | null>(null);
  const [tenantUnit, setTenantUnit] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < 900
  );
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotices, setUnreadNotices] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const loadIdentity = async () => {
      try {
        const res = await tenantApiFetch<TenantMeResponse>("/tenant/me");
        const name = String(res?.data?.tenant?.name || "").trim();
        const email = String(res?.data?.tenant?.email || "").trim();
        const unit = String(res?.data?.unit?.label || "").trim();
        if (!cancelled) {
          setTenantName(name || null);
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
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summary = await getTenantCommunicationSummary();
        if (!cancelled) {
          setUnreadMessages(Number(summary?.unreadMessages || 0));
          setUnreadNotices(Number(summary?.unreadNotices || 0));
        }
      } catch {
        if (!cancelled) {
          setUnreadMessages(0);
          setUnreadNotices(0);
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

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <header
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
            <div style={{ fontWeight: 700 }}>RentChain Tenant Portal</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {identityLoading ? "Loading profile..." : tenantName || "Tenant profile"}
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
              <NavLink key={item.to} to={item.to} style={linkStyle} end={item.to === "/tenant"}>
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
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? 12 : 16 }}>
        {children}
      </main>
    </div>
  );
};

export default TenantNav;
