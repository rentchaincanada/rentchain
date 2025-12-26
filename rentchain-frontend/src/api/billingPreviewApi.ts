import { apiJson } from "../lib/apiClient";

export type BillingUsage = {
  landlordId: string;
  period: string;
  unitsCount?: number;
  screeningsCount?: number;
};

export async function fetchBillingUsage(period?: string): Promise<BillingUsage> {
  const query = period ? `?period=${encodeURIComponent(period)}` : "";
  const res = await apiJson<{ ok: boolean; usage: BillingUsage }>(`/landlord/billing/usage${query}`);
  return res.usage;
}
