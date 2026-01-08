import { apiFetch } from "./apiFetch";

export type TenantEvent = {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  amount?: number | null;
  occurredAt?: any;
  createdAt?: any;
  source?: string;
};

export async function getTenantEvents(limit = 25): Promise<TenantEvent[] | null> {
  const res = await apiFetch(
    `/api/tenant/events?limit=${limit}`,
    { method: "GET" },
    { allow404: true, suppressToasts: true }
  );

  if (!res) return null;
  if (Array.isArray(res)) return res as TenantEvent[];
  if (Array.isArray((res as any).items)) return (res as any).items as TenantEvent[];
  if (Array.isArray((res as any).events)) return (res as any).events as TenantEvent[];
  return [];
}
