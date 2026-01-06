import { useEffect, useRef, useState, useCallback } from "react";
import { fetchDashboardSummary, type DashboardSummaryData } from "../api/dashboard";

type State = {
  data: DashboardSummaryData | null;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
};

export function useDashboardSummary() {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
    lastUpdatedAt: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchDashboardSummary(controller.signal);
      setState((s) => ({
        ...s,
        data,
        loading: false,
        error: null,
        lastUpdatedAt: Date.now(),
      }));
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: err?.message ?? "Failed to load dashboard",
      }));
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    lastUpdatedAt: state.lastUpdatedAt,
    refetch,
  };
}
