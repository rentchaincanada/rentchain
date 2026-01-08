import { API_BASE_URL } from "./config";

function dispatchPlanLimit(detail: any) {
  try {
    window.dispatchEvent(new CustomEvent("upgrade:plan-limit", { detail }));
  } catch {
    // no-op
  }
}

function normalizePlanLimit(payload: any, status: number) {
  const raw = payload ?? {};
  if (status === 403 && raw?.error === "PLAN_LIMIT") {
    return {
      message: raw?.message || "Plan limit reached.",
      limitType: raw?.limitType,
      limit: raw?.limit,
      existing: raw?.existing,
      attempted: raw?.attempted,
      plan: raw?.plan,
      raw,
    };
  }
  if (status === 409 && raw?.code === "LIMIT_REACHED") {
    const d = raw?.details || {};
    return {
      message: raw?.error || "Plan limit reached.",
      limitType: raw?.limitType || "units",
      limit: d?.limit,
      existing: d?.current,
      attempted: d?.adding,
      plan: d?.plan,
      raw,
    };
  }
  const msg = String(raw?.message || raw?.error || "");
  if ((status === 403 || status === 409) && /plan limit/i.test(msg)) {
    return { message: msg || "Plan limit reached.", raw };
  }
  return null;
}

export type ApiFetchInit = RequestInit & { allowStatuses?: number[]; allow404?: boolean; suppressToasts?: boolean };

export async function apiFetch<T = any>(
  path: string,
  init: ApiFetchInit = {}
): Promise<T> {
  const token =
    sessionStorage.getItem("rentchain_token") ||
    sessionStorage.getItem("rentchain_tenant_token") ||
    localStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_tenant_token");

  const normalizedPath = (() => {
    if (path.startsWith("http")) return path;
    if (path.startsWith("/api/")) return path;
    return `/api${path.startsWith("/") ? "" : "/"}${path}`;
  })();

  const url = normalizedPath.startsWith("http")
    ? normalizedPath
    : `${API_BASE_URL}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;

  const { allowStatuses, allow404, suppressToasts, ...fetchInit } = init;

  const headers: Record<string, string> = {
    ...(fetchInit.headers as any),
  };

  // Mark requests coming from our API helpers so the dev fetch-guard doesn't warn
  headers["X-Rentchain-ApiClient"] = "1";

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...fetchInit,
    headers,
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = normalizePlanLimit(data, res.status);
    if (detail) {
      dispatchPlanLimit(detail);
    }
    if (res.status === 404 && (allow404 || allowStatuses?.includes(404))) {
      return null as T;
    }
    const msg = data?.message || data?.error || text || `apiFetch ${res.status}`;
    if (allowStatuses?.includes(res.status)) {
      return (data as T) ?? (text as unknown as T);
    }
    if (!suppressToasts) {
      // no-op placeholder: integrate toast system here if desired
    }
    throw new Error(msg);
  }

  return (data as T) ?? (text as unknown as T);
}
