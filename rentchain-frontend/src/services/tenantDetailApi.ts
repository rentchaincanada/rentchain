// src/services/tenantDetailApi.ts

export type TenantPaymentHistoryItem = {
  date: string;
  amountDue: number;
  amountPaid: number;
  status: "on_time" | "late" | "missed";
};

export type TenantDetail = {
  id: string;
  name: string;
  propertyName: string;
  unitLabel: string;
  monthlyRent: number;
  onTimePayments: number;
  latePayments: number;
  email?: string;
  phone?: string;
  leaseStart: string;
  leaseEnd?: string;
  paymentHistory: TenantPaymentHistoryItem[];
};

export async function fetchTenantDetail(
  id: string
): Promise<TenantDetail> {
  const res = await fetch(`http://localhost:3000/tenants/${id}`);

  if (!res.ok) {
    throw new Error("Failed to fetch tenant detail");
  }

  return (await res.json()) as TenantDetail;
}
