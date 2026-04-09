import { db } from "../../config/firebase";
import { OntarioPropertyIdentitySyntaxAdapter } from "./adapters/OntarioPropertyIdentitySyntaxAdapter";
import { NovaScotiaPropertyIdentitySyntaxAdapter } from "./adapters/NovaScotiaPropertyIdentitySyntaxAdapter";
import type {
  IdentityOracleExecutionResult,
  IdentityOracleIdentifierType,
  IdentityOracleNormalizationInput,
  IdentityOracleRunRecord,
  IdentityOracleSyntaxResult,
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

  const runRef = db.collection(RUNS_COLLECTION).doc();
  const run: IdentityOracleRunRecord = {
    id: runRef.id,
    propertyId,
    rc_prop_id: firstString(property.rc_prop_id, property.rcPropId, propertyId) || null,
    province: province || null,
    municipality: municipality || null,
    namespaceKey: adapter.buildNamespaceKey({ municipality }),
    identifierType: adapter.identifierType,
    originalIdentifier: identifier,
    normalizedIdentifier: syntaxResult.normalizedIdentifier,
    syntaxResult,
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
