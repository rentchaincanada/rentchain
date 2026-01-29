export function getApiBaseUrl(): string {
  const raw =
    process.env.VITE_API_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.RENTCHAIN_API_BASE_URL ||
    "";

  const normalized = String(raw).trim().replace(/\/$/, "").replace(/\/api$/i, "");

  if (!normalized) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("VITE_API_BASE_URL must be absolute (include http/https)");
  }

  return normalized;
}
