// src/services/tenantBalanceApi.ts
import { apiFetch } from "@/api/apiFetch";

export interface TenantBalanceSummary {
  tenantReference: string | null;
  totalCharges: number;
  totalPayments: number;
  totalAdjustments: number;
  totalNsfFees: number;
  currentBalance: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  nextChargeDate: string | null;
  nextChargeAmount: number | null;
}

export async function fetchTenantBalance(
  tenantId: string
): Promise<TenantBalanceSummary> {
  return apiFetch<TenantBalanceSummary>(
    `/tenant-balance/${encodeURIComponent(tenantId)}`
  );
}
