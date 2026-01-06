import { apiGetJson } from "./http";

export type BillingUsage = {
  landlordId: string;
  period: string;
  unitsCount?: number;
  screeningsCount?: number;
};

export async function fetchBillingUsage(period?: string): Promise<BillingUsage | null> {
  const query = period ? `?period=${encodeURIComponent(period)}` : "";
  const res = await apiGetJson<{ ok: boolean; usage: BillingUsage }>(
    `/landlord/billing/usage${query}`,
    { allowStatuses: [404, 501] }
  );
  if (res.ok) return res.data.usage;
  if (res.status === 404 || res.status === 501) return null;
  return null;
}
