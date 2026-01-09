import { apiFetch } from "./apiFetch";

export type LedgerIntegrityStatus = "verified" | "unverified" | "broken";

export interface LedgerEventStored {
  id: string;
  landlordId: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  actor: { userId: string; role: string; email?: string };
  type: string;
  version: 1;
  ts: number;
  seq: number;
  prevHash: string | null;
  payload: any;
  payloadHash: string;
  hash: string;
  integrity: { status: LedgerIntegrityStatus; verifiedAt?: number; reason?: string };
  source?: { route?: string; requestId?: string; ip?: string };
}

export async function fetchLedger(params: { limit?: number; tenantId?: string; propertyId?: string }): Promise<LedgerEventStored[]> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.tenantId) search.set("tenantId", params.tenantId);
  if (params?.propertyId) search.set("propertyId", params.propertyId);

  const path = `/api/ledger${search.toString() ? `?${search.toString()}` : ""}`;
  const res: any = await apiFetch(path, { method: "GET" });

  if (Array.isArray(res)) return res as LedgerEventStored[];
  if (res?.items && Array.isArray(res.items)) return res.items as LedgerEventStored[];
  if (res?.ok && Array.isArray(res?.items)) return res.items as LedgerEventStored[];
  return [];
}

export async function verifyLedger(limit = 500): Promise<{ ok: boolean; checked: number; brokenAt?: string; reason?: string }> {
  const res: any = await apiFetch(`/api/ledger/verify?limit=${limit}`, { method: "GET" });

  if (res?.result) return res.result as any;
  if (res?.ok !== undefined && res?.checked !== undefined) return res as any;
  return res as any;
}
