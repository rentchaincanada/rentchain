import type { LeaseSigningStatus } from "./signing/leaseSigningService";

function asIsoDate(value: unknown): string | null {
  const next = String(value || "").trim();
  if (!next) return null;
  const parsed = Date.parse(next);
  if (Number.isNaN(parsed)) return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export type DerivedLeaseSigningState = "not_started" | "pending_signature" | "signed_future" | "active" | "rejected" | "expired" | "cancelled" | "failed";

export function deriveLeaseSigningState(input: {
  lease: Record<string, unknown>;
  signingStatus?: LeaseSigningStatus | null;
  now?: Date;
}): DerivedLeaseSigningState {
  const status = String(input.signingStatus || "").trim();
  if (status === "rejected" || status === "expired" || status === "cancelled" || status === "failed") return status as DerivedLeaseSigningState;
  if (status !== "signed") return status === "pending_signature" ? "pending_signature" : "not_started";

  const startDate = asIsoDate(input.lease?.startDate || input.lease?.leaseStart || input.lease?.leaseStartDate);
  if (!startDate) return "signed_future";
  const today = (input.now || new Date()).toISOString().slice(0, 10);
  return startDate <= today ? "active" : "signed_future";
}
