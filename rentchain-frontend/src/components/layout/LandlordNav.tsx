import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Users, ScrollText, MessagesSquare } from "lucide-react";
import { TopNav } from "./TopNav";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../context/useAuth";

type Props = {
  children: React.ReactNode;
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

export const LandlordNav: React.FC<Props> = ({ children }) => {
  const isMobile = useIsMobile();
  const nav = useNavigate();
  const loc = useLocation();
  const { logout } = useAuth();

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            background: "#fff",
            position: "sticky",
            top: 0,
            zIndex: 15,
          }}
        >
          <button
            type="button"
            onClick={() => nav("/dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              padding: 0,
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #1e3a8a)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
              }}
            >
              R
            </span>
            RentChain
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            style={{
              background: "#f3f4f6",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </header>

        <main style={{ minHeight: "calc(100vh - 72px)" }}>{children}</main>

        <nav
          aria-label="Bottom navigation"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            padding: "8px 10px calc(8px + env(safe-area-inset-bottom))",
            display: "grid",
            gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
            zIndex: 20,
          }}
        >
          {tabs.map(({ path, label, Icon }) => {
            const active = loc.pathname.startsWith(path);
            return (
              <button
                key={path}
                type="button"
                onClick={() => nav(path)}
                style={{
                  border: "none",
                  background: "transparent",
                  display: "grid",
                  justifyItems: "center",
                  gap: 4,
                  padding: "6px 4px",
                  color: active ? "#111827" : "#6b7280",
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  borderRadius: 10,
                }}
              >
                <Icon size={20} strokeWidth={2.2} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div>
      <TopNav />
      <div style={{ padding: "12px 0 24px" }}>{children}</div>
    </div>
  );
};
