const KEY = "rentchain_tenant_token";

export function setTenantToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
}

export function getTenantToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function clearTenantToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
