import { clearTenantToken, TENANT_TOKEN_KEY } from "./tenantAuth";

export function logoutTenant(redirectTo = "/tenant/login") {
  clearTenantToken();

  if (typeof window === "undefined") return;

  // Remove known tenant session markers that should not persist after sign-out.
  try {
    sessionStorage.removeItem("tenantInviteToken");
    sessionStorage.removeItem("tenantInviteEmail");
    sessionStorage.removeItem("tenantAuthEmail");
    sessionStorage.removeItem(TENANT_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }

  try {
    localStorage.removeItem(TENANT_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }

  window.location.assign(redirectTo);
}
