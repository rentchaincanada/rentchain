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
  const { apiFetch } = await import("../../api/apiFetch");
  return apiFetch<TenantOverview>(`/tenants/${encodeURIComponent(tenantId)}/overview`);
}
