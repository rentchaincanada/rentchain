import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

type Props = {
  allowed: string[];
  fallbackTo?: string;
  children: React.ReactNode;
};

export const RequireRole: React.FC<Props> = ({ allowed, fallbackTo = "/dashboard", children }) => {
  const { user, isLoading, ready, authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === "restoring" || isLoading || !ready) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const role = String(user.actorRole || user.role || "").trim().toLowerCase();
  const allowSet = new Set(allowed.map((v) => String(v || "").trim().toLowerCase()));
  if (!allowSet.has(role)) {
    return <Navigate to={fallbackTo} replace />;
  }
  return <>{children}</>;
};
