import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

interface RequireAdminProps {
  children: React.ReactNode;
}

export const RequireAdmin: React.FC<RequireAdminProps> = ({ children }) => {
  const { user, isLoading, ready, token, authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === "restoring" || isLoading || !ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading.
      </div>
    );
  }

  if (!user) {
    const current = `${location.pathname}${location.search || ""}`;
    const params = new URLSearchParams();
    params.set("next", current);
    const reason = (location.state as any)?.reason || (token ? "expired" : "missing");
    if (reason) params.set("reason", reason);
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  if (user.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Access denied</div>
          <div style={{ color: "#6b7280" }}>You do not have admin access for this page.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
