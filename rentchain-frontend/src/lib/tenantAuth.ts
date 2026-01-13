import { DEBUG_AUTH_KEY, JUST_LOGGED_IN_KEY, TENANT_TOKEN_KEY } from "./authKeys";
export { TENANT_TOKEN_KEY } from "./authKeys";

export function getTenantToken() {
  if (typeof window === "undefined") return "";
  const session = sessionStorage.getItem(TENANT_TOKEN_KEY) || "";
  if (session) return session;

  const persisted = localStorage.getItem(TENANT_TOKEN_KEY) ?? "";
  const clean = (persisted || "").trim();
  if (clean) {
    sessionStorage.setItem(TENANT_TOKEN_KEY, clean);
  }
  return clean;
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
  try {
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem(JUST_LOGGED_IN_KEY);
  } catch {
    // ignore
  }
}
