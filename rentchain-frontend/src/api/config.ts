import { getApiBaseUrl } from "./baseUrl";

const raw = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export const API_HOST = raw;
export const API_BASE_URL = import.meta.env.PROD ? "" : raw;

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return raw ? `${raw}${p}` : p;
}
