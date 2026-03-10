export type AuthAnalyticsPayload = Record<string, unknown>;

function redactPayload(payload: AuthAnalyticsPayload): AuthAnalyticsPayload {
  const next: AuthAnalyticsPayload = {};
  for (const [key, value] of Object.entries(payload || {})) {
    const lower = key.toLowerCase();
    if (lower.includes("token") && !lower.includes("fingerprint")) {
      continue;
    }
    if (lower.includes("password")) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function fingerprintToken(token: string | null | undefined): string {
  const value = String(token || "").trim();
  if (!value) return "none";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function trackAuthEvent(event: string, payload: AuthAnalyticsPayload = {}) {
  const safePayload = redactPayload(payload);
  if (import.meta.env.DEV) {
    console.info(`[analytics] ${event}`, safePayload);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("rentchain:auth-analytics", {
        detail: { event, ...safePayload },
      })
    );
  }
}

