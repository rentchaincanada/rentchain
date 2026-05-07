import type {
  ObservabilityIncidentReference,
  ObservabilityIncidentReferenceStatus,
  ObservabilityIncidentReferenceType,
  ObservabilityIncidentRestriction,
} from "./observabilityIncidentReadinessTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function observabilityIncidentIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function observabilityIncidentReference(input: {
  idParts: unknown[];
  referenceType: ObservabilityIncidentReferenceType;
  status: ObservabilityIncidentReferenceStatus;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): ObservabilityIncidentReference {
  return {
    referenceId: observabilityIncidentIdPart(input.idParts.join(":")) || "observability_incident_reference:unknown",
    referenceType: input.referenceType,
    status: input.status,
    label: input.label,
    description: input.description,
    reviewRequired: true,
    lineageReferences: Array.from(new Set(input.lineageReferences || [])).filter(Boolean),
    destination: input.destination || null,
    redacted: Boolean(input.redacted),
    redactionReason: input.redactionReason || null,
    blockedReason: input.blockedReason || null,
  };
}

export function observabilityIncidentRestriction(input: {
  idParts: unknown[];
  restrictionType: ObservabilityIncidentRestriction["restrictionType"];
  status: ObservabilityIncidentRestriction["status"];
  label: string;
  description: string;
  blockedReason?: string | null;
}): ObservabilityIncidentRestriction {
  return {
    restrictionId: observabilityIncidentIdPart(input.idParts.join(":")) || "observability_incident_restriction:unknown",
    restrictionType: input.restrictionType,
    status: input.status,
    label: input.label,
    description: input.description,
    blockedReason: input.blockedReason || null,
  };
}
