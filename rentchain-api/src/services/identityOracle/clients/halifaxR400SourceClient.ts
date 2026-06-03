import { db } from "../../../firebase";
import type { IdentityOracleSourceHealth, IdentityOracleSourceType } from "../identityOracleTypes";

export const HALIFAX_R400_SOURCE_KEY = "halifax_r400";
export const HALIFAX_R400_SOURCE_LABEL = "HRM Halifax Residential Rental Registry R-400";
export const HALIFAX_R400_SOURCE_TYPE: IdentityOracleSourceType = "OPEN_DATASET";
const CACHE_TTL_MS = 5 * 60 * 1000;

type HalifaxR400CacheEntry = {
  expiresAt: number;
  value: HalifaxR400LookupResult;
};

const lookupCache = new Map<string, HalifaxR400CacheEntry>();

export interface HalifaxR400SourceRecord {
  id: string;
  registryRecordId: string;
  registrationNumber: string | null;
  pid: string;
  addressRaw: string | null;
  addressNormalized: string | null;
  primaryAddressCandidate: string | null;
  postalCode: string | null;
  registrationStatusNormalized: string | null;
  sourceConfidence: number | null;
  updatedAt: string | null;
}

export interface HalifaxR400LookupResult {
  ok: boolean;
  sourceType: IdentityOracleSourceType;
  sourceKey: string;
  sourceLabel: string;
  health: IdentityOracleSourceHealth;
  records: HalifaxR400SourceRecord[];
  issues: string[];
  failureKind?: "source_unavailable" | "schema_mismatch";
  fromCache?: boolean;
}

export interface HalifaxR400HealthResult {
  sourceKey: string;
  sourceType: IdentityOracleSourceType;
  sourceLabel: string;
  health: IdentityOracleSourceHealth;
  checkedAtIso: string;
  notes: string[];
}

export async function lookupHalifaxR400ByPid(pid: string): Promise<HalifaxR400LookupResult> {
  const normalizedPid = String(pid || "").replace(/\D/g, "");
  if (!normalizedPid) {
    return {
      ok: false,
      sourceType: HALIFAX_R400_SOURCE_TYPE,
      sourceKey: HALIFAX_R400_SOURCE_KEY,
      sourceLabel: HALIFAX_R400_SOURCE_LABEL,
      health: "degraded",
      records: [],
      issues: ["missing_pid"],
      failureKind: "schema_mismatch",
    };
  }

  const cached = lookupCache.get(normalizedPid);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.value, fromCache: true };
  }

  try {
    const snap = await db
      .collection("registryRecordsNormalized")
      .where("sourceKey", "==", HALIFAX_R400_SOURCE_KEY)
      .where("pid", "==", normalizedPid)
      .limit(5)
      .get();

    const records = (snap.docs || []).map((doc: any) => normalizeLookupRecord(doc.id, doc.data()));
    const invalid = records.some((record) => !record.ok);
    if (invalid) {
      const result: HalifaxR400LookupResult = {
        ok: false,
        sourceType: HALIFAX_R400_SOURCE_TYPE,
        sourceKey: HALIFAX_R400_SOURCE_KEY,
        sourceLabel: HALIFAX_R400_SOURCE_LABEL,
        health: "schema_drift_detected",
        records: [],
        issues: ["missing_required_registry_fields"],
        failureKind: "schema_mismatch",
      };
      setLookupCache(normalizedPid, result);
      return result;
    }

    const result: HalifaxR400LookupResult = {
      ok: true,
      sourceType: HALIFAX_R400_SOURCE_TYPE,
      sourceKey: HALIFAX_R400_SOURCE_KEY,
      sourceLabel: HALIFAX_R400_SOURCE_LABEL,
      health: "healthy",
      records: records.filter(isValidLookupRecord).map((record) => record.record),
      issues: [],
    };
    setLookupCache(normalizedPid, result);
    return result;
  } catch (error: any) {
    const result: HalifaxR400LookupResult = {
      ok: false,
      sourceType: HALIFAX_R400_SOURCE_TYPE,
      sourceKey: HALIFAX_R400_SOURCE_KEY,
      sourceLabel: HALIFAX_R400_SOURCE_LABEL,
      health: "unavailable",
      records: [],
      issues: [String(error?.message || "registry_lookup_failed")],
      failureKind: "source_unavailable",
    };
    setLookupCache(normalizedPid, result);
    return result;
  }
}

