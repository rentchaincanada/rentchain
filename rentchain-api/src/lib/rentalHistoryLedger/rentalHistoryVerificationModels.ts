import type { RentalHistoryReference } from "./rentalHistoryLedgerTypes";

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export function rentalHistoryReference(params: {
  referenceId: unknown;
  referenceType: RentalHistoryReference["referenceType"];
  label: string;
  status?: RentalHistoryReference["status"];
  destination?: string | null;
  occurredAt?: unknown;
  redacted?: boolean;
  blockedReason?: string | null;
}): RentalHistoryReference {
  return {
    referenceId: asString(params.referenceId, 500) || "rental_history_reference:unknown",
    referenceType: params.referenceType,
    label: asString(params.label, 160) || "Rental history reference",
    status: params.status || "available",
    destination: params.destination || null,
    occurredAt: asString(params.occurredAt, 120) || null,
    redacted: Boolean(params.redacted),
    blockedReason: params.blockedReason || null,
  };
}

export function isAvailableReference(reference: RentalHistoryReference) {
  return reference.status === "available" && !reference.redacted;
}
