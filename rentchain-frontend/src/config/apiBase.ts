const rawEnvBase =
  (import.meta as any).env?.VITE_API_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "";

const fallbackBase =
  typeof window !== "undefined" && import.meta.env.DEV
    ? window.location.origin
    : "";

export const API_BASE = String(rawEnvBase || fallbackBase).replace(/\/$/, "");

export const API_BASE_URL = API_BASE
  ? `${API_BASE}/api`
  : "http://localhost:3000/api";
