import { apiFetch } from "./apiFetch";

export interface PaymentRecord {
  id: string;
  tenantId?: string | null;
  propertyId?: string | null;
  amount: number;
  paidAt?: string | null;
  method?: string;
  notes?: string | null;
  monthlyRent?: number | null;
  dueDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Payment extends PaymentRecord {}

export interface UpdatePaymentPayload {
  amount?: number;
  paidAt?: string;
  method?: string;
  notes?: string;
}

export async function fetchPayments(tenantId?: string): Promise<PaymentRecord[]> {
  const qs = new URLSearchParams();
  if (tenantId) qs.set("tenantId", tenantId);

  try {
    const data = await apiFetch<any>(`/payments${qs.toString() ? `?${qs.toString()}` : ""}`);
    if (Array.isArray(data)) return data as PaymentRecord[];
    if (Array.isArray(data?.items)) return data.items as PaymentRecord[];
    if (Array.isArray(data?.payments)) return data.payments as PaymentRecord[];
    return [];
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("404") || msg.includes("Not Found")) {
      return [];
    }
    throw err;
  }
}

export async function updatePayment(
  id: string,
  payload: UpdatePaymentPayload
): Promise<PaymentRecord> {
  const data = await apiFetch<any>(`/payments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (data?.updated) {
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

export async function getTenantMonthlyPayments(
  tenantId: string,
  year: number,
  month: number
): Promise<{ payments: Payment[]; total: number }> {
  const qs = new URLSearchParams({ year: String(year), month: String(month) });
  return apiFetch<{ payments: Payment[]; total: number }>(
    `/payments/tenant/${encodeURIComponent(tenantId)}/monthly?${qs.toString()}`
  );
}

export async function getPropertyMonthlyPayments(
  propertyId: string,
  year: number,
  month: number
): Promise<{ payments: Payment[]; total: number }> {
  const qs = new URLSearchParams({ year: String(year), month: String(month) });
  return apiFetch<{ payments: Payment[]; total: number }>(
    `/payments/property/${encodeURIComponent(propertyId)}/monthly?${qs.toString()}`
  );
}
