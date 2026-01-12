import axios from "axios";
import { API_BASE_URL } from "./config";
import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY, TOKEN_KEY } from "../lib/authKeys";

const api = axios.create({
  baseURL: API_BASE_URL,
});

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

api.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const detail = normalizePlanLimit(data, status);
    if (detail) {
      dispatchPlanLimit(detail);
    }
    if (status === 401) {
      const tok =
        sessionStorage.getItem(TOKEN_KEY) ||
        localStorage.getItem(TOKEN_KEY) ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("token") ||
        "";
      const parts = tok.split(".");
      let reason = "missing";
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
                reason = "invalid";
              }
            } else {
              reason = "invalid";
            }
          } catch {
            reason = "invalid";
          }
        } else {
          reason = "invalid";
        }
      }
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      try {
        localStorage.removeItem(JUST_LOGGED_IN_KEY);
      } catch {
        // ignore
      }
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        const dbg = localStorage.getItem(DEBUG_AUTH_KEY) === "1";
        const suffix =
          reason === "missing"
            ? dbg
              ? "?debugAuth=1"
              : ""
            : dbg
            ? `?reason=${reason}&debugAuth=1`
            : `?reason=${reason}`;
        window.location.href = `/login${suffix}`;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
