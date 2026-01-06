export function getApiBaseUrl(): string {
  const raw = (import.meta as any)?.env?.VITE_API_BASE_URL || "";
  const trimmed = typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
  return trimmed || "";
}
