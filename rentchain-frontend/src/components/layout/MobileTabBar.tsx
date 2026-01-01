
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Users, ScrollText, User } from "lucide-react";

const TENANT_PORTAL_ENABLED =
  String(import.meta.env.VITE_TENANT_PORTAL_ENABLED || "false").trim().toLowerCase() === "true";

const baseTabs = [
  { path: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { path: "/properties", label: "Props", Icon: Building2 },
  { path: "/tenants", label: "Tenants", Icon: Users },
  { path: "/ledger", label: "Ledger", Icon: ScrollText },
  { path: "/account", label: "Account", Icon: User },
];

const tabs = TENANT_PORTAL_ENABLED
  ? [...baseTabs, { path: "/tenant", label: "Tenant", Icon: User }]
  : baseTabs;

export function MobileTabBar() {
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <nav className="rc-mobile-tabbar" aria-label="Primary">
      {tabs.map(({ path, label, Icon }) => {
        const active = loc.pathname.startsWith(path);
        return (
          <button
            key={path}
            className={`rc-tab ${active ? "active" : ""}`}
            onClick={() => nav(path)}
            type="button"
          >
            <Icon size={18} />
            <span className="rc-tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
