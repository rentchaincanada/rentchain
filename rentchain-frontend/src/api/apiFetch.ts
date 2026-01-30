import { API_BASE_URL } from "./config";
import { clearAuthToken, clearTenantToken, getAuthToken, getTenantToken } from "../lib/authToken";
import { maybeDispatchUpgradePrompt } from "../lib/upgradePrompt";

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
  const base = API_BASE_URL.replace(/\/$/, "").replace(/\/api$/i, "");
  if (!(apiFetch as any)._loggedBase) {
    console.log("[apiFetch] API base:", base);
    (apiFetch as any)._loggedBase = true;
  }

  const normalizedPath = (() => {
    if (path.startsWith("http")) return path;
    let p = path;
    if (p.startsWith("/api/api/")) {
      p = p.replace("/api/api/", "/api/");
    } else if (p.startsWith("api/api/")) {
      p = p.replace("api/api/", "api/");
    }
    if (p.startsWith("/api/")) {
      return `${base}${p}`;
    }
    if (p.startsWith("api/")) {
      return `${base}/${p}`;
    }
    if (p.startsWith("/")) {
      return `${base}/api${p}`;
    }
    return `${base}/api/${p}`;
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
  const rawToken = isTenantPath ? getTenantToken() : getAuthToken();
  const token = typeof rawToken === "string" ? rawToken.trim() : rawToken;

  const url = normalizedPath;

  const { allowStatuses, allow404, suppressToasts, ...fetchInit } = init;

  const headers: Record<string, string> = {
    ...(fetchInit.headers as any),
  };

  // Mark requests coming from our API helpers so the dev fetch-guard doesn't warn
  headers["x-api-client"] = "web";
  const hasToken = typeof token === "string" ? token.trim().length > 0 : false;
  const authHeaderSet = hasToken;
  headers["x-rc-auth"] = authHeaderSet ? "bearer" : "missing";

  if (authHeaderSet) headers.Authorization = `Bearer ${token}`;

  if (import.meta.env.DEV) {
    const matchPath =
      pathForMatch === "/tenant-invites" ||
      pathForMatch === "/api/tenant-invites" ||
      pathForMatch.startsWith("/tenant-invites/") ||
      pathForMatch.startsWith("/api/tenant-invites/");
    const isCreate =
      matchPath &&
      String(fetchInit.method || "GET").toUpperCase() === "POST" &&
      (pathForMatch === "/tenant-invites" || pathForMatch === "/api/tenant-invites");
    if (isCreate) {
      console.debug("[tenant-invites] auth header check", { hasToken, authHeaderSet });
    }
  }

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
    if (res.status === 404 && (allow404 || allowStatuses?.includes(404))) {
      return null as T;
    }
    const msg = data?.message || data?.error || text || `apiFetch ${res.status}`;
    maybeDispatchUpgradePrompt(data, res.status);
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
