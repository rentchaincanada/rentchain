// rentchain-frontend/src/hooks/usePortfolioSummary.ts
import { useEffect, useState } from "react";
import {
  fetchAiPortfolioSummary,
  type AiPortfolioSummary,
} from "@/api/dashboardApi";

export function usePortfolioSummary() {
  const [data, setData] = useState<AiPortfolioSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const summary = await fetchAiPortfolioSummary();
        if (!cancelled) {
          setData(summary);
        }
      } catch (err: any) {
        console.error("[usePortfolioSummary] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load portfolio summary");
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
