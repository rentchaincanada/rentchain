// rentchain-frontend/src/services/tenantDetailsApi.ts

import type {
  TenantDetailsModel,
  TenantPaymentHistoryItem,
} from "../components/tenants/TenantDetails";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export interface TenantDetailsResponse {
  tenantId: string;
  email: string | null;
  phone: string | null;
  propertyName: string | null;
  unit: string | null;
  monthlyRent: number | null;
  currentBalance: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  notes: string | null;
  paymentHistory: TenantPaymentHistoryItem[];
}

export const fetchTenantDetails = async (
  tenantId: string
): Promise<Partial<TenantDetailsModel>> => {
  const res = await fetch(`${API_BASE}/tenant/${tenantId}/details`);

  if (!res.ok) {
    console.error("Failed to fetch tenant details", res.status);
    return {};
  }

  const data: TenantDetailsResponse = await res.json();

  return {
    id: data.tenantId,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    propertyName: data.propertyName ?? undefined,
    unit: data.unit ?? undefined,
    monthlyRent: data.monthlyRent ?? undefined,
    currentBalance: data.currentBalance ?? undefined,
    leaseStart: data.leaseStart ?? undefined,
    leaseEnd: data.leaseEnd ?? undefined,
    notes: data.notes ?? undefined,
    paymentHistory: data.paymentHistory ?? [],
  };
};
