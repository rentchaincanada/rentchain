import axios from "axios";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token");
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
    if (status === 403 && data?.error === "PLAN_LIMIT") {
      try {
        window.dispatchEvent(
          new CustomEvent("upgrade:plan-limit", {
            detail: {
              limitType: data?.limitType,
              max: data?.limit,
              message: data?.message,
            },
          })
        );
      } catch {
        // no-op
      }
    }
    if (status === 401) {
      sessionStorage.removeItem("rentchain_token");
      localStorage.removeItem("rentchain_token");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login?reason=expired";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
