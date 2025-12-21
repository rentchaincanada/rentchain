// src/hooks/useDashboardOverview.ts

import { useEffect, useState, useCallback } from "react";
import { apiJson } from "../lib/apiClient";

/**
 * Very flexible shape so it works with current and future
 * dashboard overview responses without breaking TS.
 */
export interface DashboardOverviewData {
  kpis?: {
    totalProperties?: number;
    totalUnits?: number;
    occupancyRate?: number;          // 0–1 or 0–100 depending on backend
    monthlyRentRoll?: number;
    monthlyCollected?: number;
    monthlyDelinquent?: number;
    [key: string]: any;
  };
  properties?: Array<{
    id?: string;
    name?: string;
    city?: string;
    units?: number;
    occupiedUnits?: number;
    occupancyRate?: number;
    avgRent?: number;
    risk?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

interface UseDashboardOverviewResult {
  data: DashboardOverviewData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Fetches the unified dashboard overview from the API.
 * Tries to be resilient to different response shapes:
 *   { overview: {...} }
 *   { data: {...} }
 *   { ...directOverview }
 */
export function useDashboardOverview(): UseDashboardOverviewResult {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const raw = await apiJson<any>("/dashboard/overview");

      // Try to detect where the actual overview lives
      let overview: any = raw;
      if (raw && typeof raw === "object") {
        if ("overview" in raw && raw.overview) {
          overview = raw.overview;
        } else if ("data" in raw && raw.data) {
          overview = raw.data;
        }
      }

      if (!overview || typeof overview !== "object") {
        throw new Error("Unexpected dashboard overview response shape.");
      }

      setData(overview as DashboardOverviewData);
    } catch (err: any) {
      console.error("[useDashboardOverview] error:", err);
      setError(err?.message || "Failed to load dashboard overview.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
