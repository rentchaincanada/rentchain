import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { apiFetch } from "../../api/apiFetch";

interface RequireAdminProps {
  children: React.ReactNode;
}

type MeUser = {
  role?: string;
};

export const RequireAdmin: React.FC<RequireAdminProps> = ({ children }) => {
  const { isLoading, ready, token, authStatus } = useAuth();
  const location = useLocation();
  const [meUser, setMeUser] = useState<MeUser | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setMeLoading(true);

    const run = async () => {
      try {
        const data = await apiFetch<{ user?: MeUser | null }>("/me", {
          credentials: "include",
          allowStatuses: [401, 403],
        });
        if (!active) return;
        setMeUser(data?.user ?? null);
      } catch (err: any) {
        if (!active) return;
        setMeUser(null);
      } finally {
        if (active) setMeLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [token]);

  if (authStatus === "restoring" || isLoading || !ready || meLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading.
      </div>
    );
  }

  if (!meUser) {
    const current = `${location.pathname}${location.search || ""}`;
    const params = new URLSearchParams();
    params.set("next", current);
    const reason = (location.state as any)?.reason || (token ? "expired" : "missing");
    if (reason) params.set("reason", reason);
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  if (meUser.role !== "admin") {
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
