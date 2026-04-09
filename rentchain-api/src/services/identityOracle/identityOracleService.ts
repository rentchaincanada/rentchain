import { db } from "../../config/firebase";
import { normalizePid } from "../registry/registryUtils";
import { HalifaxR400IdentityAdapter } from "./adapters/HalifaxR400IdentityAdapter";
import { OntarioGatewayIdentityAdapter } from "./adapters/OntarioGatewayIdentityAdapter";
import { OntarioPropertyIdentitySyntaxAdapter } from "./adapters/OntarioPropertyIdentitySyntaxAdapter";
import { NovaScotiaPropertyIdentitySyntaxAdapter } from "./adapters/NovaScotiaPropertyIdentitySyntaxAdapter";
import type {
  IdentityOracleExecutionResult,
  IdentityOracleIdentifierType,
  IdentityOracleNormalizationInput,
  IdentityOraclePropertyContext,
  IdentityOracleRunRecord,
  IdentityOracleSyntaxResult,
  IdentityOracleVerificationResult,
  PropertyIdentityProfileRecord,
} from "./identityOracleTypes";

const RUNS_COLLECTION = "identity_oracle_runs";
const PROFILES_COLLECTION = "property_identity_profiles";
const PROPERTIES_COLLECTION = "properties";

type PropertyRecord = Record<string, any>;

type Adapter = {
  identifierType: IdentityOracleIdentifierType;
  normalize(identifier: string): IdentityOracleSyntaxResult;
  buildNamespaceKey(params: { municipality?: string | null }): string;
};

const ONTARIO_ADAPTER = new OntarioPropertyIdentitySyntaxAdapter();
const NOVA_SCOTIA_ADAPTER = new NovaScotiaPropertyIdentitySyntaxAdapter();
const HALIFAX_R400_ADAPTER = new HalifaxR400IdentityAdapter();
const ONTARIO_GATEWAY_ADAPTER = new OntarioGatewayIdentityAdapter();

export async function runIdentityOracle(
  input: IdentityOracleNormalizationInput
): Promise<IdentityOracleExecutionResult> {
  const propertyId = String(input.propertyId || "").trim();
  if (!propertyId) {
    throw buildInputError("property_id_required", 400);
  }

  const identifier = String(input.identifier || "").trim();
  if (!identifier) {
    throw buildInputError("identifier_required", 400);
  }

  const property = await loadPropertyOrThrow(propertyId);
  const province = normalizeProvince(input.province || property.province || property.addressProvince);
  const municipality = firstString(
    input.municipality,
    property.municipality,
    property.city,
    property.addressCity
  );
  const adapter = selectAdapter(province, input.identifierType);
  const syntaxResult = adapter.normalize(identifier);
  const createdAt = new Date().toISOString();
  const verification = await maybeVerifyExternally({
    input,
    property,
    province,
    municipality,
    identifierType: adapter.identifierType,
    normalizedIdentifier: syntaxResult.normalizedIdentifier,
  });

  const runRef = db.collection(RUNS_COLLECTION).doc();
  const run: IdentityOracleRunRecord = {
    id: runRef.id,
    propertyId,
    rc_prop_id: firstString(property.rc_prop_id, property.rcPropId, propertyId) || null,
    province: province || null,
    municipality: municipality || null,
    namespaceKey: verification?.namespaceKey || adapter.buildNamespaceKey({ municipality }),
    identifierType: adapter.identifierType,
    originalIdentifier: identifier,
    normalizedIdentifier: syntaxResult.normalizedIdentifier,
    syntaxResult,
    verificationStatus: verification?.verificationStatus || (syntaxResult.ok ? "SYNTAX_ONLY" : null),
    confidence: verification?.confidence ?? null,
    sourceType: verification?.sourceType || null,
    sourceKey: verification?.sourceKey || null,
    sourceLabel: verification?.sourceLabel || null,
    sourceHealth: verification?.sourceHealth || null,
    policyGate: verification?.policyGate || null,
    usageGate: verification?.usageGate || null,
    flags: verification?.flags || [],
    notes: verification?.notes || [],
    relatedNamespaces: verification?.relatedNamespaces || [],
    createdAt,
    createdBy: firstString(input.actorId) || null,
    actorType: input.actorType === "admin" ? "admin" : "system",
  };

  await runRef.set(run);

  const existingProfileSnap = await db.collection(PROFILES_COLLECTION).doc(propertyId).get();
  const existingProfile = existingProfileSnap.exists ? (existingProfileSnap.data() as PropertyIdentityProfileRecord) : null;
  const profile = buildProfileRecord(propertyId, run, existingProfile);
  await db.collection(PROFILES_COLLECTION).doc(propertyId).set(profile, { merge: true });

  return { run, profile };
}

async function loadPropertyOrThrow(propertyId: string): Promise<PropertyRecord> {
  const snap = await db.collection(PROPERTIES_COLLECTION).doc(propertyId).get();
  if (!snap.exists) {
    throw buildInputError("property_not_found", 404);
  }

  return { id: snap.id, ...(snap.data() || {}) };
}

