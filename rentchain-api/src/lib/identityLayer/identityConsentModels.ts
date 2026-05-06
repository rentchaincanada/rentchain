import type { IdentityLayerReference } from "./identityLayerTypes";
import { identityReference } from "./identityVerificationModels";

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export function consentReference(record: Record<string, unknown>): IdentityLayerReference {
  const id = asString(record.id || record.consentId || record.applicationId || record.leaseId, 400);
  const scope = asString(record.scope || record.consentScope || record.type, 120) || "operational consent";
  return identityReference({
    referenceId: id ? `consent:${id}` : "consent:unknown",
    referenceType: "consent",
    label: scope,
    status: "available",
    occurredAt: record.createdAt || record.updatedAt || record.signedAt || record.consentAt,
  });
}
