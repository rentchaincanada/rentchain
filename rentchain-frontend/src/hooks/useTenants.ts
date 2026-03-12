// rentchain-frontend/src/hooks/useTenants.ts
import { useEffect, useState } from "react";
import { useAuth } from "@/context/useAuth";
import { fetchTenants, type TenantApiModel } from "@/api/tenantsApi";

export interface Tenant extends TenantApiModel {}

/**
 * Hook to load tenants from /api/tenants
 */
export function useTenants() {
  const { user, ready, authStatus, isLoading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const role = String(user?.actorRole || user?.role || "").trim().toLowerCase();
    const canLoad = role === "landlord" || role === "admin";

    async function load() {
      if (!ready || authLoading || authStatus === "restoring") return;
      if (!canLoad) {
        if (!cancelled) {
          setTenants([]);
          setError(null);
          setLoading(false);
        }
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await fetchTenants();
        if (!cancelled) {
          setTenants(data);
        }
      } catch (err: any) {
        console.error("[useTenants] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load tenants");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authStatus, ready, user?.actorRole, user?.role]);

  return { tenants, loading, error };
}
