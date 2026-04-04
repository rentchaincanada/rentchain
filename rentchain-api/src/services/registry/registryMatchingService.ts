import { db } from "../../config/firebase";
import type {
  RegistryMatchRecord,
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

function getRecordAddressCandidates(record: RegistryRecordNormalized) {
  const candidates = Array.isArray(record.addressCandidates) ? record.addressCandidates.filter(Boolean) : [];
  if (record.addressNormalized && !candidates.includes(record.addressNormalized)) {
    candidates.unshift(record.addressNormalized);
  }
  return Array.from(new Set(candidates));
}

function getPropertyAddressCandidates(property: RegistryPropertyCandidate) {
  const candidates = Array.isArray(property.addressCandidates) ? property.addressCandidates.filter(Boolean) : [];
  if (property.addressNormalized && !candidates.includes(property.addressNormalized)) {
    candidates.unshift(property.addressNormalized);
  }
  return Array.from(new Set(candidates));
}

function bestAddressScore(record: RegistryRecordNormalized, property: RegistryPropertyCandidate) {
  const recordCandidates = getRecordAddressCandidates(record);
  const propertyCandidates = getPropertyAddressCandidates(property);
  let best = 0;
  for (const left of recordCandidates) {
    for (const right of propertyCandidates) {
      best = Math.max(best, scoreAddressSimilarity(left, right));
    }
  }
  return best;
}

function hasExactAddressCandidateMatch(record: RegistryRecordNormalized, property: RegistryPropertyCandidate) {
  const propertyCandidates = new Set(getPropertyAddressCandidates(property));
  return getRecordAddressCandidates(record).find((candidate) => propertyCandidates.has(candidate)) || null;
}

async function loadPropertyCandidates(adapter: RegistrySourceAdapter, _sourceKey: RegistrySourceKey) {
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
    for (const address of getPropertyAddressCandidates(candidate)) {
      byAddress.set(address, [...(byAddress.get(address) || []), candidate]);
    }
  }

  return { candidates, byPid, byAddress };
}

function buildBaseMatch(record: RegistryRecordNormalized): RegistryMatchRecord {
  const now = nowIso();
  return {
    id: makeStableId([record.sourceKey, record.registryRecordId]),
    sourceKey: record.sourceKey,
    registryRecordId: record.registryRecordId,
    normalizedRecordId: record.id,
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
}

export async function evaluateRegistryMatch(params: {
  adapter: RegistrySourceAdapter;
  record: RegistryRecordNormalized;
}): Promise<RegistryMatchRecord> {
  const record = params.record;
  const { candidates, byPid, byAddress } = await loadPropertyCandidates(params.adapter, record.sourceKey);
  const base = buildBaseMatch(record);
  const addressCandidates = getRecordAddressCandidates(record);

  if (record.pid) {
    const pidMatches = byPid.get(record.pid) || [];
    if (pidMatches.length === 1) {
      const property = pidMatches[0];
      const mismatchReasons = getMismatchReasons(record, property);
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

  const exactMatches = Array.from(
    new Map(
      addressCandidates.flatMap((address) =>
        (byAddress.get(address) || []).map((property) => [property.propertyId, property] as const)
      )
    ).values()
  );

  if (exactMatches.length === 1) {
    const property = exactMatches[0];
    const mismatchReasons = getMismatchReasons(record, property);
    const exactCandidate = hasExactAddressCandidateMatch(record, property);
    return {
      ...base,
      propertyId: property.propertyId,
      landlordId: property.landlordId,
      matchMethod: "address_exact",
      matchScore: addressCandidates.length > 1 ? 0.91 : 0.93,
      matchStatus: mismatchReasons.length ? "mismatch" : "matched",
      mismatchReasons: exactCandidate && addressCandidates.length > 1
        ? Array.from(new Set([...mismatchReasons, "multi_address_candidate_match"]))
        : mismatchReasons,
    };
  }

  if (exactMatches.length > 1) {
    return {
      ...base,
      matchMethod: "address_exact",
      matchScore: 0.68,
      matchStatus: "possible_match",
      mismatchReasons: [addressCandidates.length > 1 ? "ambiguous_multi_address" : "address_ambiguous"],
    };
  }

  const fuzzy = candidates
    .map((candidate) => ({
      candidate,
      score: bestAddressScore(record, candidate),
      exactCandidate: hasExactAddressCandidateMatch(record, candidate),
    }))
    .filter((item) => item.score >= 0.72)
    .sort((a, b) => b.score - a.score);

  if (fuzzy.length) {
    const top = fuzzy[0];
    const mismatchReasons = getMismatchReasons(record, top.candidate);
    const matchedSafely = top.score >= 0.88 && top.exactCandidate && fuzzy.length === 1;
    return {
      ...base,
      propertyId: top.candidate.propertyId,
      landlordId: top.candidate.landlordId,
      matchMethod: matchedSafely ? "address_exact" : "address_fuzzy",
      matchScore: Number(top.score.toFixed(2)),
      matchStatus: matchedSafely ? (mismatchReasons.length ? "mismatch" : "matched") : "possible_match",
      mismatchReasons: Array.from(
        new Set([
          ...mismatchReasons,
          addressCandidates.length > 1 ? "multi_address_candidate_match" : "manual_confirmation_recommended",
          fuzzy.length > 1 ? "address_ambiguous" : null,
        ].filter(Boolean) as string[])
      ),
    };
  }

  const unmatchedReasons: string[] = [];
  if (record.pid) {
    unmatchedReasons.push("no_pid_match");
    if (candidates.length && !candidates.some((candidate) => candidate.pid)) {
      unmatchedReasons.push("missing_internal_property_pid");
    }
  }
  if (record.addressNormalized) {
    unmatchedReasons.push("no_exact_address_match");
  }
  if (addressCandidates.length > 1) {
    unmatchedReasons.push("no_candidate_address_match");
    unmatchedReasons.push("ambiguous_multi_address");
  }

  return {
    ...base,
    mismatchReasons: Array.from(new Set(unmatchedReasons)),
  };
}

export async function findRegistryCandidatesForRecord(params: {
  adapter: RegistrySourceAdapter;
  record: RegistryRecordNormalized;
}) {
  const { candidates } = await loadPropertyCandidates(params.adapter, params.record.sourceKey);
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: Number(bestAddressScore(params.record, candidate).toFixed(2)),
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
