import type { IdentityLayerReference } from "./identityLayerTypes";

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export function identityReference(params: {
  referenceId: unknown;
  referenceType: IdentityLayerReference["referenceType"];
  label: string;
  status?: IdentityLayerReference["status"];
  destination?: string | null;
  occurredAt?: unknown;
  redacted?: boolean;
  blockedReason?: string | null;
}): IdentityLayerReference {
  return {
    referenceId: asString(params.referenceId, 400) || "identity_reference:unknown",
    referenceType: params.referenceType,
    label: params.label,
    status: params.status || "available",
    destination: params.destination || null,
    occurredAt: asString(params.occurredAt, 120) || null,
    redacted: Boolean(params.redacted),
    blockedReason: params.blockedReason || null,
  };
}

export function isVerifiedReference(reference: IdentityLayerReference) {
  return reference.status === "available" && !reference.redacted;
}
