// src/services/tenantBalanceApi.ts
import { apiFetch } from "@/api/apiFetch";

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
  return apiFetch<TenantBalanceSummary>(
    `/tenant-balance/${encodeURIComponent(tenantId)}`
  );
}
