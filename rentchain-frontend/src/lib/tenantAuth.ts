export const TENANT_TOKEN_KEY = "rentchain_tenant_token";

export function getTenantToken() {
  return sessionStorage.getItem(TENANT_TOKEN_KEY) || "";
}

export function setTenantToken(token: string) {
  sessionStorage.setItem(TENANT_TOKEN_KEY, token);
}

export function clearTenantToken() {
  sessionStorage.removeItem(TENANT_TOKEN_KEY);
}
