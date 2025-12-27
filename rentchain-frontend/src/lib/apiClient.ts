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
  const s = String(input || "").trim();
  const base = (API_BASE || "").replace(/\/$/, "");

  if (!s) return base;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${base}${s}`;
  return `${base}/${s}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
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
  return fetch(resolveApiUrl(path), { ...init, headers, credentials: "include" });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();

  if (!res.ok) {
    // Attempt to parse JSON error
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (res.status === 402 && parsed?.code === "PLAN_LIMIT_EXCEEDED") {
      // Notify the app globally so the Upgrade modal can open
      try {
        window.dispatchEvent(
          new CustomEvent("upgrade:plan-limit", {
            detail: {
              limitType: parsed?.limitType,
              max: parsed?.max,
              current: parsed?.current,
              attempted: parsed?.attempted,
              plan: parsed?.plan,
            },
          })
        );
      } catch {
        // ignore event errors
      }

      const err: any = new Error("PLAN_LIMIT_EXCEEDED");
      err.code = "PLAN_LIMIT_EXCEEDED";
      err.payload = parsed;
      throw err;
    }

    const err: any = new Error(`${res.status} ${res.statusText}: ${text}`);
    err.payload = parsed;
    try {
      // Allow debug panel to read the last API error in dev
      const mod = await import("../components/DebugPanel");
      if (mod && typeof mod.setLastApiError === "function") {
        mod.setLastApiError(err);
      }
    } catch {
      // ignore
    }
    throw err;
  }

  return text ? (JSON.parse(text) as T) : (null as T);
}