export async function getHalifaxR400SourceHealth(): Promise<HalifaxR400HealthResult> {
  const checkedAtIso = new Date().toISOString();
  try {
    const sourceSnap = await db.collection("registrySources").doc(HALIFAX_R400_SOURCE_KEY).get();
    if (!sourceSnap.exists) {
      return {
        sourceKey: HALIFAX_R400_SOURCE_KEY,
        sourceType: HALIFAX_R400_SOURCE_TYPE,
        sourceLabel: HALIFAX_R400_SOURCE_LABEL,
        health: "unavailable",
        checkedAtIso,
        notes: ["missing_registry_source_definition"],
      };
    }

    const source = sourceSnap.data() || {};
    if (source.active === false) {
      return {
        sourceKey: HALIFAX_R400_SOURCE_KEY,
        sourceType: HALIFAX_R400_SOURCE_TYPE,
        sourceLabel: HALIFAX_R400_SOURCE_LABEL,
        health: "degraded",
        checkedAtIso,
        notes: ["source_marked_inactive"],
      };
    }

    const sampleSnap = await db
      .collection("registryRecordsNormalized")
      .where("sourceKey", "==", HALIFAX_R400_SOURCE_KEY)
      .limit(1)
      .get();
    const sample = sampleSnap.docs?.[0];
    if (!sample) {
      return {
        sourceKey: HALIFAX_R400_SOURCE_KEY,
        sourceType: HALIFAX_R400_SOURCE_TYPE,
        sourceLabel: HALIFAX_R400_SOURCE_LABEL,
        health: "degraded",
        checkedAtIso,
        notes: ["no_normalized_records_available"],
      };
    }

    const normalized = normalizeLookupRecord(sample.id, sample.data());
    if (!normalized.ok) {
      return {
        sourceKey: HALIFAX_R400_SOURCE_KEY,
        sourceType: HALIFAX_R400_SOURCE_TYPE,
        sourceLabel: HALIFAX_R400_SOURCE_LABEL,
        health: "schema_drift_detected",
        checkedAtIso,
        notes: ["missing_required_registry_fields"],
      };
    }

    return {
      sourceKey: HALIFAX_R400_SOURCE_KEY,
      sourceType: HALIFAX_R400_SOURCE_TYPE,
      sourceLabel: HALIFAX_R400_SOURCE_LABEL,
      health: "healthy",
      checkedAtIso,
      notes: [],
    };
  } catch (error: any) {
    return {
      sourceKey: HALIFAX_R400_SOURCE_KEY,
      sourceType: HALIFAX_R400_SOURCE_TYPE,
      sourceLabel: HALIFAX_R400_SOURCE_LABEL,
      health: "unavailable",
      checkedAtIso,
      notes: [String(error?.message || "registry_source_health_failed")],
    };
  }
}

type NormalizedLookupRecord =
  | { ok: true; record: HalifaxR400SourceRecord }
  | { ok: false };

function isValidLookupRecord(record: NormalizedLookupRecord): record is { ok: true; record: HalifaxR400SourceRecord } {
  return record.ok;
}

function normalizeLookupRecord(id: string, raw: any): NormalizedLookupRecord {
  const pid = String(raw?.pid || "").replace(/\D/g, "");
  const registryRecordId = String(raw?.registryRecordId || "").trim();
  const sourceKey = String(raw?.sourceKey || "").trim();
  const province = String(raw?.jurisdictionProvince || "").trim().toUpperCase();
  const municipality = String(raw?.jurisdictionMunicipality || "").trim();
  const addressNormalized = String(raw?.addressNormalized || raw?.primaryAddressCandidate || "").trim() || null;

  if (!pid || !registryRecordId || sourceKey !== HALIFAX_R400_SOURCE_KEY || province !== "NS" || !municipality || !addressNormalized) {
    return { ok: false };
  }

  return {
    ok: true,
    record: {
      id,
      registryRecordId,
      registrationNumber: String(raw?.registrationNumber || "").trim() || null,
      pid,
      addressRaw: String(raw?.addressRaw || "").trim() || null,
      addressNormalized,
      primaryAddressCandidate: String(raw?.primaryAddressCandidate || "").trim() || null,
      postalCode: String(raw?.postalCode || "").trim() || null,
      registrationStatusNormalized: String(raw?.registrationStatusNormalized || "").trim() || null,
      sourceConfidence:
        typeof raw?.sourceConfidence === "number" && Number.isFinite(raw.sourceConfidence)
          ? raw.sourceConfidence
          : null,
      updatedAt: String(raw?.updatedAt || "").trim() || null,
    },
  };
}

function setLookupCache(pid: string, value: HalifaxR400LookupResult) {
  lookupCache.set(pid, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });
}

export function __resetHalifaxR400SourceClientCacheForTests() {
  lookupCache.clear();
}
