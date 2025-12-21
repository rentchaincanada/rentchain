// rentchain-frontend/src/hooks/usePayments.ts
import { useEffect, useState } from "react";
import { fetchPayments, type PaymentRecord } from "@/api/paymentsApi";

export function usePayments() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPayments();
        if (!cancelled) {
          setPayments(data);
        }
      } catch (err: any) {
        console.error("[usePayments] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load payments");
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

  return { payments, loading, error };
}
