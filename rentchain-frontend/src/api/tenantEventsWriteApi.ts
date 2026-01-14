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

  const defaultTitleFromType = (type: string): string => {
    switch (type) {
      case "RENT_PAID":
        return "Rent paid";
      case "LEASE_STARTED":
        return "Lease started";
      case "LEASE_ENDED":
        return "Lease ended";
      case "RENT_LATE":
        return "Rent paid late";
      case "NOTICE_SERVED":
        return "Notice served";
      default:
        return (type || "")
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const occurredAt =
    typeof input.occurredAt === "number"
      ? input.occurredAt
      : input.occurredAt
      ? new Date(input.occurredAt).getTime()
      : Date.now();

  return apiFetch("/tenant-events", {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      title: input.title && input.title.trim() ? input.title.trim() : defaultTitleFromType(input.type),
      occurredAt,
    }),
  });
}
