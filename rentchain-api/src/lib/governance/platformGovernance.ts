export type GovernanceSensitivity = "public" | "internal" | "confidential" | "restricted";
export type GovernanceRetentionCategory =
  | "operational_short"
  | "export_metadata"
  | "support_diagnostics"
  | "audit_record";

export type GovernanceActor = {
  actorId: string | null;
  actorRole: string;
  landlordId: string | null;
};

export type GovernanceMetadata = {
  sensitivity: GovernanceSensitivity;
  retentionCategory: GovernanceRetentionCategory;
  metadataOnly: boolean;
  redactionApplied: boolean;
};

const SENSITIVE_KEY_FRAGMENTS = [
  "address",
  "account",
  "bank",
  "body",
  "card",
  "credential",
  "document",
  "email",
  "full_name",
  "fullname",
  "identity",
  "name",
  "passcode",
  "payload",
  "pdfcontent",
  "phone",
  "provider",
  "reporttext",
  "routing",
  "routesource",
  "screeningpayload",
  "secret",
  "sin",
  "stack",
  "ssn",
  "token",
];

const EXPORT_SENSITIVITY: Record<string, GovernanceSensitivity> = {
  application_review_summary: "restricted",
  lease_ledger: "restricted",
  lease_summary: "confidential",
  sample_screening_report: "internal",
  schedule_a: "restricted",
  screening_report: "restricted",
  tenant_report: "restricted",
  transunion_usage: "restricted",
};

const SUPPORT_DEBUG_REDACT_KEYS = new Set(["checkoutsessionid", "quoteid", "screeningorderid"]);

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(normalizedKey(fragment)));
}

export function actorFromRequest(req: any): GovernanceActor {
  const actorId = asString(req?.user?.uid || req?.user?.id || req?.user?.sub, 240) || null;
  const actorRole = asString(req?.user?.actorRole || req?.user?.role, 80).toLowerCase() || "unknown";
  const landlordId = asString(req?.user?.landlordId || req?.user?.actorLandlordId || req?.user?.id, 240) || null;
  return { actorId, actorRole, landlordId };
}

export function governanceMetadata(params?: {
  sensitivity?: GovernanceSensitivity;
  retentionCategory?: GovernanceRetentionCategory;
  redactionApplied?: boolean;
}): GovernanceMetadata {
  return {
    sensitivity: params?.sensitivity || "internal",
    retentionCategory: params?.retentionCategory || "operational_short",
    metadataOnly: true,
    redactionApplied: params?.redactionApplied !== false,
  };
}

export function classifyExportSensitivity(exportType: string): GovernanceSensitivity {
  return EXPORT_SENSITIVITY[asString(exportType, 120)] || "confidential";
}

export function exportGovernanceMetadata(exportType: string): GovernanceMetadata {
  return governanceMetadata({
    sensitivity: classifyExportSensitivity(exportType),
    retentionCategory: "export_metadata",
    redactionApplied: true,
  });
}

export function sanitizeTelemetryProps(value: unknown, depth = 0): unknown {
  if (depth > 3) return null;
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 180);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeTelemetryProps(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) continue;
      out[key] = sanitizeTelemetryProps(nested, depth + 1);
    }
    return out;
  }
  return null;
}

export function redactIdentifier(value: unknown, visibleTail = 4): string | null {
  const raw = asString(value, 240);
  if (!raw) return null;
  if (raw.length <= visibleTail) return "***";
  return `***${raw.slice(-visibleTail)}`;
}

export function redactIdentifierMap(input: Record<string, string | null | undefined>) {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!value) {
      out[key] = null;
      continue;
    }
    out[key] = isSensitiveKey(key) || SUPPORT_DEBUG_REDACT_KEYS.has(normalizedKey(key)) ? redactIdentifier(value) : String(value);
  }
  return out;
}
