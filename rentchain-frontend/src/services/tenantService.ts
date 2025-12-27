// src/services/tenantService.ts

import API_BASE from "../config/apiBase";

const API_BASE_URL = API_BASE.replace(/\/$/, "");

export type TenantPaymentRow = {
  date: string;
  dueAmount: number;
  paidAmount: number;
  status: string;
};

export type TenantOverview = {
  id: string;
  name: string;
  propertyName: string;
  unitLabel: string;
  monthlyRent: number;
  email: string;
  phone: string;
  leaseStart: string;
  leaseEnd: string;
  onTimePayments: number;
  latePayments: number;
  payments: TenantPaymentRow[];
};

export async function fetchTenantOverview(
  tenantId: string
): Promise<TenantOverview> {
  const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/overview`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Tenant overview API error ${res.status}: ${
        text || res.statusText || "Unknown error"
      }`
    );
  }

  return (await res.json()) as TenantOverview;
}
