import { useEffect, useState, useCallback } from "react";
import { listLedgerV2, LedgerEventV2 } from "../api/ledgerV2";

type Params = {
  tenantId?: string;
  propertyId?: string;
  limit?: number;
};

export function useLedgerV2(params: Params = {}) {
  const [items, setItems] = useState<LedgerEventV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLedgerV2({
        tenantId: params.tenantId,
        propertyId: params.propertyId,
        limit: params.limit ?? 10,
      });
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }, [params.limit, params.propertyId, params.tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
