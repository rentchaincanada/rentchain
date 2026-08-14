export const PR1525_ATTACHMENTS_BRANCH = "feat/tenant-maintenance-image-attachments-v1";
export const PR1525_TENANT_PROXY_BASE = "/api/pr1525-attachments/tenant";

declare const __VERCEL_GIT_COMMIT_REF__: string | undefined;

function buildBranch(): string {
  return typeof __VERCEL_GIT_COMMIT_REF__ === "string" ? __VERCEL_GIT_COMMIT_REF__ : "";
}

function normalizeApiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  let normalized = path.startsWith("/") ? path : `/${path}`;
  normalized = normalized.replace(/^\/api\/api\//, "/api/");
  if (!normalized.startsWith("/api/")) normalized = `/api${normalized}`;
  return normalized;
}

export function isPr1525TenantMaintenancePath(path: string): boolean {
  const normalized = normalizeApiPath(path).split(/[?#]/, 1)[0];
  return /^\/api\/tenant\/maintenance-requests(?:\/|$)/.test(normalized);
}

export function resolvePr1525TenantMaintenanceUrl(
  path: string,
  apiBaseUrl: string,
  branch = buildBranch(),
): string {
  const normalized = normalizeApiPath(path);
  if (branch === PR1525_ATTACHMENTS_BRANCH && isPr1525TenantMaintenancePath(normalized)) {
    return `${PR1525_TENANT_PROXY_BASE}${normalized}`;
  }
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const base = apiBaseUrl.replace(/\/$/, "").replace(/\/api$/i, "");
  return `${base}${normalized}`;
}
