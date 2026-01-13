// rentchain-frontend/src/components/layout/TopNav.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEMO_MODE } from "../../config/demo";
import { useSubscription } from "../../context/SubscriptionContext";
import { useAuth } from "../../context/useAuth";
import { fetchMe } from "../../api/meApi";
import { fetchAccountLimits } from "../../api/accountApi";
import { resolvePlanFrom, planLabel, normalizePlan } from "../../lib/plan";
import {
  blur,
  radius,
  spacing,
  colors,
  text,
  shadows,
  layout,
  effects,
} from "../../styles/tokens";

type TopNavProps = {
  unreadMessages?: boolean;
};

export const TopNav: React.FC<TopNavProps> = ({ unreadMessages }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { plan, setPlan } = useSubscription();
  const { user, logout } = useAuth();
  const [me, setMe] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);
  const displayedPlan = resolvePlanFrom({ me, limits });
  const planValue = DEMO_MODE ? normalizePlan(plan) : displayedPlan;

  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((res) => {
        if (!alive) return;
        setMe(res);
        if (DEMO_MODE) {
          const p = res?.plan;
          if (p === "starter" || p === "core" || p === "pro" || p === "elite") {
            setPlan(p);
          }
        }
      })
      .catch(() => {
        if (!alive) return;
        setMe(null);
      });
    fetchAccountLimits()
      .then((lim) => {
        if (!alive) return;
        setLimits(lim);
      })
      .catch(() => {
        if (!alive) return;
        setLimits(null);
      });
    return () => {
        alive = false;
    };
  }, [setPlan]);

  const isActive = (path: string) => location.pathname.startsWith(path);
  const topTabs = useMemo(
    () => [
      { path: "/pricing", label: "Pricing" },
      { path: "/dashboard", label: "Dashboard" },
      { path: "/properties", label: "Properties" },
      { path: "/tenants", label: "Tenants" },
      { path: "/billing", label: "Billing" },
      { path: "/applications", label: "Applications" },
      { path: "/payments", label: "Payments" },
      { path: "/messages", label: "Messages", unread: unreadMessages },
    ],
    [unreadMessages]
  );

  const handleSignInClick = (
    e: React.MouseEvent<HTMLButtonElement>
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    if (location.pathname === "/login") return;
    navigate("/login");
  };

  return (
    <div
      className="topnav-root"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        padding: `${spacing.sm} ${layout.pagePadding}`,
        backdropFilter: blur.sm,
        background: effects.glassBg,
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: shadows.sm,
      }}
    >
      <div className="topnav-left" style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <button
          type="button"
          className="topnav-logo"
          onClick={() => navigate("/dashboard")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: colors.accentSoft,
              boxShadow: shadows.sm,
              color: text.primary,
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            R
          </span>
          <span style={{ color: text.primary, fontWeight: 700 }}>RentChain</span>
        </button>

        <div
          className="topnav-tabs"
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "nowrap",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <button
            type="button"
            className={`topnav-tab ${isActive("/pricing") ? "active" : ""}`}
            onClick={() => navigate("/pricing")}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: isActive("/pricing") ? colors.accentSoft : "transparent",
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            Pricing
          </button>
          <button
            type="button"
            className={`topnav-tab ${isActive("/dashboard") ? "active" : ""}`}
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: isActive("/dashboard") ? colors.accentSoft : "transparent",
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`topnav-tab ${isActive("/properties") ? "active" : ""}`}
            onClick={() => navigate("/properties")}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: isActive("/properties") ? colors.accentSoft : "transparent",
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            Properties
          </button>
          <button
            type="button"
            className={`topnav-tab ${isActive("/tenants") ? "active" : ""}`}
            onClick={() => navigate("/tenants")}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: isActive("/tenants") ? colors.accentSoft : "transparent",
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            Tenants
          </button>
          <button
            type="button"
            className={`topnav-tab ${isActive("/messages") ? "active" : ""}`}
            onClick={() => navigate("/messages")}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: isActive("/messages") ? colors.accentSoft : "transparent",
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Messages
            {unreadMessages ? (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  background: colors.danger,
                  display: "inline-block",
                }}
              />
            ) : null}
          </button>
          {user && (
            <button
              type="button"
              className={`topnav-tab ${isActive("/billing") ? "active" : ""}`}
              onClick={() => navigate("/billing")}
              style={{
                padding: "8px 12px",
                borderRadius: radius.pill,
                border: "none",
                background: isActive("/billing") ? colors.accentSoft : "transparent",
                color: text.primary,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              Billing
            </button>
          )}
          <button
            type="button"
            className={`topnav-tab ${isActive("/applications") ? "active" : ""}`}
            onClick={() => navigate("/applications")}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: isActive("/applications") ? colors.accentSoft : "transparent",
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            Applications
          </button>
          <button
            type="button"
            className={`topnav-tab ${isActive("/payments") ? "active" : ""}`}
            onClick={() => navigate("/payments")}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: isActive("/payments") ? colors.accentSoft : "transparent",
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            Payments
          </button>
        </div>
      </div>

      <div className="topnav-right" style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        {DEMO_MODE && (
          <div
            className="topnav-pill"
          style={{
            padding: "6px 10px",
            borderRadius: radius.pill,
            background: colors.accentSoft,
            border: `1px solid ${colors.border}`,
            color: text.primary,
            fontSize: 12,
          }}
        >
          Demo mode
        </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ color: "#cbd5f5", fontSize: 12 }}>
            Plan: {planLabel(displayedPlan)}
          </span>
          {DEMO_MODE ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#cbd5f5", fontSize: 12 }}>Demo plan</span>
              <select
                value={planValue}
                onChange={(e) => setPlan(e.target.value as any)}
                style={{
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.panel,
                  color: text.primary,
                  fontSize: 12,
                  padding: "4px 10px",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="starter">{planLabel("starter")}</option>
                <option value="core">{planLabel("core")}</option>
                <option value="pro">{planLabel("pro")}</option>
                <option value="elite">{planLabel("elite")}</option>
              </select>
            </div>
          ) : null}
        </div>

        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
            <div className="topnav-pill" style={{ whiteSpace: "nowrap" }}>
              Signed in as {user.email}
            </div>
            <button
              type="button"
            className="topnav-button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            style={{
              borderRadius: radius.pill,
              padding: "8px 12px",
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: text.primary,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: shadows.sm,
            }}
          >
            Sign out
          </button>
        </div>
      ) : (
          <button
            type="button"
            className="topnav-button"
            onClick={handleSignInClick}
            style={{
              borderRadius: radius.pill,
              padding: "8px 12px",
              border: `1px solid ${colors.accent}`,
              background: colors.accent,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: shadows.sm,
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
};
