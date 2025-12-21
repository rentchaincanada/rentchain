// rentchain-frontend/src/hooks/useLedger.ts
import { useEffect, useState } from "react";
import { fetchLedger, type LedgerEntry } from "@/api/ledgerApi";

export function useLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLedger();
        if (!cancelled) {
          setEntries(data);
        }
      } catch (err: any) {
        console.error("[useLedger] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load ledger");
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

  return { entries, loading, error };
}
