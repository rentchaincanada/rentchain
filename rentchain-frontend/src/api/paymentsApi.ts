import { apiFetch, apiJson } from "@/lib/apiClient";

export interface Payment {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string;
  method: string;
  notes?: string | null;
  propertyId?: string | null;
}

export interface CreatePaymentPayload {
  tenantId: string;
  amount: number;
  paidAt: string;
  method: string;
  notes?: string | null;
  propertyId?: string | null;
}

export interface PaymentRecord {
  id: string;
  tenantId: string | null;
  propertyId?: string | null;
  amount: number;
  paidAt: string | null; // ISO string
  method: string;
  notes?: string | null;
  monthlyRent?: number | null;
  dueDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UpdatePaymentPayload {
  amount?: number;
  paidAt?: string;
  method?: string;
  notes?: string;
}

/**
 * GET /payments
 */
export async function fetchPayments(tenantId?: string): Promise<PaymentRecord[]> {
  const path = tenantId
    ? `/payments?tenantId=${encodeURIComponent(tenantId)}`
    : "/payments";
  let data: any = null;
  try {
    data = await apiJson<any>(path);
  } catch (err: any) {
    const status = err?.status ?? err?.body?.status;
    if (status === 404 || status === 403) {
      return [];
    }
    throw err;
  }
  if (Array.isArray(data)) return data as PaymentRecord[];
  if (Array.isArray(data?.items)) return data.items as PaymentRecord[];
  if (Array.isArray(data?.payments)) return data.payments as PaymentRecord[];
  return [];
}

export async function updatePayment(
  id: string,
  payload: UpdatePaymentPayload
): Promise<PaymentRecord> {
  const res = await apiFetch(`/payments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(text || `Failed to update payment: ${res.status}`);
  }

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (data && data.updated) {
    const updated = data.updated as Partial<PaymentRecord>;
    return {
      id: data.paymentId ?? id,
      tenantId: updated.tenantId ?? null,
      propertyId: updated.propertyId ?? null,
      amount: updated.amount ?? 0,
      paidAt: updated.paidAt ?? null,
      method: updated.method ?? "",
      notes: updated.notes ?? null,
      monthlyRent: updated.monthlyRent ?? null,
      dueDate: updated.dueDate ?? null,
      createdAt: updated.createdAt ?? null,
      updatedAt: updated.updatedAt ?? null,
    };
  }

  return data as PaymentRecord;
}

export async function recordPayment(payload: {
  tenantId: string;
  propertyId?: string;
  monthlyRent?: number;
  amount: number;
  dueDate?: string;
  paidAt: string;
  method: string;
  notes?: string;
}): Promise<PaymentRecord> {
  return apiJson<PaymentRecord>("/payments/record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deletePayment(
  tenantId: string,
  paymentId: string
): Promise<void> {
  const res = await apiFetch(
    `/payments/${encodeURIComponent(paymentId)}?tenantId=${encodeURIComponent(
      tenantId
    )}`,
    { method: "DELETE" }
  );

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to delete payment: ${res.status}`);
  }
}

export async function createPayment(
  payload: CreatePaymentPayload
): Promise<Payment> {
  return apiJson<Payment>("/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getPaymentsForTenant(
  tenantId: string
): Promise<Payment[]> {
  const data = await apiJson<any>(
    `/payments?tenantId=${encodeURIComponent(tenantId)}`
  );
  if (Array.isArray(data)) return data as Payment[];
  if (Array.isArray(data?.items)) return data.items as Payment[];
  if (Array.isArray(data?.payments)) return data.payments as Payment[];
  return [];
}

export async function getTenantMonthlyPayments(
  tenantId: string,
  year: number,
  month: number
): Promise<{ payments: Payment[]; total: number }> {
  return apiJson<{ payments: Payment[]; total: number }>(
    `/payments/tenant/${encodeURIComponent(
      tenantId
    )}/monthly?year=${year}&month=${month}`
  );
}

export async function getPropertyMonthlyPayments(
  propertyId: string,
  year: number,
  month: number
): Promise<{ payments: Payment[]; total: number }> {
  return apiJson<{ payments: Payment[]; total: number }>(
    `/payments/property/${encodeURIComponent(
      propertyId
    )}/monthly?year=${year}&month=${month}`
  );
}
