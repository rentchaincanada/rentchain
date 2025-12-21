// rentchain-frontend/src/hooks/useTenants.ts
import { useEffect, useState } from "react";
import { fetchTenants, type TenantApiModel } from "@/api/tenantsApi";

export interface Tenant extends TenantApiModel {}

/**
 * Hook to load tenants from /api/tenants
 */
export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
  }, []);

  return { tenants, loading, error };
}
