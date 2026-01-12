export const TENANT_TOKEN_KEY = "rentchain_tenant_token";
const PRIMARY_KEY = "rentchain_token";

export function getTenantToken() {
  if (typeof window === "undefined") return "";
  const session =
    sessionStorage.getItem(TENANT_TOKEN_KEY) ||
    sessionStorage.getItem(PRIMARY_KEY) ||
    "";
  if (session) return session;

  const persisted =
    (localStorage.getItem(TENANT_TOKEN_KEY) ||
      localStorage.getItem(PRIMARY_KEY) ||
      "") ?? "";
  const clean = (persisted || "").trim();
  if (clean) {
    sessionStorage.setItem(TENANT_TOKEN_KEY, clean);
    sessionStorage.setItem(PRIMARY_KEY, clean);
  }
  return clean;
}

export function setTenantToken(token: string) {
  if (typeof window === "undefined") return;
  const clean = String(token ?? "").trim();
  if (!clean || /\s/.test(clean)) return;

  const dbg =
    sessionStorage.getItem("debugAuthEnabled") === "1" ||
    new URLSearchParams(window.location.search).get("debugAuth") === "1";
  if (dbg) {
    sessionStorage.setItem("debugAuthStoredAt", String(Date.now()));
  }

  sessionStorage.setItem(TENANT_TOKEN_KEY, clean);
  sessionStorage.setItem(PRIMARY_KEY, clean);
  try {
    localStorage.setItem(TENANT_TOKEN_KEY, clean);
    localStorage.setItem(PRIMARY_KEY, clean);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export function clearTenantToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TENANT_TOKEN_KEY);
  sessionStorage.removeItem(PRIMARY_KEY);
  try {
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem(PRIMARY_KEY);
  } catch {
    // ignore
  }
}
