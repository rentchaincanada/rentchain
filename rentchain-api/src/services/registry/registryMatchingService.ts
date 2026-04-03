import { db } from "../../config/firebase";
import type {
  RegistryMatchRecord,
  RegistryMatchStatus,
  RegistryPropertyCandidate,
  RegistryRecordNormalized,
  RegistrySourceKey,
} from "./registryTypes";
import { makeStableId, nowIso, scoreAddressSimilarity } from "./registryUtils";
import type { RegistrySourceAdapter } from "./adapters/RegistrySourceAdapter";

function compareBuildingTypes(a: string | null | undefined, b: string | null | undefined) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  if (!left || !right) return false;
  return left !== right;
}

function getMismatchReasons(record: RegistryRecordNormalized, property: RegistryPropertyCandidate): string[] {
  const reasons: string[] = [];
  if (
    record.registeredUnits != null &&
    property.unitCount != null &&
    Math.abs(record.registeredUnits - property.unitCount) >= 2
  ) {
    reasons.push("unit_count_conflict");
  }
  if (compareBuildingTypes(record.buildingTypeNormalized, property.buildingType)) {
    reasons.push("building_type_conflict");
  }
  return reasons;
}

async function loadPropertyCandidates(adapter: RegistrySourceAdapter, sourceKey: RegistrySourceKey) {
  const source = adapter.getSourceDefinition();
  const propertiesSnap = await db.collection("properties").where("province", "==", source.jurisdictionProvince).get();
  const candidates = (propertiesSnap.docs || [])
    .map((doc: any) => adapter.buildPropertyAddressCandidate({ id: doc.id, ...(doc.data() || {}) }))
    .filter((candidate) => candidate.propertyId);
  const byPid = new Map<string, RegistryPropertyCandidate[]>();
  const byAddress = new Map<string, RegistryPropertyCandidate[]>();
  for (const candidate of candidates) {
    if (candidate.pid) {
      byPid.set(candidate.pid, [...(byPid.get(candidate.pid) || []), candidate]);
    }
    if (candidate.addressNormalized) {
      byAddress.set(candidate.addressNormalized, [...(byAddress.get(candidate.addressNormalized) || []), candidate]);
    }
  }
  return { candidates, byPid, byAddress, sourceKey };
}

export async function evaluateRegistryMatch(params: {
  adapter: RegistrySourceAdapter;
  record: RegistryRecordNormalized;
}): Promise<RegistryMatchRecord> {
  const now = nowIso();
  const { candidates, byPid, byAddress } = await loadPropertyCandidates(params.adapter, params.record.sourceKey);
  const base: RegistryMatchRecord = {
    id: makeStableId([params.record.sourceKey, params.record.registryRecordId]),
    sourceKey: params.record.sourceKey,
    registryRecordId: params.record.registryRecordId,
    normalizedRecordId: params.record.id,
    propertyId: null,
    landlordId: null,
    matchMethod: null,
    matchScore: 0,
    matchStatus: "unmatched",
    mismatchReasons: [],
    reviewedBy: null,
    reviewedAt: null,
    overrideReason: null,
    createdAt: now,
    updatedAt: now,
  };

  if (params.record.pid) {
    const pidMatches = byPid.get(params.record.pid) || [];
    if (pidMatches.length === 1) {
      const property = pidMatches[0];
      const mismatchReasons = getMismatchReasons(params.record, property);
      return {
        ...base,
        propertyId: property.propertyId,
        landlordId: property.landlordId,
        matchMethod: "pid_exact",
        matchScore: 0.99,
        matchStatus: mismatchReasons.length ? "mismatch" : "matched",
        mismatchReasons,
      };
    }
    if (pidMatches.length > 1) {
      return {
        ...base,
        matchMethod: "pid_exact",
        matchScore: 0.65,
        matchStatus: "possible_match",
        mismatchReasons: ["pid_ambiguous"],
      };
    }
  }

  if (params.record.addressNormalized) {
    const exactMatches = byAddress.get(params.record.addressNormalized) || [];
    if (exactMatches.length === 1) {
      const property = exactMatches[0];
      const mismatchReasons = getMismatchReasons(params.record, property);
      return {
        ...base,
        propertyId: property.propertyId,
        landlordId: property.landlordId,
        matchMethod: "address_exact",
        matchScore: 0.93,
        matchStatus: mismatchReasons.length ? "mismatch" : "matched",
        mismatchReasons,
      };
    }
    if (exactMatches.length > 1) {
      return {
        ...base,
        matchMethod: "address_exact",
        matchScore: 0.68,
        matchStatus: "possible_match",
        mismatchReasons: ["address_ambiguous"],
      };
    }
  }

  const fuzzy = candidates
    .map((candidate) => ({
      candidate,
      score: scoreAddressSimilarity(params.record.addressNormalized, candidate.addressNormalized),
    }))
    .filter((item) => item.score >= 0.72)
    .sort((a, b) => b.score - a.score);

  if (fuzzy.length) {
    const top = fuzzy[0];
    const mismatchReasons = getMismatchReasons(params.record, top.candidate);
    return {
      ...base,
      propertyId: top.candidate.propertyId,
      landlordId: top.candidate.landlordId,
      matchMethod: "address_fuzzy",
      matchScore: Number(top.score.toFixed(2)),
      matchStatus: "possible_match",
      mismatchReasons: Array.from(new Set([...mismatchReasons, fuzzy.length > 1 ? "address_ambiguous" : "manual_confirmation_recommended"])),
    };
  }

  return base;
}

export async function findRegistryCandidatesForRecord(params: {
  adapter: RegistrySourceAdapter;
  record: RegistryRecordNormalized;
}) {
  const { candidates } = await loadPropertyCandidates(params.adapter, params.record.sourceKey);
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: Number(scoreAddressSimilarity(params.record.addressNormalized, candidate.addressNormalized).toFixed(2)),
    }))
    .filter((item) => item.score >= 0.55 || (params.record.pid && item.pid === params.record.pid))
    .sort((a, b) => {
      if (params.record.pid && a.pid === params.record.pid && b.pid !== params.record.pid) return -1;
      if (params.record.pid && b.pid === params.record.pid && a.pid !== params.record.pid) return 1;
      return b.score - a.score;
    })
    .slice(0, 8);
}

export async function reEvaluatePropertyAgainstRegistry(params: {
  adapter: RegistrySourceAdapter;
  propertyId: string;
  sourceKey: RegistrySourceKey;
}) {
  const recordsSnap = await db
    .collection("registryRecordsNormalized")
    .where("sourceKey", "==", params.sourceKey)
    .where("jurisdictionProvince", "==", params.adapter.getSourceDefinition().jurisdictionProvince)
    .get();

  const results: RegistryMatchRecord[] = [];
  for (const doc of recordsSnap.docs || []) {
    const record = { id: doc.id, ...(doc.data() || {}) } as RegistryRecordNormalized;
    const evaluated = await evaluateRegistryMatch({ adapter: params.adapter, record });
    if (evaluated.propertyId === params.propertyId) {
      results.push(evaluated);
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}
