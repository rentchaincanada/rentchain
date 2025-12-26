import React, { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { getTenantLease, getTenantMe, TenantLease, TenantProfile } from "../../api/tenantPortalApi";
import { useAuth } from "../../context/useAuth";

export type TenantOutletContext = {
  profile: TenantProfile | null;
  lease: TenantLease | null;
  refresh: () => Promise<void>;
};

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0b1220 0%, #0a0f1a 40%, #050811 100%)",
  color: "#e5e7eb",
  padding: "32px 20px 48px",
  fontFamily:
    "Inter, 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(17, 24, 39, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.04)",
  borderRadius: 16,
  padding: "18px 20px",
  boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
};

const navLinkBase: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  color: "#e5e7eb",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.01em",
};

function propertyLine(lease: TenantLease | null) {
  if (!lease) return "Fetching propertyâ€¦";
  const unit = lease.unitNumber ? ` Â· Unit ${lease.unitNumber}` : "";
  return `${lease.propertyName || "Your property"}${unit}`;
}

export const TenantLayout: React.FC = () => {
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [lease, setLease] = useState<TenantLease | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [meRes, leaseRes] = await Promise.all([getTenantMe(), getTenantLease()]);
      setProfile(meRes);
      setLease(leaseRes);
    } catch (err: any) {
      setError(err?.message || "Failed to load tenant portal");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const isImpersonation =
    user?.actorRole === "landlord" ||
    (typeof window !== "undefined" &&
      !!window.sessionStorage.getItem("rentchain_tenant_token") &&
      user?.role === "tenant");

  const exitImpersonation = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("rentchain_tenant_token");
    }
    navigate("/tenants");
    void logout();
  }, [navigate, logout]);

  const navItems = [
    { to: "/tenant/dashboard", label: "Dashboard" },
    { to: "/tenant/payments", label: "Payments" },
    { to: "/tenant/ledger", label: "Ledger" },
    { to: "/tenant/documents", label: "Documents" },
    { to: "/tenant/reporting-consent", label: "Reporting consent" },
  ];

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #1e40af)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                color: "#f8fafc",
                letterSpacing: "0.02em",
              }}
            >
              T
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Tenant Portal</div>
              <div style={{ color: "#9ca3af", fontSize: 14 }}>{propertyLine(lease)}</div>
            </div>
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            Read-only access - Secure view of your lease, payments, and ledger
          </div>
        </header>

        <nav
          style={{
            ...cardStyle,
            display: "flex",
            gap: 10,
            padding: "10px 12px",
            alignItems: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...navLinkBase,
                background: isActive ? "rgba(59, 130, 246, 0.12)" : "transparent",
                border: isActive ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid transparent",
                color: isActive ? "#bfdbfe" : "#e5e7eb",
              })}
            >
              {item.label}
            </NavLink>
          ))}
          <div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
            {location.pathname.includes("/tenant") ? "View only" : ""}
          </div>
        </nav>

        {error ? (
          <div style={{ ...cardStyle, color: "#fca5a5", borderColor: "rgba(248,113,113,0.35)" }}>
            {error}
          </div>
        ) : null}

        {isImpersonation ? (
          <div
            style={{
              ...cardStyle,
              borderColor: "rgba(59,130,246,0.45)",
              background: "rgba(59,130,246,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, color: "#bfdbfe", fontWeight: 700 }}>
              Impersonating tenant — read-only view.
            </div>
            <button
              type: "button"
              onClick={exitImpersonation}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "transparent",
                color: "#e5e7eb",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Exit
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div style={{ ...cardStyle, textAlign: "center", color: "#cbd5e1" }}>Loading tenant data…</div>
        ) : (
          <Outlet context={{ profile, lease, refresh: fetchData }} />
        )}
      </div>
    </div>
  );
};

export function useTenantOutletContext(): TenantOutletContext {
  return useOutletContext<TenantOutletContext>();
}







