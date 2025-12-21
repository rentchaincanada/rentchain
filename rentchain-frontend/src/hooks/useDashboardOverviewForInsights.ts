// rentchain-frontend/src/hooks/useDashboardOverviewForInsights.ts
import { useEffect, useState } from "react";
import {
  fetchDashboardOverviewForInsights,
  type DashboardOverviewForInsights as DashboardOverview,
} from "@/api/dashboardApi";

export function useDashboardOverviewForInsights() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const overview = await fetchDashboardOverviewForInsights();
        if (!cancelled) {
          setData(overview);
        }
      } catch (err: any) {
        console.error("[useDashboardOverviewForInsights] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load dashboard overview");
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

  return { data, loading, error };
}