function selectAdapter(province: string | null, identifierType?: string | null): Adapter {
  const normalizedIdentifierType = normalizeIdentifierType(identifierType);
  if (province === "ON") {
    if (normalizedIdentifierType && normalizedIdentifierType !== ONTARIO_ADAPTER.identifierType) {
      throw buildInputError("identifier_type_not_supported_for_province", 400);
    }
    return ONTARIO_ADAPTER;
  }

  if (province === "NS") {
    if (normalizedIdentifierType && normalizedIdentifierType !== NOVA_SCOTIA_ADAPTER.identifierType) {
      throw buildInputError("identifier_type_not_supported_for_province", 400);
    }
    return NOVA_SCOTIA_ADAPTER;
  }

  throw buildInputError("province_not_supported", 400);
}

function buildProfileRecord(
  propertyId: string,
  run: IdentityOracleRunRecord,
  existingProfile: PropertyIdentityProfileRecord | null
): PropertyIdentityProfileRecord {
  return {
    propertyId,
    rc_prop_id: run.rc_prop_id,
    province: run.province,
    municipality: run.municipality,
    namespaceKey: run.namespaceKey,
    latestRunId: run.id,
    lastRunAt: run.createdAt,
    identifierType: run.identifierType,
    syntaxStatus: run.syntaxResult.status,
    identifiers: {
      ...((existingProfile?.identifiers as Record<string, any> | undefined) || {}),
      [run.namespaceKey]: {
        identifierType: run.identifierType,
        originalIdentifier: run.originalIdentifier,
        normalizedIdentifier: run.normalizedIdentifier,
        syntaxStatus: run.syntaxResult.status,
        verificationStatus: run.verificationStatus || null,
        confidence: run.confidence ?? null,
        sourceType: run.sourceType || null,
        sourceKey: run.sourceKey || null,
        sourceLabel: run.sourceLabel || null,
        sourceHealth: run.sourceHealth || null,
        policyGate: run.policyGate || null,
        usageGate: run.usageGate || null,
        flags: run.flags || [],
        notes: run.notes || [],
        relatedNamespaces: run.relatedNamespaces || [],
        lastRunId: run.id,
        updatedAt: run.createdAt,
      },
    },
  };
}

function normalizeProvince(value: any): string | null {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  if (normalized === "ONTARIO") return "ON";
  if (normalized === "NOVA SCOTIA") return "NS";
  return normalized;
}

function normalizeIdentifierType(value: string | null | undefined): IdentityOracleIdentifierType | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (normalized === "pin") {
    return "pin";
  }
  if (normalized === "pid") return "pid";
  throw buildInputError("identifier_type_not_supported", 400);
}

async function maybeVerifyExternally(params: {
  input: IdentityOracleNormalizationInput;
  property: PropertyRecord;
  province: string | null;
  municipality: string | null;
  identifierType: IdentityOracleIdentifierType;
  normalizedIdentifier: string | null;
}): Promise<IdentityOracleVerificationResult | null> {
  const requestedSource = String(params.input.source || "").trim().toLowerCase();
  if (!requestedSource) return null;
  if (!params.normalizedIdentifier) return null;

  if (requestedSource !== "halifax_r400") {
    if (requestedSource !== "ontario_gateway") {
      throw buildInputError("source_not_supported", 400);
    }
    if (params.province !== "ON") {
      throw buildInputError("source_not_supported_for_province", 400);
    }
    if (params.identifierType !== "pin") {
      throw buildInputError("source_not_supported_for_identifier_type", 400);
    }

    return ONTARIO_GATEWAY_ADAPTER.verify({
      province: "ON",
      propertyId: String(params.input.propertyId || "").trim(),
      source: "ontario_gateway",
      identifier: params.normalizedIdentifier,
      identifierType: params.identifierType,
      propertyContext: buildPropertyContext(params.property),
    });
  }

  if (params.province !== "NS") {
    throw buildInputError("source_not_supported_for_province", 400);
  }

  const municipality = String(params.municipality || "").trim().toLowerCase();
  if (municipality && municipality !== "halifax") {
    throw buildInputError("source_not_supported_for_municipality", 400);
  }
  if (params.identifierType !== "pid") {
    throw buildInputError("source_not_supported_for_identifier_type", 400);
  }

  return HALIFAX_R400_ADAPTER.verify({
    province: "NS",
    municipality: params.municipality,
    propertyId: String(params.input.propertyId || "").trim(),
    identifier: params.normalizedIdentifier,
    identifierType: params.identifierType,
    propertyContext: buildPropertyContext(params.property),
  });
}

function buildPropertyContext(property: PropertyRecord): IdentityOraclePropertyContext {
  return {
    addressLine1: firstString(property.addressLine1, property.address1, property.address),
    city: firstString(property.city, property.municipality),
    province: firstString(property.province, property.addressProvince),
    postalCode: firstString(property.postalCode),
    pid:
      normalizePid(property.pid) ||
      normalizePid(property.PID) ||
      normalizePid(property.propertyPid) ||
      normalizePid(property.parcelId) ||
      normalizePid(property.parcelPid) ||
      null,
    pin:
      firstString(property.pin, property.PIN, property.propertyPin, property.rollPin) ||
      null,
    unitCount:
      typeof property.unitCount === "number"
        ? property.unitCount
        : typeof property.totalUnits === "number"
          ? property.totalUnits
          : null,
  };
}

function firstString(...values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function buildInputError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}
