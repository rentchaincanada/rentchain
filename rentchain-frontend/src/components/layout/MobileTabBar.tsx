
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/properties", label: "Properties" },
  { path: "/tenants", label: "Tenants" },
  { path: "/ledger", label: "Ledger" },
  { path: "/account", label: "Account" },
];

export function MobileTabBar() {
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <nav className="rc-mobile-tabbar" aria-label="Primary navigation">
      {tabs.map((t) => {
        const active = loc.pathname.startsWith(t.path);
        return (
          <button
            key={t.path}
            className={`rc-tab ${active ? "active" : ""}`}
            onClick={() => nav(t.path)}
            type="button"
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
