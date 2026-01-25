import { getApiBaseUrl } from "./baseUrl";

const host = getApiBaseUrl();
const normalizedHost = host ? host.replace(/\/$/, "").replace(/\/api$/i, "") : "";
export const API_HOST = normalizedHost;
export const API_BASE_URL = normalizedHost;

export function apiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not configured");
  }
  let p = path.startsWith("/") ? path : `/${path}`;
  if (!p.startsWith("/api/")) {
    p = `/api${p}`;
  }
  return `${API_BASE_URL}${p}`;
}
