export const SAFE_TENANT_CREATION_STATUS = "invited" as const;

const CURRENT_LIKE_TENANT_STATUSES = new Set([
  "active",
  "current",
  "occupied",
  "leased",
  "rented",
]);

export function isCurrentLikeTenantStatus(value: unknown): boolean {
  return CURRENT_LIKE_TENANT_STATUSES.has(String(value || "").trim().toLowerCase());
}
