let warnedBase = false;
let warnedMissing = false;

export function getApiBaseUrl(): string {
  const rawEnv = (import.meta as any)?.env?.VITE_API_BASE_URL || "";
  let raw = typeof rawEnv === "string" ? rawEnv.trim() : "";

  if (/^value:/i.test(raw)) {
    raw = raw.replace(/^value:/i, "").trim();
  }

  const normalized = raw.replace(/\/$/, "");

  if (!normalized) {
    if (import.meta.env.PROD) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.error("[api] VITE_API_BASE_URL is missing. API calls will fail.");
      }
      return "";
    }
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  if (!/^https?:\/\//i.test(normalized)) {
    if (import.meta.env.PROD && !warnedBase) {
      warnedBase = true;
      console.error("[api] VITE_API_BASE_URL must be absolute. Value:", normalized);
    }
    if (!import.meta.env.PROD) {
      throw new Error("VITE_API_BASE_URL must be absolute (include http/https)");
    }
    return "";
  }

  return normalized;
}

export function debugApiBase(): { raw?: string; normalized: string } {
  const rawEnv = (import.meta as any)?.env?.VITE_API_BASE_URL || "";
  return {
    raw: typeof rawEnv === "string" ? rawEnv : undefined,
    normalized: getApiBaseUrl(),
  };
}
