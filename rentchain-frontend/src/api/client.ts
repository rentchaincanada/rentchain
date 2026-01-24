import axios from "axios";
import { API_BASE_URL } from "./config";
import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY } from "../lib/authKeys";
import { clearAuthToken, getAuthToken, getTenantToken } from "../lib/authToken";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

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

api.interceptors.request.use((config) => {
  const rawUrl = config.url || "";
  let path = rawUrl;
  try {
    if (rawUrl.startsWith("http")) {
      path = new URL(rawUrl).pathname || rawUrl;
    }
  } catch {
    // ignore parse errors; fall back to raw
  }
  const isTenantPath =
    path === "/tenant" ||
    path === "/api/tenant" ||
    path.startsWith("/tenant/") ||
    path.startsWith("/api/tenant/");

  const token = isTenantPath ? getTenantToken() : getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  config.headers = config.headers ?? {};
  (config.headers as any)["x-rc-auth"] = token ? "bearer" : "missing";
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const url = err?.config?.url || "";
    const detail = normalizePlanLimit(data, status);
    if (detail && !shouldIgnorePlanLimit(detail)) {
      dispatchPlanLimit(detail);
    }
    if (status !== 401 && status !== 403) {
      return Promise.reject(err);
    }

    if (status === 401) {
      clearAuthToken();
    }

    const graceRaw =
      (typeof window !== "undefined" &&
        (localStorage.getItem(JUST_LOGGED_IN_KEY) ||
          sessionStorage.getItem(JUST_LOGGED_IN_KEY))) ||
      "0";
    const graceAt = Number(graceRaw || "0");
    const inGrace = graceAt > 0 && Date.now() - graceAt < 5000;

    if (inGrace) {
      return Promise.reject(err);
    }

    const tok =
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(TOKEN_KEY) ||
      "";
    const parts = tok.split(".");
    let reason: "missing" | "expired" | "unauthorized" = "missing";

    if (tok) {
      if (parts.length === 3) {
        try {
          let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          while (b64.length % 4) b64 += "=";
          const payload = JSON.parse(atob(b64));
          if (typeof payload?.exp === "number") {
            const expMs = payload.exp * 1000;
            if (Date.now() >= expMs - 30_000) {
              reason = "expired";
            } else {
              reason = "unauthorized";
            }
          } else {
            reason = "missing";
          }
        } catch {
          reason = "missing";
        }
      } else {
        reason = "missing";
      }
    }

    try {
      localStorage.setItem(
        "authLast401",
        JSON.stringify({
          ts: Date.now(),
          url: typeof url === "string" ? url.slice(0, 180) : "",
          status,
          reason,
        })
      );
    } catch {
      // ignore
    }

    if (reason === "expired") {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      try {
        localStorage.removeItem(JUST_LOGGED_IN_KEY);
      } catch {
        // ignore
      }
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        const dbg = localStorage.getItem(DEBUG_AUTH_KEY) === "1";
        const suffix = dbg ? `?reason=expired&debugAuth=1` : `?reason=expired`;
        window.location.href = `/login${suffix}`;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
