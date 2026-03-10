export type AuthRole = "landlord" | "tenant" | "contractor" | "admin" | null | undefined;

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
  if (value === "tenant") return "/tenant";
  if (value === "contractor") return "/contractor";
  if (value === "admin") return "/admin";
  return "/dashboard";
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

export function buildOnboardContinuationPath(token: string, source?: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (source) params.set("source", source);
  const query = params.toString();
  return query ? `/auth/onboard?${query}` : "/auth/onboard";
}

