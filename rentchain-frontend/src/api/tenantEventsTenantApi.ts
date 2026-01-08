import { apiFetch } from "./apiFetch";

export type TenantEvent = {
  id: string;
  type?: string;
  title?: string;
  description?: string;

  // Timeline expects these optional fields
  amountCents?: number;
  currency?: string;
  daysLate?: number;
  noticeType?: string;

  occurredAt?: any;
  createdAt?: any;
  source?: string;

  [key: string]: any;
};

export async function getTenantEvents(limit = 25): Promise<TenantEvent[]> {
  try {
    const res: any = await apiFetch(`/api/tenant/events?limit=${limit}`, { method: "GET" });

    if (!res) return [];
    if (Array.isArray(res)) return res as TenantEvent[];
    if (Array.isArray(res.items)) return res.items as TenantEvent[];
    if (Array.isArray(res.events)) return res.events as TenantEvent[];
    return [];
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("404")) return [];
    return [];
  }
}
