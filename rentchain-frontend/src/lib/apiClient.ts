import { getApiBaseUrl } from "../api/baseUrl";
import { clearAuthToken, getAuthToken, setAuthToken } from "./authToken";
import { maybeDispatchUpgradePrompt } from "./upgradePrompt";

let warnedMisconfig = false;

export { getAuthToken, setAuthToken, clearAuthToken };

export function resolveApiUrl(input: string) {
  const sRaw = String(input || "").trim();
  const base = (getApiBaseUrl() || "").replace(/\/$/, "");

  if (!sRaw) return base;
  if (/^https?:\/\//i.test(sRaw)) return sRaw;

  const [pathPart, queryPart] = sRaw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const stripApi = path.startsWith("/api/") ? path.slice(4) : path;
  const normalized = stripApi.startsWith("/") ? stripApi : `/${stripApi}`;
  const url = `${base}/api${normalized}${queryPart ? `?${queryPart}` : ""}`;

  if (
    import.meta.env.DEV &&
    !warnedMisconfig &&
    typeof window !== "undefined" &&
    window.location.host.includes("rentchain.ai") &&
    url.startsWith("https://www.rentchain.ai/api/")
  ) {
    warnedMisconfig = true;
    console.warn(
      "API base misconfigured: requests are hitting Vercel. Set VITE_API_BASE_URL to Cloud Run."
    );
  }

  return url;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  // 1) normalize accidental double /api/api
  let p = String(path || "");
  p = p.replace(/^\/api\/api\//, "/api/").replace(/^api\/api\//, "api/");

  // 2) allow callers to pass either "/api/xxx" or "/xxx"
  if (!(p.startsWith("http://") || p.startsWith("https://"))) {
    const stripApi = p.startsWith("/api/") ? p.slice(4) : p; // remove leading "/api"
    p = `/api${stripApi.startsWith("/") ? "" : "/"}${stripApi}`;
  }

  const url = resolveApiUrl(p);

  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  headers.set("x-api-client", "web");
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(url, { ...init, headers, credentials: "include" });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  if (!res.ok) {
    const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
    maybeDispatchUpgradePrompt(payload, res.status);
    const err = new Error(
      `apiFetch ${res.status}: ${isJson ? JSON.stringify(payload) : String(payload)}`
    );
    (err as any).payload = payload;
    (err as any).status = res.status;
    throw err;
  }

  return isJson ? res.json() : { ok: true, text: await res.text() };
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  return res as T;
}
