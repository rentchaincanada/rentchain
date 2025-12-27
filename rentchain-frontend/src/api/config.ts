import API_BASE from "../config/apiBase";

/**
 * API origin, e.g. https://api.rentchain.ai (no trailing slash)
 * Falls back to localhost only in dev via API_BASE logic.
 */
export const API_HOST = (API_BASE || "").replace(/\/$/, "");

/**
 * Full API base including /api prefix
 * e.g. https://api.rentchain.ai/api
 */
export const API_BASE_URL = API_HOST ? `${API_HOST}/api` : "";

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_HOST}${p}`;
}
