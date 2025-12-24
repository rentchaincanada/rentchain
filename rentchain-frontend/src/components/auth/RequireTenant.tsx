import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

export const RequireTenant: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const token =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token") ||
    null;

  if (isLoading) {
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
        Loading…
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/tenant/login" state={{ from: location }} replace />;
  }

  if (user && user.role !== "tenant") {
    return <Navigate to="/tenant/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
