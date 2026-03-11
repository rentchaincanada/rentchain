import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { tenantApiFetch } from "../../api/tenantApiFetch";
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
    };
  };
};

const navItems = [
  { label: "Dashboard", to: "/tenant" },
  { label: "Activity", to: "/tenant/activity" },
  { label: "Ledger", to: "/tenant/ledger" },
  { label: "Documents", to: "/tenant/attachments" },
  { label: "Notices", to: "/tenant/notices" },
  { label: "Profile", to: "/tenant/profile" },
  { label: "Account", to: "/tenant/account" },
];

export const TenantNav: React.FC<Props> = ({ children }) => {
  const [tenantName, setTenantName] = useState("Tenant User");
  const [tenantEmail, setTenantEmail] = useState("tenant@example.com");
  useEffect(() => {
    let cancelled = false;
    const loadIdentity = async () => {
      try {
        const res = await tenantApiFetch<TenantMeResponse>("/tenant/me");
        const name = String(res?.data?.tenant?.name || "").trim();
        const email = String(res?.data?.tenant?.email || "").trim();
        if (!cancelled) {
          if (name) setTenantName(name);
          if (email) setTenantEmail(email);
        }
      } catch {
        // Keep safe fallback identity if /tenant/me is unavailable.
      }
    };

    void loadIdentity();
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
            padding: "12px 16px",
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
              {tenantName}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {tenantEmail}
            </div>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} style={linkStyle} end={item.to === "/tenant"}>
                {item.label}
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
              }}
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16 }}>
        {children}
      </main>
    </div>
  );
};

export default TenantNav;
