import { getApiBaseUrl } from "./baseUrl";

const base = getApiBaseUrl();
export const API_HOST = base;
export const API_BASE_URL = base ? `${base}/api` : "";

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
