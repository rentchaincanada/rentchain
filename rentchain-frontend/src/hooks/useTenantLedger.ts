import { useEffect, useState } from "react";
import { apiJson } from "@/lib/apiClient";

export type TenantInvoice = {
  id: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  dueDate: string;
};

export type TenantLedgerPayment = {
  id: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: "Paid" | "Late" | "Unpaid";
};

export type TenantLedger = {
  tenantId: string;
  propertyId: string;
  monthlyRent: number;
  invoices: TenantInvoice[];
  payments: TenantLedgerPayment[];
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  lastPaymentAt: string | null;
};

type UseTenantLedgerResult = {
  data: TenantLedger | null;
  loading: boolean;
  error: string | null;
};

export function useTenantLedger(tenantId: string | null): UseTenantLedgerResult {
  const [data, setData] = useState<TenantLedger | null>(null);
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

    async function fetchLedger() {
      try {
        setLoading(true);
        setError(null);

        const json = await apiJson<TenantLedger>(`/tenants/${tenantId}/ledger`);
        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Failed to load tenant ledger", err);
          setError(err?.message ?? "Failed to load tenant ledger");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLedger();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return { data, loading, error };
}
