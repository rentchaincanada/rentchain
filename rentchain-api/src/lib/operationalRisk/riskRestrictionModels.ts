import type {
  OperationalRiskReference,
  OperationalRiskReferenceStatus,
  OperationalRiskSeverity,
  OperationalRiskType,
} from "./operationalRiskTypes";

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export function operationalRiskIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function riskReference(input: {
  idParts: unknown[];
  riskType: OperationalRiskType;
  status: OperationalRiskReferenceStatus;
  severity: OperationalRiskSeverity;
  label: string;
  description: string;
  lineageReferences?: string[];
  destination?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): OperationalRiskReference {
  return {
    riskReferenceId: operationalRiskIdPart(input.idParts.join(":")) || "operational_risk_reference:unknown",
    riskType: input.riskType,
    status: input.status,
    severity: input.severity,
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
