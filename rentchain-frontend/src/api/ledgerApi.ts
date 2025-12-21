import { apiJson } from "@/lib/apiClient";

export type LedgerSummary = {
  tenantId: string;
  totals: {
    paidCents: number;
    dueCents: number;
  };
  recent: any[];
};

export interface LedgerEntry {
  id: string;
  type: string;
  date: string | null;
  amount: number;
  method: string | null;
  notes: string | null;

  tenantId: string;
  tenantName: string;
  propertyName: string;
  unit: string | null;
}

/**
 * GET /ledger
 */
export async function fetchLedger(): Promise<LedgerEntry[]> {
  const data = await apiJson<any>("/ledger");
  if (Array.isArray(data)) return data as LedgerEntry[];
  if (Array.isArray(data?.items)) return data.items as LedgerEntry[];
  return [];
}

export async function fetchTenantLedgerSummary(
  tenantId: string
): Promise<LedgerSummary> {
  try {
    return await apiJson<LedgerSummary>(
      `/ledger/summary?tenantId=${encodeURIComponent(tenantId)}`
    );
  } catch (err: any) {
    const status = err?.status ?? err?.body?.status;
    if (status === 404 || status === 403) {
      return {
        tenantId,
        totals: { paidCents: 0, dueCents: 0 },
        recent: [],
      };
    }
    throw err;
  }
}

export async function fetchTenantLedger(tenantId: string) {
  return apiJson<any>(`/ledger?tenantId=${encodeURIComponent(tenantId)}`);
}
