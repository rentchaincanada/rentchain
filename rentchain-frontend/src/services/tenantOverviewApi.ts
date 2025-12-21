// src/services/tenantOverviewApi.ts

export type TenantOverviewRow = {
  id: string;
  name: string;
  propertyName: string;
  unitLabel: string;
  monthlyRent: number;
  onTimePayments: number;
  latePayments: number;
};

export async function fetchTenantOverview(): Promise<TenantOverviewRow[]> {
  const res = await fetch("http://localhost:3000/tenants/overview");

  if (!res.ok) {
    throw new Error("Failed to fetch tenant overview");
  }

  return (await res.json()) as TenantOverviewRow[];
}
