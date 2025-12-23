import { apiFetch } from "./http";
import { resolveApiUrl } from "../lib/apiClient";

export interface CreditPeriod {
  period: string;
  rentAmount?: number | null;
  dueDate?: string | null;
  amountPaid: number;
  paidAt?: string | null;
  daysLate?: number | null;
  status: string;
}

export interface TenantCreditHistory {
  schemaVersion: string;
  source: string;
  generatedAt: string;
  tenantId: string;
  leaseId?: string | null;
  periods: CreditPeriod[];
}

export async function fetchCreditHistory(tenantId: string): Promise<TenantCreditHistory> {
  return apiFetch<TenantCreditHistory>(`landlord/tenants/${encodeURIComponent(tenantId)}/credit-history`);
}

export async function downloadCreditHistory(tenantId: string, format: "csv" | "json") {
  const url = resolveApiUrl(
    `/landlord/tenants/${encodeURIComponent(tenantId)}/credit-history/export?format=${format}`
  );
  const res = await fetch(url, {
    headers: {
      Accept: format === "csv" ? "text/csv" : "application/json",
      Authorization: `Bearer ${
        sessionStorage.getItem("rentchain_token") ||
        localStorage.getItem("rentchain_token") ||
        ""
      }`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to download credit history (${res.status})`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `credit-history-${tenantId}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
