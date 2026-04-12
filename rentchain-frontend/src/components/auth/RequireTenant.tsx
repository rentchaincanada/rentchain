import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getTenantWorkspace, type TenantWorkspaceSummary } from "../../api/tenantPortal";
import { getTenantToken } from "../../lib/tenantAuth";
import { resolveTenantWorkspaceAccess } from "../../lib/tenantWorkspaceAccess";

type TenantWorkspaceError = {
  status?: number;
  message?: string;
  payload?: {
    error?: string;
    message?: string;
  } | null;
} | null;

function TenantWorkspaceGateScreen({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
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
          width: "min(440px, 92vw)",
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 16,
          padding: "22px 24px",
          boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
        <div style={{ color: "#475569", lineHeight: 1.6 }}>{description}</div>
        {actionHref && actionLabel ? (
          <a
            href={actionHref}
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            {actionLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export const RequireTenant: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, ready } = useAuth();
  const location = useLocation();
  const [workspace, setWorkspace] = React.useState<TenantWorkspaceSummary | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const [workspaceError, setWorkspaceError] = React.useState<TenantWorkspaceError>(null);
  const [workspaceResolved, setWorkspaceResolved] = React.useState(false);
  const token = getTenantToken();

  React.useEffect(() => {
    let cancelled = false;

    if (!token) {
      setWorkspace(null);
      setWorkspaceLoading(false);
      setWorkspaceError(null);
      setWorkspaceResolved(true);
      return () => {
        cancelled = true;
      };
    }

    setWorkspaceLoading(true);
    setWorkspaceError(null);
    setWorkspaceResolved(false);

    void getTenantWorkspace()
      .then((summary) => {
        if (cancelled) return;
        setWorkspace(summary);
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspace(null);
        setWorkspaceError({
          status: error?.status,
          message: String(error?.message || ""),
          payload: error?.payload ?? null,
        });
      })
      .finally(() => {
        if (cancelled) return;
        setWorkspaceLoading(false);
        setWorkspaceResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const access = resolveTenantWorkspaceAccess({
    hasTenantToken: Boolean(token),
    authLoading: isLoading || !ready,
    workspaceLoading: workspaceLoading || (Boolean(token) && !workspaceResolved),
    workspace,
    workspaceError,
    requestedPath: location.pathname,
    requestedSearch: location.search,
  });

  if (access.status === "loading") {
    return (
      <TenantWorkspaceGateScreen
        title={access.title}
        description={access.description}
      />
    );
  }

  if (access.status === "login_required") {
    return <Navigate to={access.redirectTo} state={{ from: location }} replace />;
  }

  if (access.status === "recovery_required") {
    return <Navigate to={access.redirectTo} replace />;
  }

  if (access.status === "blocked") {
    return (
      <TenantWorkspaceGateScreen
        title={access.title}
        description={access.description}
        actionHref={access.actionHref}
        actionLabel={access.actionLabel}
      />
    );
  }

  return <>{children}</>;
};
