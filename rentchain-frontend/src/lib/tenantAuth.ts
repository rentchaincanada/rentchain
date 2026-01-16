import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY, TENANT_TOKEN_KEY } from "./authKeys";
export { TENANT_TOKEN_KEY } from "./authKeys";

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  const expMs = payload.exp * 1000;
  return Date.now() >= expMs;
}

export function getTenantToken(): string | null {
  if (typeof window === "undefined") return null;
  let persisted = "";
  try {
    persisted = localStorage.getItem(TENANT_TOKEN_KEY) ?? "";
  } catch {
    persisted = "";
  }
  const clean = String(persisted || "").trim();
  if (clean) {
    if (clean.split(".").length !== 3) return null;
    if (isTokenExpired(clean)) return null;
    return clean;
  }

  const session = sessionStorage.getItem(TENANT_TOKEN_KEY) || "";
  if (session) {
    if (session.split(".").length !== 3) return null;
    if (isTokenExpired(session)) return null;
    try {
      localStorage.setItem(TENANT_TOKEN_KEY, session);
    } catch {
      // ignore storage errors
    }
    return session;
  }
  return null;
}

export function setTenantToken(token: string) {
  if (typeof window === "undefined") return;
  const clean = String(token ?? "").trim();
  if (!clean || /\s/.test(clean)) return;

  const dbg =
    localStorage.getItem(DEBUG_AUTH_KEY) === "1" ||
    sessionStorage.getItem(DEBUG_AUTH_KEY) === "1" ||
    new URLSearchParams(window.location.search).get("debugAuth") === "1";
  if (dbg) {
    sessionStorage.setItem("debugAuthStoredAt", String(Date.now()));
  }

  sessionStorage.setItem(TENANT_TOKEN_KEY, clean);
  try {
    localStorage.setItem(TENANT_TOKEN_KEY, clean);
    localStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
  } catch {
    // ignore storage errors (private mode, etc.)
  }
  try {
    sessionStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function clearTenantToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TENANT_TOKEN_KEY);
  sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
  try {
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem(JUST_LOGGED_IN_KEY);
  } catch {
    // ignore
  }
}
