let warnedBase = false;

export function getApiBaseUrl(): string {
  const rawEnv = (import.meta as any)?.env?.VITE_API_BASE_URL || "";
  let raw = typeof rawEnv === "string" ? rawEnv.trim() : "";

  if (/^value:/i.test(raw)) {
    raw = raw.replace(/^value:/i, "").trim();
  }

  const normalized = raw.replace(/\/$/, "");

  if (normalized && !/^https?:\/\//i.test(normalized)) {
    if (import.meta.env.PROD && !warnedBase) {
      warnedBase = true;
      console.warn(
        "[api] VITE_API_BASE_URL is not absolute; falling back to relative /api. Value:",
        normalized
      );
    }
    return "";
  }

  return normalized || "";
}

export function debugApiBase(): { raw?: string; normalized: string } {
  const rawEnv = (import.meta as any)?.env?.VITE_API_BASE_URL || "";
  return {
    raw: typeof rawEnv === "string" ? rawEnv : undefined,
    normalized: getApiBaseUrl(),
  };
}
