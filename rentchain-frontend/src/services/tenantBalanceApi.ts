// src/services/tenantBalanceApi.ts
import { API_BASE_URL } from "../config/api";

export interface TenantBalanceSummary {
  tenantId: string;
  totalCharges: number;
  totalPayments: number;
  totalAdjustments: number;
  totalNsfFees: number;
  currentBalance: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  nextChargeDate: string | null;
  nextChargeAmount: number | null;
  eventCount: number;
}

export async function fetchTenantBalance(
  tenantId: string
): Promise<TenantBalanceSummary> {
  const url = `${API_BASE_URL}/tenant-balance/${encodeURIComponent(tenantId)}`;
  console.log("[Balance] Fetching:", url);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[Balance] API error",
      res.status,
      res.statusText,
      "Response:",
      text
    );
    throw new Error(
      `Failed to fetch tenant balance: ${res.status} ${res.statusText}`
    );
  }

  const json = (await res.json()) as TenantBalanceSummary;
  return json;
}
