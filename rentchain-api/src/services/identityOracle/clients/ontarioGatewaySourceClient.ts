import type { IdentityOracleSourceHealth, IdentityOracleSourceType } from "../identityOracleTypes";

export const ONTARIO_GATEWAY_SOURCE_KEY = "ontario_gateway";
export const ONTARIO_GATEWAY_SOURCE_LABEL = "Ontario Property Verification Gateway";
export const ONTARIO_GATEWAY_SOURCE_TYPE: IdentityOracleSourceType = "PAID_GATEWAY";

export interface OntarioGatewaySourceRecord {
  gatewayPropertyId: string;
  pin: string;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  registrationNumber: string | null;
  confidenceHint: number | null;
}

export interface OntarioGatewayLookupResult {
  ok: boolean;
  sourceType: IdentityOracleSourceType;
  sourceKey: string;
  sourceLabel: string;
  health: IdentityOracleSourceHealth;
  records: OntarioGatewaySourceRecord[];
  issues: string[];
  noMatch?: boolean;
  failureKind?: "source_unavailable" | "schema_mismatch" | "not_configured";
}

export interface OntarioGatewayHealthResult {
  sourceKey: string;
  sourceType: IdentityOracleSourceType;
  sourceLabel: string;
  health: IdentityOracleSourceHealth;
  checkedAtIso: string;
  notes: string[];
}

export async function lookupOntarioGatewayByPin(pin: string): Promise<OntarioGatewayLookupResult> {
  const normalizedPin = String(pin || "").replace(/\D/g, "");
  if (!normalizedPin) {
    return buildFailure("schema_mismatch", "degraded", ["missing_pin"]);
  }

  const mode = getGatewayMode();
  if (mode === "disabled") {
    return buildFailure("not_configured", "degraded", ["gateway_disabled"]);
  }

  if (mode !== "stub") {
    return buildFailure("not_configured", "degraded", ["live_gateway_not_enabled_for_this_mission"]);
  }

  const raw = String(process.env.ONTARIO_GATEWAY_STUB_RESPONSE_JSON || "").trim();
  if (!raw) {
    return buildFailure("not_configured", "degraded", ["missing_stub_response"]);
  }

  try {
    const parsed = JSON.parse(raw);
    const recordsRaw = normalizeStubRecords(parsed, normalizedPin);
    if (recordsRaw === null) {
      return buildFailure("schema_mismatch", "schema_drift_detected", ["missing_required_gateway_fields"]);
    }
    if (!recordsRaw.length) {
      return {
        ok: true,
        sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
        sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
        sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
        health: "healthy",
        records: [],
        issues: [],
        noMatch: true,
      };
    }
    return {
      ok: true,
      sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
      sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
      sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
      health: "healthy",
      records: recordsRaw,
      issues: [],
    };
  } catch (error: any) {
    return buildFailure("schema_mismatch", "schema_drift_detected", [String(error?.message || "invalid_stub_response")]);
  }
}

export async function getOntarioGatewayHealth(): Promise<OntarioGatewayHealthResult> {
  const checkedAtIso = new Date().toISOString();
  const mode = getGatewayMode();
  if (mode === "disabled") {
    return {
      sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
      sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
      sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
      health: "degraded",
      checkedAtIso,
      notes: ["gateway_disabled"],
    };
  }
  if (mode !== "stub") {
    return {
      sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
      sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
      sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
      health: "degraded",
      checkedAtIso,
      notes: ["live_gateway_not_enabled_for_this_mission"],
    };
  }

  const raw = String(process.env.ONTARIO_GATEWAY_STUB_RESPONSE_JSON || "").trim();
  if (!raw) {
    return {
      sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
      sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
      sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
      health: "degraded",
      checkedAtIso,
      notes: ["missing_stub_response"],
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const validation = normalizeStubRecords(parsed, null);
    if (validation === null) {
      return {
        sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
        sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
        sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
        health: "schema_drift_detected",
        checkedAtIso,
        notes: ["missing_required_gateway_fields"],
      };
    }
    return {
      sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
      sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
      sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
      health: "healthy",
      checkedAtIso,
      notes: ["stub_gateway_mode"],
    };
  } catch (error: any) {
    return {
      sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
      sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
      sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
      health: "schema_drift_detected",
      checkedAtIso,
      notes: [String(error?.message || "invalid_stub_response")],
    };
  }
}

function getGatewayMode() {
  return String(process.env.ONTARIO_GATEWAY_MODE || "stub").trim().toLowerCase();
}

function normalizeStubRecords(input: any, targetPin: string | null): OntarioGatewaySourceRecord[] | null {
  const rawRecords = Array.isArray(input?.records) ? input.records : Array.isArray(input) ? input : null;
  if (!rawRecords) return null;

  const normalized: OntarioGatewaySourceRecord[] = [];
  for (const raw of rawRecords) {
    const pin = String(raw?.pin || "").replace(/\D/g, "");
    const gatewayPropertyId = String(raw?.gatewayPropertyId || raw?.propertyId || "").trim();
    const addressLine1 = String(raw?.addressLine1 || "").trim() || null;
    const city = String(raw?.city || "").trim() || null;
    const province = String(raw?.province || "").trim().toUpperCase() || null;
    const postalCode = String(raw?.postalCode || "").trim().toUpperCase() || null;
    if (!pin || !gatewayPropertyId || !province) return null;
    if (targetPin && pin !== targetPin) continue;

    normalized.push({
      gatewayPropertyId,
      pin,
      addressLine1,
      city,
      province,
      postalCode,
      registrationNumber: String(raw?.registrationNumber || "").trim() || null,
      confidenceHint:
        typeof raw?.confidenceHint === "number" && Number.isFinite(raw.confidenceHint)
          ? raw.confidenceHint
          : null,
    });
  }

  return normalized;
}

function buildFailure(
  failureKind: "source_unavailable" | "schema_mismatch" | "not_configured",
  health: IdentityOracleSourceHealth,
  issues: string[]
): OntarioGatewayLookupResult {
  return {
    ok: false,
    sourceType: ONTARIO_GATEWAY_SOURCE_TYPE,
    sourceKey: ONTARIO_GATEWAY_SOURCE_KEY,
    sourceLabel: ONTARIO_GATEWAY_SOURCE_LABEL,
    health,
    records: [],
    issues,
    failureKind,
  };
}
