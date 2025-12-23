import { apiFetch } from "./http";

export interface RentChargeInput {
  tenantId: string;
  leaseId: string;
  amount: number;
  dueDate: string;
  period?: string;
  propertyId?: string | null;
  unitId?: string | null;
}

export interface RentCharge {
  id: string;
  tenantId: string;
  landlordId?: string;
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  amount: number;
  dueDate: string;
  period?: string;
  status: string;
  issuedAt?: string;
  confirmedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
}

export async function createRentCharge(payload: RentChargeInput): Promise<RentCharge> {
  return apiFetch<RentCharge>("landlord/rent-charges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function recordRentChargePayment(
  chargeId: string,
  payload: { amount: number; paidAt: string; method: string }
): Promise<any> {
  return apiFetch<any>(`landlord/rent-charges/${encodeURIComponent(chargeId)}/record-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
