import { getApiBaseUrl } from "./baseUrl";

const host = getApiBaseUrl();
export const API_HOST = host;
export const API_BASE_URL = host ? `${host.replace(/\/$/, "")}/api` : "";

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not configured");
  }
  return `${API_BASE_URL}${p}`;
}
