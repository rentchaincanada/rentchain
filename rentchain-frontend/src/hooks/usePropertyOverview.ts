// src/hooks/useDashboardOverview.ts
import { useEffect, useState } from "react";
import {
  DashboardOverview,
  fetchDashboardOverview,
} from "../services/dashboardOverviewService";

export function useDashboardOverview() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchDashboardOverview();
        if (!cancelled) {
          setData(result);
        }
      } catch (err: any) {
        console.error("Failed to load dashboard overview", err);
        if (!cancelled) {
          setError("Unable to load dashboard data.");
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
