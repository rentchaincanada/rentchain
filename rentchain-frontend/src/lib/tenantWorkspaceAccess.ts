import type { TenantWorkspaceSummary } from "../api/tenantPortal";

type TenantWorkspaceError = {
  status?: number;
  message?: string;
  payload?: {
    error?: string;
    message?: string;
    status?: string;
  } | null;
} | null;

export type TenantWorkspaceAccessInput = {
  hasTenantToken: boolean;
  authLoading: boolean;
  workspaceLoading: boolean;
  workspaceInitializing?: boolean;
  workspace: TenantWorkspaceSummary | null;
  workspaceError: TenantWorkspaceError;
  requestedPath: string;
  requestedSearch?: string;
};

export type TenantWorkspaceAccess =
  | {
      status: "loading";
      title: string;
      description: string;
    }
  | {
      status: "login_required";
      redirectTo: string;
    }
  | {
      status: "recovery_required";
      redirectTo: string;
      reason: "invite" | "application";
    }
  | {
      status: "blocked";
      title: string;
      description: string;
      actionHref: string;
      actionLabel: string;
    }
  | {
      status: "ready";
      defaultDestination: string;
    };

function buildTenantLoginPath(requestedPath: string, requestedSearch = "") {
  const next = `${requestedPath}${requestedSearch || ""}`;
  return `/tenant/login?reason=expired&next=${encodeURIComponent(next)}`;
}

function isUnauthorizedWorkspaceError(error: TenantWorkspaceError) {
  if (!error) return false;
  if (error.status === 401) return true;
  const code = String(error.payload?.error || error.message || "").trim().toUpperCase();
  return code === "UNAUTHORIZED";
}

function isTenantWorkspaceInitializingError(error: TenantWorkspaceError) {
  if (!error) return false;
  const code = String(error.payload?.error || error.message || "").trim().toUpperCase();
  const status = String(error.payload?.status || "").trim().toLowerCase();
  return code === "TENANT_NOT_INITIALIZED" || status === "tenant_not_initialized";
}

export function getTenantWorkspaceDefaultDestination(
  workspace: TenantWorkspaceSummary | null
): string {
  const authority = String(workspace?.context?.authority || "").trim().toLowerCase();
  if (authority === "invite") return "/tenant/invite/redeem";
  if (
    authority === "active_tenant" ||
    workspace?.context?.tenantId ||
    workspace?.context?.leaseId
  ) {
    return "/tenant/dashboard";
  }
  if (authority === "applicant" || workspace?.context?.applicationId) return "/tenant/application";
  return "/tenant/dashboard";
}

export function resolveTenantWorkspaceAccess(
  input: TenantWorkspaceAccessInput
): TenantWorkspaceAccess {
  const loginPath = buildTenantLoginPath(input.requestedPath, input.requestedSearch);

  if (!input.hasTenantToken) {
    return { status: "login_required", redirectTo: loginPath };
  }

  if (input.workspaceInitializing || input.authLoading || input.workspaceLoading) {
    return {
      status: "loading",
      title: input.workspaceInitializing ? "Setting up your tenant workspace..." : "Finishing sign-in",
      description: input.workspaceInitializing
        ? "We're restoring your tenant access and will retry automatically as your workspace becomes ready."
        : "We're restoring your tenant access and loading your workspace.",
    };
  }

  if (isUnauthorizedWorkspaceError(input.workspaceError)) {
    return { status: "login_required", redirectTo: loginPath };
  }

  if (isTenantWorkspaceInitializingError(input.workspaceError)) {
    return {
      status: "blocked",
      title: "We couldn't load your tenant workspace yet",
      description:
        "Your sign-in succeeded, but tenant workspace setup is still finishing. Request a new sign-in link only if this does not clear shortly.",
      actionHref: loginPath,
      actionLabel: "Request a new sign-in link",
    };
  }

  if (input.workspaceError || !input.workspace) {
    return {
      status: "blocked",
      title: "We couldn't load your tenant workspace yet",
      description:
        "Your sign-in succeeded, but we still need to finish restoring tenant access before the workspace is ready.",
      actionHref: loginPath,
      actionLabel: "Request a new sign-in link",
    };
  }

  const defaultDestination = getTenantWorkspaceDefaultDestination(input.workspace);
  if (
    input.requestedPath === "/tenant" ||
    input.requestedPath === "/tenant/dashboard"
  ) {
    if (defaultDestination === "/tenant/invite/redeem") {
      return {
        status: "recovery_required",
        redirectTo: defaultDestination,
        reason: "invite",
      };
    }
    if (defaultDestination === "/tenant/application") {
      return {
        status: "recovery_required",
        redirectTo: defaultDestination,
        reason: "application",
      };
    }
  }

  return {
    status: "ready",
    defaultDestination,
  };
}
