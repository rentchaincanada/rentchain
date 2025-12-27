import { useEffect, useState } from "react";
import API_BASE from "../config/apiBase";

export type TenantPayment = {
  id: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: "Paid" | "Late" | "Unpaid";
};

type UseTenantPaymentsResult = {
  data: TenantPayment[] | null;
  loading: boolean;
  error: string | null;
};

export function useTenantPayments(tenantId: string | null): UseTenantPaymentsResult {
  const [data, setData] = useState<TenantPayment[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchPayments() {
      try {
        setLoading(true);
        setError(null);

        const base = API_BASE.replace(/\/$/, "");
        const res = await fetch(`${base}/api/tenants/${tenantId}/payments`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = (await res.json()) as TenantPayment[];

        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Failed to load tenant payments", err);
          setError(err?.message ?? "Failed to load tenant payments");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPayments();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return { data, loading, error };
}
