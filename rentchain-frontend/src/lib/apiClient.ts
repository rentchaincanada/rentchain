import API_BASE from "../config/apiBase";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem("rentchain_tenant_token") ||
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("token") ||
    null
  );
}

export function setAuthToken(token: string) {
  sessionStorage.setItem("rentchain_token", token);
}

export function clearAuthToken() {
  sessionStorage.removeItem("rentchain_token");
  localStorage.removeItem("rentchain_token");
  sessionStorage.removeItem("token");
  localStorage.removeItem("token");
}

export function resolveApiUrl(input: string) {
  const sRaw = String(input || "").trim();
  const base = (API_BASE || "").replace(/\/$/, "");

  if (!sRaw) return base;
  if (/^https?:\/\//i.test(sRaw)) return sRaw;

  const [pathPart, queryPart] = sRaw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const normalized = path.startsWith("/api/") ? path : `/api${path}`;
  return `${base}${normalized}${queryPart ? `?${queryPart}` : ""}`;
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

  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  headers.set("X-Rentchain-ApiClient", "1");
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(p, { ...init, headers, credentials: "include" });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  if (!res.ok) {
    const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
    const err = new Error(
      `apiFetch ${res.status}: ${isJson ? JSON.stringify(payload) : String(payload)}`
    );
    (err as any).payload = payload;
    throw err;
  }

  return isJson ? res.json() : { ok: true, text: await res.text() };
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  return res as T;
}
