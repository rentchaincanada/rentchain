import { apiFetch } from "./http";

export type TenantEventType =
  | "LEASE_STARTED"
  | "RENT_PAID"
  | "RENT_LATE"
  | "NOTICE_SERVED"
  | "LEASE_ENDED"
  | "PAYMENT_RECORDED"
  | "CHARGE_ADDED"
  | "ADJUSTMENT_RECORDED";

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
  purpose?: string;
  purposeLabel?: string;
};

export async function createTenantEvent(input: CreateTenantEventInput) {
  const token =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token") ||
    undefined;

  const defaultTitleFromType = (type: string): string => {
    switch (type) {
      case "RENT_PAID":
      case "PAYMENT_RECORDED":
        return "Payment recorded";
      case "CHARGE_ADDED":
        return "Charge added";
      case "ADJUSTMENT_RECORDED":
        return "Adjustment recorded";
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

  const normalizePurpose = (p?: string) => {
    const raw = (p || "").trim();
    if (!raw) return undefined;
    const normalized = raw.replace(/\s+/g, "_").toUpperCase();
    const allowed = ["RENT", "PARKING", "SECURITY_DEPOSIT", "DAMAGE", "LATE_FEE", "UTILITIES", "OTHER"];
    return allowed.includes(normalized) ? normalized : "OTHER";
  };

  return apiFetch("/tenant-events", {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      title: input.title && input.title.trim() ? input.title.trim() : defaultTitleFromType(input.type),
      occurredAt,
      purpose: normalizePurpose(input.purpose),
      purposeLabel: input.purposeLabel?.trim()?.slice(0, 80) || undefined,
    }),
  });
}
