// rentchain-frontend/src/hooks/useTenantDetail.ts
import { useEffect, useState } from "react";
import { fetchTenantDetail, TenantDetailBundle } from "../api/tenantDetail";

export function useTenantDetail(tenantId: string | null | undefined) {
  const [bundle, setBundle] = useState<TenantDetailBundle | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tenantId) {
        setBundle(null);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchTenantDetail(tenantId);
        if (!cancelled) {
          setBundle(data);
        }
      } catch (err: any) {
        console.error("[useTenantDetail] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load tenant detail");
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
  }, [tenantId]);

  return { bundle, loading, error };
}
