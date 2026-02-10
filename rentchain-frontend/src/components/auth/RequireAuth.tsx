// src/components/auth/RequireAuth.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

interface RequireAuthProps {
  children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { user, isLoading, ready, token, authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === "restoring" || isLoading || !ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
          fontSize: "0.95rem",
          color: "#0f172a",
          background:
            "radial-gradient(circle at top left, rgba(37,99,235,0.08) 0, rgba(14,165,233,0.06) 45%, rgba(255,255,255,0.9) 100%)",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "min(420px, 90vw)",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            padding: "20px 22px",
            boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Loading your dashboard...
          </div>
          <div style={{ color: "#475569", marginBottom: 16 }}>
            Restoring your session and syncing data.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: "rgba(15,23,42,0.08)",
              }}
            />
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: "rgba(15,23,42,0.08)",
                width: "80%",
              }}
            />
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: "rgba(15,23,42,0.08)",
                width: "60%",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    const current = `${location.pathname}${location.search || ""}`;
    const params = new URLSearchParams();
    params.set("next", current);
    const reason =
      (location.state as any)?.reason ||
      (token ? "expired" : "missing");
    if (reason) params.set("reason", reason);
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  if (String(user.role || "").toLowerCase() === "landlord" && user.approved === false) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
          fontSize: "0.95rem",
          color: "#0f172a",
          background:
            "radial-gradient(circle at top left, rgba(37,99,235,0.08) 0, rgba(14,165,233,0.06) 45%, rgba(255,255,255,0.9) 100%)",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "min(420px, 90vw)",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            padding: "20px 22px",
            boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Your RentChain landlord access is pending approval.
          </div>
          <div style={{ color: "#475569", marginBottom: 16 }}>
            We’ll notify you once your request is approved.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
              background: "#fff",
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
