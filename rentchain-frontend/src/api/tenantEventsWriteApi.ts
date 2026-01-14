import { apiFetch } from "./http";

export type TenantEventType =
  | "LEASE_STARTED"
  | "RENT_PAID"
  | "RENT_LATE"
  | "NOTICE_SERVED"
  | "LEASE_ENDED";

export type CreateTenantEventInput = {
  tenantId: string;
  type: TenantEventType;
  occurredAt?: string;
  title?: string;
  description?: string;
  propertyId?: string;
  unitId?: string;
  amountCents?: number;
  currency?: string;
  daysLate?: number;
  noticeType?: string;
};

export async function createTenantEvent(input: CreateTenantEventInput) {
  const token =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token") ||
    undefined;

  return apiFetch("/tenant-events", {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
