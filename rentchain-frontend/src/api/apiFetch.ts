import { API_BASE_URL } from "./config";
import { clearAuthToken, clearTenantToken, getAuthToken, getTenantToken } from "../lib/authToken";

function dispatchPlanLimit(detail: any) {
  try {
    window.dispatchEvent(new CustomEvent("upgrade:plan-limit", { detail }));
  } catch {
    // no-op
  }
}

function shouldIgnorePlanLimit(detail: any) {
  const type = String(detail?.limitType ?? "").toLowerCase();
  return type === "properties" || type === "property" || type === "units" || type === "unit";
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

type Jsonish = Record<string, any>;
export type ApiFetchInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Jsonish;
  allowStatuses?: number[];
  allow404?: boolean;
  suppressToasts?: boolean;
};

let redirectedOn401 = false;

export async function apiFetch<T = any>(
  path: string,
  init: ApiFetchInit = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not configured");
  }
  const base = API_BASE_URL.replace(/\/$/, "");
  if (!(apiFetch as any)._loggedBase) {
    console.log("[apiFetch] API base:", base);
    (apiFetch as any)._loggedBase = true;
  }

  const normalizedPath = (() => {
    if (path.startsWith("http")) return path;
    let p = path;
    if (p.startsWith("/api/")) {
      if (!(apiFetch as any)._warnedApiPrefix) {
        console.warn("Do not prefix /api in apiFetch calls. Normalizing path:", path);
        (apiFetch as any)._warnedApiPrefix = true;
      }
      p = p.slice(4);
    } else if (p.startsWith("api/")) {
      if (!(apiFetch as any)._warnedApiPrefix) {
        console.warn("Do not prefix /api in apiFetch calls. Normalizing path:", path);
        (apiFetch as any)._warnedApiPrefix = true;
      }
      p = p.slice(3);
    }
    p = p.startsWith("/") ? p : `/${p}`;
    return `${base}${p}`;
  })();

  let pathForMatch = path;
  try {
    if (path.startsWith("http")) {
      pathForMatch = new URL(path).pathname || path;
    }
  } catch {
    // ignore parse errors
  }
  const isTenantPath =
    pathForMatch === "/tenant" ||
    pathForMatch === "/api/tenant" ||
    pathForMatch.startsWith("/tenant/") ||
    pathForMatch.startsWith("/api/tenant/");
  const token = isTenantPath ? getTenantToken() : getAuthToken();

  const url = normalizedPath;

  const { allowStatuses, allow404, suppressToasts, ...fetchInit } = init;

  const headers: Record<string, string> = {
    ...(fetchInit.headers as any),
  };

  // Mark requests coming from our API helpers so the dev fetch-guard doesn't warn
  headers["X-Rentchain-ApiClient"] = "1";
  headers["x-rc-auth"] = token ? "bearer" : "missing";

  if (token) headers.Authorization = `Bearer ${token}`;

  let bodyToSend: any = (fetchInit as any).body;
  const isPlainObject =
    bodyToSend &&
    typeof bodyToSend === "object" &&
    !(bodyToSend instanceof FormData) &&
    !(bodyToSend instanceof Blob) &&
    !(bodyToSend instanceof ArrayBuffer) &&
    !(bodyToSend instanceof URLSearchParams);
  if (isPlainObject) {
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    bodyToSend = JSON.stringify(bodyToSend);
  }

  const res = await fetch(url, {
    ...fetchInit,
    headers,
    body: bodyToSend,
    credentials: "include",
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (isTenantPath) {
        clearTenantToken();
      } else {
        clearAuthToken();
      }
      if (!redirectedOn401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
        redirectedOn401 = true;
        window.location.href = "/login?reason=expired";
      }
    }
    const detail = normalizePlanLimit(data, res.status);
    if (detail && !shouldIgnorePlanLimit(detail)) {
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
