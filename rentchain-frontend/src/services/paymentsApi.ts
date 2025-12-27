// src/services/paymentsApi.ts
import API_BASE from "../config/apiBase";

const API_BASE_URL = API_BASE.replace(/\/$/, "");

export interface TenantPayment {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string; // ISO date string
  method: string;
  notes?: string | null;
}

export interface RecordPaymentInput {
  tenantId: string;
  amount: number;
  paidAt: string; // ISO date
  method: string;
  notes?: string;
  propertyId?: string;
  monthlyRent?: number;
}

/**
 * GET /api/payments?tenantId=...
 */
export async function fetchPaymentsForTenant(
  tenantId: string
): Promise<TenantPayment[]> {
  const url = `${API_BASE_URL}/api/payments?tenantId=${encodeURIComponent(
    tenantId
  )}`;

  console.log("[PaymentsApi] Fetching payments from:", url);

  const res = await fetch(url);

  if (!res.ok) {
    console.error(
      "[PaymentsApi] Failed to fetch payments:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to fetch payments for tenant ${tenantId}: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as TenantPayment[];
  return data;
}

/**
 * POST /api/payments
 * Body: RecordPaymentInput
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<TenantPayment> {
  const url = `${API_BASE_URL}/api/payments`;

  console.log("[PaymentsApi] Recording payment via:", url, input);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(
      "[PaymentsApi] Failed to record payment:",
      res.status,
      res.statusText,
      bodyText
    );
    throw new Error(
      `Failed to record payment: ${res.status} ${res.statusText} - ${bodyText}`
    );
  }

  const created = (await res.json()) as TenantPayment;
  return created;
}
