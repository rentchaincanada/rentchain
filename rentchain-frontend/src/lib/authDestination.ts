export type AuthRole =
  | "landlord"
  | "tenant"
  | "contractor"
  | "admin"
  | "delegate"
  | "property_manager_company"
  | null
  | undefined;

export const TENANT_DEFAULT_DESTINATION = "/tenant/dashboard";
export const DELEGATED_ACCESS_DEFAULT_DESTINATION = "/delegated-access/workspace";
export const PROPERTY_MANAGER_COMPANY_DEFAULT_DESTINATION = "/property-manager-companies/management";

export function getSafeInternalRedirect(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\n") || value.includes("\r")) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith("/http://") || lower.startsWith("/https://") || lower.startsWith("/javascript:")) {
    return null;
  }
  return value;
}

export function getRoleDefaultDestination(role: AuthRole): string {
  const value = String(role || "").trim().toLowerCase();
  if (value === "tenant") return TENANT_DEFAULT_DESTINATION;
  if (value === "contractor") return "/contractor";
  if (value === "admin") return "/admin";
  if (value === "delegate") return DELEGATED_ACCESS_DEFAULT_DESTINATION;
  if (value === "property_manager_company") return PROPERTY_MANAGER_COMPANY_DEFAULT_DESTINATION;
  return "/dashboard";
}

export function getSafeTenantRedirect(raw: string | null | undefined): string | null {
  const value = getSafeInternalRedirect(raw);
  if (!value) return null;
  if (value === "/tenant") return null;
  if (value === "/tenant/login" || value.startsWith("/tenant/login?")) return null;
  if (value === "/tenant/magic" || value.startsWith("/tenant/magic?")) return null;
  if (value === "/auth/magic" || value.startsWith("/auth/magic?")) return null;
  if (value === "/auth/onboard" || value.startsWith("/auth/onboard?")) return value;
  if (value === TENANT_DEFAULT_DESTINATION || value.startsWith("/tenant/")) return value;
  return null;
}

export function readTenantDestinationFromSearch(search: string): string | null {
  const params = new URLSearchParams(search || "");
  return (
    getSafeTenantRedirect(params.get("redirect")) ||
    getSafeTenantRedirect(params.get("next")) ||
    getSafeTenantRedirect(params.get("continueUrl"))
  );
}

export function readDestinationFromSearch(search: string): string | null {
  const params = new URLSearchParams(search || "");
  return (
    getSafeInternalRedirect(params.get("redirect")) ||
    getSafeInternalRedirect(params.get("next")) ||
    getSafeInternalRedirect(params.get("continueUrl"))
  );
}

export function resolvePostAuthDestination(input: {
  search?: string;
  explicitDestination?: string | null;
  backendRedirect?: string | null;
  role?: AuthRole;
  fallback?: string;
}): { destination: string; usedFallback: boolean; source: string } {
  const explicit = getSafeInternalRedirect(input.explicitDestination || null);
  if (explicit) return { destination: explicit, usedFallback: false, source: "explicit" };

  const backend = getSafeInternalRedirect(input.backendRedirect || null);
  if (backend) return { destination: backend, usedFallback: false, source: "backend" };

  const fromSearch = readDestinationFromSearch(input.search || "");
  if (fromSearch) return { destination: fromSearch, usedFallback: false, source: "query" };

  if (input.role) {
    return {
      destination: getRoleDefaultDestination(input.role),
      usedFallback: false,
      source: "role-default",
    };
  }

  const fallback = getSafeInternalRedirect(input.fallback || "/dashboard") || "/dashboard";
  return { destination: fallback, usedFallback: true, source: "fallback" };
}

export function resolveTenantPostAuthDestination(input: {
  search?: string;
  explicitDestination?: string | null;
  backendRedirect?: string | null;
  fallback?: string | null;
}): { destination: string; usedFallback: boolean; source: string } {
  const explicit = getSafeTenantRedirect(input.explicitDestination || null);
  if (explicit) return { destination: explicit, usedFallback: false, source: "explicit" };

  const backend = getSafeTenantRedirect(input.backendRedirect || null);
  if (backend) return { destination: backend, usedFallback: false, source: "backend" };

  const fromSearch = readTenantDestinationFromSearch(input.search || "");
  if (fromSearch) return { destination: fromSearch, usedFallback: false, source: "query" };

  const fallback = getSafeTenantRedirect(input.fallback || TENANT_DEFAULT_DESTINATION);
  if (fallback) {
    return { destination: fallback, usedFallback: true, source: "fallback" };
  }

  return { destination: TENANT_DEFAULT_DESTINATION, usedFallback: true, source: "tenant-default" };
}

export function buildOnboardContinuationPath(token: string, source?: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (source) params.set("source", source);
  const query = params.toString();
  return query ? `/auth/onboard?${query}` : "/auth/onboard";
}
