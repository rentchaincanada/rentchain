import { db } from "../../firebase";
import type {
  PropertyRegistryStatusRecord,
  RegistryMatchRecord,
  RegistryRecordNormalized,
  RegistrySourceRecord,
} from "./registryTypes";
import { makeStableId, nowIso } from "./registryUtils";

function getRegistryProjectionPrecedence(match: RegistryMatchRecord) {
  if (!match.propertyId) return 999;
  if (match.matchStatus === "ignored" || match.matchStatus === "unmatched") return 999;
  if (match.matchStatus === "matched") {
    if (match.matchMethod === "manual") return 0;
    if (match.matchMethod === "pid_exact") return 1;
    if (match.matchMethod === "address_exact") return 2;
    return 3;
  }
  if (match.matchStatus === "possible_match") return 4;
  if (match.matchStatus === "mismatch") return 5;
  return 999;
}

export function canRegistryMatchDriveProjection(match: RegistryMatchRecord | null | undefined) {
  if (!match?.propertyId) return false;
  return getRegistryProjectionPrecedence(match) < 999;
}

export function compareRegistryProjectionMatches(a: RegistryMatchRecord, b: RegistryMatchRecord) {
  const precedence = getRegistryProjectionPrecedence(a) - getRegistryProjectionPrecedence(b);
  if (precedence !== 0) return precedence;

  const reviewedAt = String(b.reviewedAt || "").localeCompare(String(a.reviewedAt || ""));
  if (reviewedAt !== 0) return reviewedAt;

  const updatedAt = String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  if (updatedAt !== 0) return updatedAt;

  const score = Number(b.matchScore || 0) - Number(a.matchScore || 0);
  if (score !== 0) return score;

  return String(b.id || "").localeCompare(String(a.id || ""));
}

export function selectRegistryProjectionWinner(matches: RegistryMatchRecord[]) {
  return matches.filter(canRegistryMatchDriveProjection).sort(compareRegistryProjectionMatches)[0] || null;
}

// All landlord-facing registry messaging comes from the persisted
// `propertyRegistryStatus` projection. We never render raw source rows
// directly to landlords. This projection is refreshed after imports,
// manual attach/ignore/review actions, and explicit re-evaluation.
export function derivePropertyRegistryProjection(params: {
  propertyId: string;
  source: RegistrySourceRecord;
  match: RegistryMatchRecord | null;
  record: RegistryRecordNormalized | null;
  existing?: Partial<PropertyRegistryStatusRecord> | null;
}): PropertyRegistryStatusRecord {
  const now = nowIso();
  const existingCreatedAt = String(params.existing?.createdAt || "").trim() || now;
  let registryStatus: PropertyRegistryStatusRecord["registryStatus"] = "not_found";
  let summary =
    "No public registry match found in Halifax public data. This is not a definitive compliance determination.";
  let recommendedAction = "Review property details if you expect a Halifax registry record.";

  if (params.match && params.record) {
    if (params.match.matchStatus === "matched") {
      if (params.record.registrationStatusNormalized === "registered") {
        registryStatus = "verified";
        summary = "Verified against public Halifax rental registry data.";
        recommendedAction = "No action needed.";
      } else {
        registryStatus = "pending_review";
        summary = "Public record found; municipal review may still be pending.";
        recommendedAction = "Monitor the municipal record and review property details if needed.";
      }
    } else if (params.match.matchStatus === "mismatch") {
      registryStatus = "possible_mismatch";
      summary = "Possible mismatch detected between public registry data and your property details.";
      recommendedAction = "Review property details or contact support for manual confirmation.";
    } else if (params.match.matchStatus === "possible_match") {
      registryStatus = "manual_review";
      summary = "Manual review in progress before a public registry status can be confirmed.";
      recommendedAction = "No action needed while the record is being reviewed.";
    }
  }

  return {
    id: makeStableId([params.source.sourceKey, params.propertyId]),
    propertyId: params.propertyId,
    sourceKey: params.source.sourceKey,
    jurisdictionProvince: params.source.jurisdictionProvince,
    jurisdictionMunicipality: params.source.jurisdictionMunicipality,
    registryStatus,
    registryRecordId: params.record?.registryRecordId || null,
    registrationNumber: params.record?.registrationNumber || null,
    pid: params.record?.pid || null,
    matchedAt: params.match ? now : params.existing?.matchedAt || null,
    matchConfidence: params.match ? params.match.matchScore : null,
    summary,
    recommendedAction,
    lastSourceRefreshAt: params.record?.updatedAt || params.existing?.lastSourceRefreshAt || null,
    lastEvaluatedAt: now,
    createdAt: existingCreatedAt,
    updatedAt: now,
  };
}

export async function upsertPropertyRegistryProjection(params: {
  propertyId: string;
  source: RegistrySourceRecord;
  match: RegistryMatchRecord | null;
  record: RegistryRecordNormalized | null;
}) {
  const docId = makeStableId([params.source.sourceKey, params.propertyId]);
  const ref = db.collection("propertyRegistryStatus").doc(docId);
  const existing = await ref.get();
  const projection = derivePropertyRegistryProjection({
    ...params,
    existing: existing.exists ? ({ id: existing.id, ...(existing.data() || {}) } as any) : null,
  });
  await ref.set(projection, { merge: true });
  return projection;
}

export async function getPropertyRegistryProjection(params: {
  propertyId: string;
  source: RegistrySourceRecord;
}) {
  const docId = makeStableId([params.source.sourceKey, params.propertyId]);
  const snap = await db.collection("propertyRegistryStatus").doc(docId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() || {}) } as PropertyRegistryStatusRecord;
}
