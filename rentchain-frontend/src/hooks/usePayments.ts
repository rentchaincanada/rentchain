// rentchain-frontend/src/hooks/usePayments.ts
import { useEffect, useState } from "react";
import { fetchPayments, type PaymentRecord } from "@/api/paymentsApi";
import { useAuth } from "@/context/useAuth";

export function usePayments() {
  const { user, token, ready, authStatus, isLoading: authLoading } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
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
          setPayments([]);
          setError(null);
          setLoading(false);
        }
        return;
      }
      try {
        setLoading(true);
        setError(null);
        setPayments([]);
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
  }, [
    authLoading,
    authStatus,
    ready,
    token,
    user?.actorLandlordId,
    user?.actorRole,
    user?.id,
    user?.landlordId,
    user?.role,
  ]);

  return { payments, loading, error };
}
