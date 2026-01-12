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
          color: "#e5e7eb",
          background:
            "radial-gradient(circle at top left, #111827 0, #020617 45%, #000000 100%)",
        }}
      >
        Restoring session…
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

  return <>{children}</>;
};
