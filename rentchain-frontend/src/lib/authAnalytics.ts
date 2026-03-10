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

/**
 * Operator verification notes:
 * - Frontend local inspection: listen for `rentchain:auth-analytics` in browser devtools.
 * - Backend production inspection: filter Cloud Run logs for `auth.onboard.` events.
 * Privacy: raw tokens/password fields are redacted before emission.
 */
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
