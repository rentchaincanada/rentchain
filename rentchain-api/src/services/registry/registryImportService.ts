import { db } from "../../config/firebase";
import { commitInBatches } from "../../imports/firestoreBatch";
import { recordRegistryAuditEvent } from "./registryAuditService";
import type {
  RegistryImportRecord,
  RegistryMatchRecord,
  RegistryPropertyCandidate,
  RegistryRecordNormalized,
  RegistrySourceKey,
  RegistrySourceRecord,
} from "./registryTypes";
import { makeStableId, normalizePid, nowIso } from "./registryUtils";
import { HalifaxR400Adapter } from "./adapters/HalifaxR400Adapter";
import type { RegistrySourceAdapter } from "./adapters/RegistrySourceAdapter";
import { evaluateRegistryMatch, findRegistryCandidatesForRecord, reEvaluatePropertyAgainstRegistry } from "./registryMatchingService";
import { getPropertyRegistryProjection, upsertPropertyRegistryProjection } from "./registryStatusProjectionService";
import { getPropertyById } from "../firestorePropertiesService";
import { listAdminProperties } from "../admin/adminPropertyView";

class RegistryOverrideError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, options: { code: string; statusCode: number }) {
    super(message);
    this.name = "RegistryOverrideError";
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

type PropertyPidUpdateErrorCode =
  | "missing_registry_pid"
  | "missing_property_context"
  | "pid_update_confirmation_required";

type RegistryMatchOverrideErrorCode =
  | PropertyPidUpdateErrorCode
  | "existing_property_match_conflict"
  | "registry_record_not_found"
  | "invalid_property_id"
  | "property_not_found";

function getAdapter(sourceKey: RegistrySourceKey): RegistrySourceAdapter {
  if (sourceKey === "halifax_r400") return new HalifaxR400Adapter();
  throw new Error(`Unsupported registry source: ${sourceKey}`);
}

function isMissingIndexError(error: unknown) {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("index") && (message.includes("firestore") || message.includes("query requires"));
}

function summarizeRegistryReason(code: string) {
  switch (String(code || "").trim()) {
    case "no_pid_match":
      return "Registry PID did not match any internal property PID.";
    case "missing_internal_property_pid":
      return "Internal property PID is missing, so PID auto-match could not run.";
    case "no_exact_address_match":
      return "No exact address match was found.";
    case "no_candidate_address_match":
      return "No candidate address match was found from the registry row.";
    case "ambiguous_multi_address":
      return "Multi-address registry row requires review before confirming a property link.";
    case "multi_address_candidate_match":
      return "One address candidate aligns with the property, but the row contains multiple civic addresses.";
    case "manual_confirmation_recommended":
      return "Manual confirmation is recommended before trusting this match.";
    case "address_ambiguous":
      return "More than one property may fit this address.";
    case "pid_ambiguous":
      return "More than one property shares this PID and needs manual review.";
    case "unit_count_conflict":
      return "Registered unit count differs from the internal property count.";
    case "building_type_conflict":
      return "Building type differs between the registry record and the property.";
    default:
      return code ? code.replace(/_/g, " ") : "";
  }
}

function summarizeRegistryReasons(codes: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      codes
        .map((code) => summarizeRegistryReason(String(code || "").trim()))
        .filter(Boolean)
    )
  );
}

function safeLower(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function tokenizeSearchValue(value: unknown) {
  const normalized = safeLower(value);
  if (!normalized) return [] as string[];
  const compact = normalized.replace(/\s+/g, " ").trim();
  const alnumCompact = compact.replace(/[^a-z0-9_-]+/g, "");
  const tokens = compact
    .split(/[^a-z0-9_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return Array.from(new Set([compact, alnumCompact, ...tokens].filter(Boolean)));
}

function encodeRegistryReviewCursor(input: { updatedAt: string; id: string }) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64");
}

function decodeRegistryReviewCursor(input: string | null | undefined) {
  if (!input) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(input), "base64").toString("utf8"));
    const updatedAt = String(parsed?.updatedAt || "").trim();
    const id = String(parsed?.id || "").trim();
    if (!updatedAt || !id) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

function compareRegistryReviewQueueDocs(a: { id: string; data: () => any }, b: { id: string; data: () => any }) {
  const updatedCompare = String(b.data()?.updatedAt || "").localeCompare(String(a.data()?.updatedAt || ""));
  if (updatedCompare !== 0) return updatedCompare;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

function isAfterRegistryReviewCursor(
  doc: { id: string; data: () => any },
  cursor: { updatedAt: string; id: string } | null
) {
  if (!cursor) return true;
  const updatedAt = String(doc.data()?.updatedAt || "");
  const updatedCompare = updatedAt.localeCompare(cursor.updatedAt);
  if (updatedCompare !== 0) return updatedCompare < 0;
  return String(doc.id || "").localeCompare(cursor.id) < 0;
}

function buildRegistryReviewQueueItem(match: RegistryMatchRecord) {
  const queueSummary = match.queueSummary || null;
  return {
    match: {
      id: match.id,
      sourceKey: match.sourceKey,
      registryRecordId: match.registryRecordId,
      normalizedRecordId: match.normalizedRecordId,
      propertyId: match.propertyId,
      landlordId: match.landlordId,
      matchMethod: match.matchMethod,
      matchScore: match.matchScore,
      matchStatus: match.matchStatus,
      mismatchReasons: match.mismatchReasons,
      reviewedBy: match.reviewedBy,
      reviewedAt: match.reviewedAt,
      overrideReason: match.overrideReason,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    },
    normalizedRecord: queueSummary
      ? {
          id: match.normalizedRecordId,
          registryRecordId: match.registryRecordId,
          registrationNumber: queueSummary.registrationNumber,
          pid: queueSummary.registryPid,
          addressRaw: queueSummary.displayAddress,
        }
      : {
          id: match.normalizedRecordId,
          registryRecordId: match.registryRecordId,
          registrationNumber: null,
          pid: null,
          addressRaw: null,
        },
    property: queueSummary?.property || null,
    topCandidate: queueSummary?.topCandidate || null,
    reasonSummary: queueSummary?.reasonSummary || summarizeRegistryReasons(match.mismatchReasons || []),
  };
}

async function listRegistryReviewQueueFallback(params: {
  sourceKey: RegistrySourceKey;
  statusFilter: RegistryMatchRecord["matchStatus"] | null;
  searchTokens: string[];
  pageSize: number;
  cursor: { updatedAt: string; id: string } | null;
  summary: Record<"all" | RegistryMatchRecord["matchStatus"], number>;
}) {
  let baseQuery: FirebaseFirestore.Query = db.collection("registryMatches").where("sourceKey", "==", params.sourceKey);
  if (params.statusFilter) {
    baseQuery = baseQuery.where("matchStatus", "==", params.statusFilter);
  }
  const snap = await baseQuery.get();
  const docs = (snap.docs || []).sort(compareRegistryReviewQueueDocs);
  const scannedDocs = docs.filter((doc) => isAfterRegistryReviewCursor(doc, params.cursor));
  const collected: ReturnType<typeof buildRegistryReviewQueueItem>[] = [];
  const matchedDocs: Array<{ id: string; data: () => any }> = [];

  for (const doc of scannedDocs) {
    const match = await enrichRegistryMatchForQueue({
      match: { id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord,
      includeTopCandidate: true,
    });
    const matchesAllTokens = params.searchTokens.every((token) => (match.queueSearchTokens || []).includes(token));
    if (params.searchTokens.length && !matchesAllTokens) continue;
    collected.push(buildRegistryReviewQueueItem(match));
    matchedDocs.push(doc);
    if (collected.length >= params.pageSize + 1) break;
  }

  const pageItems = collected.slice(0, params.pageSize);
  const hasMore = collected.length > params.pageSize;
  const cursorDoc = hasMore ? matchedDocs[params.pageSize - 1] || null : null;

  return {
    items: pageItems,
    pageInfo: {
      pageSize: params.pageSize,
      nextCursor: cursorDoc
        ? encodeRegistryReviewCursor({
            updatedAt: String(cursorDoc.data()?.updatedAt || ""),
            id: String(cursorDoc.id || ""),
          })
        : null,
      hasMore,
    },
    summary: params.summary,
  };
}

async function buildRegistryReviewQueueSummary(params: {
  adapter: RegistrySourceAdapter;
  match: RegistryMatchRecord;
  normalizedRecord: RegistryRecordNormalized | null;
  property?: Record<string, any> | null;
  includeTopCandidate?: boolean;
}) {
  const propertySummary = params.property
    ? {
        id: String(params.property.id || params.match.propertyId || ""),
        name: String(params.property.name || "").trim() || null,
        addressLine1: String(params.property.addressLine1 || params.property.address1 || params.property.address || "").trim() || null,
        city: String(params.property.city || "").trim() || null,
        province: String(params.property.province || "").trim() || null,
        postalCode: String(params.property.postalCode || "").trim() || null,
        pid: resolvePropertyPidLikeValue(params.property),
      }
    : null;

  let topCandidate: NonNullable<NonNullable<RegistryMatchRecord["queueSummary"]>["topCandidate"]> | null = null;
  if (params.includeTopCandidate && params.normalizedRecord && !params.match.propertyId) {
    const candidate = (await findRegistryCandidatesForRecord({
      adapter: params.adapter,
      record: params.normalizedRecord,
    }))[0];
    if (candidate) {
      topCandidate = {
        propertyId: candidate.propertyId,
        propertyName: candidate.propertyName,
        addressLine1: candidate.addressLine1,
        city: candidate.city,
        province: candidate.province,
        postalCode: candidate.postalCode,
        pid: candidate.pid,
        unitCount: candidate.unitCount,
        score: candidate.score,
      };
    }
  }

  const reasonSummary = summarizeRegistryReasons([
    ...(params.match.mismatchReasons || []),
    ...(params.normalizedRecord?.internalDiagnostics?.unmatchedReasons || []),
  ]);

  const queueSummary = {
    displayAddress: params.normalizedRecord?.addressRaw || null,
    registrationNumber: params.normalizedRecord?.registrationNumber || null,
    registryPid: params.normalizedRecord?.pid || null,
    property: propertySummary,
    topCandidate,
    reasonSummary,
  };

  const queueSearchTokens = Array.from(
    new Set([
      ...tokenizeSearchValue(queueSummary.displayAddress),
      ...tokenizeSearchValue(queueSummary.registrationNumber),
      ...tokenizeSearchValue(queueSummary.registryPid),
      ...tokenizeSearchValue(queueSummary.property?.name),
      ...tokenizeSearchValue(queueSummary.property?.addressLine1),
      ...tokenizeSearchValue(queueSummary.property?.pid),
      ...tokenizeSearchValue(queueSummary.topCandidate?.propertyName),
      ...tokenizeSearchValue(queueSummary.topCandidate?.addressLine1),
      ...tokenizeSearchValue(queueSummary.topCandidate?.pid),
    ])
  );

  return { queueSummary, queueSearchTokens };
}

async function enrichRegistryMatchForQueue(params: {
  match: RegistryMatchRecord;
  normalizedRecord?: RegistryRecordNormalized | null;
  source?: RegistrySourceRecord | null;
  includeTopCandidate?: boolean;
}) {
  const normalizedResolved =
    params.normalizedRecord ??
    (params.match.normalizedRecordId
      ? await (async () => {
          const snap = await db.collection("registryRecordsNormalized").doc(params.match.normalizedRecordId).get();
          return snap.exists ? ({ id: snap.id, ...(snap.data() || {}) } as RegistryRecordNormalized) : null;
        })()
      : null);
  const source =
    params.source || (normalizedResolved ? (await ensureRegistrySource(normalizedResolved.sourceKey)).source : null);
  const adapter = source ? getAdapter(source.sourceKey) : null;
  const property =
    params.match.propertyId && adapter
      ? await (async () => {
          const snap = await db.collection("properties").doc(String(params.match.propertyId)).get();
          return snap.exists ? ({ id: snap.id, ...(snap.data() || {}) } as any) : null;
        })()
      : null;
  if (!adapter) {
    return {
      ...params.match,
      queueSummary: params.match.queueSummary,
      queueSearchTokens: params.match.queueSearchTokens || [],
    };
  }
  const queue = await buildRegistryReviewQueueSummary({
    adapter,
    match: params.match,
    normalizedRecord: normalizedResolved,
    property,
    includeTopCandidate: params.includeTopCandidate !== false,
  });
  const enriched = {
    ...params.match,
    queueSummary: queue.queueSummary,
    queueSearchTokens: queue.queueSearchTokens,
  };
  await db.collection("registryMatches").doc(params.match.id).set(
    {
      queueSummary: queue.queueSummary,
      queueSearchTokens: queue.queueSearchTokens,
    },
    { merge: true }
  );
  return enriched;
}

function resolvePropertyPidLikeValue(property: Record<string, any>) {
  const metadata = property?.metadata && typeof property.metadata === "object" ? property.metadata : {};
  return (
    normalizePid(property?.pid) ||
    normalizePid(property?.PID) ||
    normalizePid(property?.propertyPid) ||
    normalizePid(property?.parcelId) ||
    normalizePid(property?.parcelPid) ||
    normalizePid((metadata as any)?.pid) ||
    normalizePid((metadata as any)?.propertyPid) ||
    normalizePid((metadata as any)?.parcelId) ||
    null
  );
}

function getPropertyUnitCount(property: Record<string, any>) {
  const raw = property?.unitCount ?? property?.totalUnits ?? property?.unitsTotal ?? null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPropertyDisplayAddress(property: Record<string, any>) {
  return [
    String(property?.addressLine1 || property?.address1 || property?.address || "").trim() || null,
    String(property?.city || "").trim() || null,
    String(property?.province || "").trim() || null,
    String(property?.postalCode || "").trim() || null,
  ]
    .filter(Boolean)
    .join(", ");
}

function getPropertyAddressCandidates(propertyCandidate: RegistryPropertyCandidate) {
  const candidates = Array.isArray(propertyCandidate.addressCandidates)
    ? propertyCandidate.addressCandidates.filter(Boolean)
    : [];
  if (propertyCandidate.addressNormalized && !candidates.includes(propertyCandidate.addressNormalized)) {
    candidates.unshift(propertyCandidate.addressNormalized);
  }
  return Array.from(new Set(candidates));
}

function buildRegistryPropertyComparison(params: {
  adapter: RegistrySourceAdapter;
  property: Record<string, any>;
  record: RegistryRecordNormalized | null;
  match?: RegistryMatchRecord | null;
}) {
  const propertyCandidate = params.adapter.buildPropertyAddressCandidate({
    id: params.property.id,
    ...params.property,
  });
  const propertyPid = resolvePropertyPidLikeValue(params.property);
  const registryPid = params.record?.pid || null;
  const propertyAddressCandidates = getPropertyAddressCandidates(propertyCandidate);
  const registryAddressCandidates = Array.isArray(params.record?.addressCandidates)
    ? params.record?.addressCandidates.filter(Boolean)
    : [];
  if (params.record?.addressNormalized && !registryAddressCandidates.includes(params.record.addressNormalized)) {
    registryAddressCandidates.unshift(params.record.addressNormalized);
  }
  const exactAddressMatch = registryAddressCandidates.some((candidate) => propertyAddressCandidates.includes(candidate));

  let pidStatus: "exact_match" | "missing_internal_pid" | "mismatch" | "missing_registry_pid" | "unavailable" =
    "unavailable";
  if (propertyPid && registryPid) pidStatus = propertyPid === registryPid ? "exact_match" : "mismatch";
  else if (!propertyPid && registryPid) pidStatus = "missing_internal_pid";
  else if (propertyPid && !registryPid) pidStatus = "missing_registry_pid";

  const operatorPrompts: string[] = [];
  if (pidStatus === "missing_internal_pid" && registryPid) {
    operatorPrompts.push(
      "Property PID missing; registry record includes PID. Consider updating property data before confirming registry link."
    );
  }
  if (pidStatus === "exact_match") {
    operatorPrompts.push("Internal property PID matches the registry PID exactly.");
  }
  if (pidStatus === "mismatch") {
    operatorPrompts.push("Property PID differs from the registry PID. Manual confirmation is recommended.");
  }
  if ((params.record?.internalDiagnostics?.addressCandidateCount || 0) > 1) {
    operatorPrompts.push("Registry row contains multiple civic addresses. Review the selected property carefully.");
  }

  return {
    propertyId: propertyCandidate.propertyId,
    propertyName: propertyCandidate.propertyName,
    propertyAddress: getPropertyDisplayAddress(params.property),
    propertyPid,
    registryRecordId: params.record?.registryRecordId || null,
    registryRegistrationNumber: params.record?.registrationNumber || null,
    registryAddress: params.record?.addressRaw || null,
    registryPid,
    propertyPostalCode: propertyCandidate.postalCode,
    registryPostalCode: params.record?.postalCode || null,
    propertyUnitCount: propertyCandidate.unitCount ?? getPropertyUnitCount(params.property),
    registryUnitCount: params.record?.registeredUnits ?? null,
    propertyBuildingType: propertyCandidate.buildingType || null,
    registryBuildingType: params.record?.buildingTypeRaw || null,
    pidStatus,
    exactAddressMatch,
    operatorPrompts,
    reasonSummary: summarizeRegistryReasons([
      ...(params.match?.mismatchReasons || []),
      ...(params.record?.internalDiagnostics?.unmatchedReasons || []),
    ]),
  };
}

function requireRegistryPidUpdateConfirmation(params: {
  propertyPid: string | null;
  registryPid: string | null;
  confirmOverwrite?: boolean;
}) {
  if (!params.registryPid) {
    throw new RegistryOverrideError("The selected registry record does not include a PID to apply.", {
      code: "missing_registry_pid" satisfies PropertyPidUpdateErrorCode,
      statusCode: 400,
    });
  }
  if (params.propertyPid && params.propertyPid !== params.registryPid && !params.confirmOverwrite) {
    throw new RegistryOverrideError(
      "Property already has a different PID. Confirm overwrite to apply the registry PID.",
      {
        code: "pid_update_confirmation_required" satisfies PropertyPidUpdateErrorCode,
        statusCode: 409,
      }
    );
  }
}

function summarizeImportDiagnostics(params: {
  rawRows: Array<Record<string, any>>;
  normalizedRows: RegistryRecordNormalized[];
  matches: RegistryMatchRecord[];
}) {
  const seenHashes = new Set<string>();
  let duplicateRowHashCount = 0;
  let missingPidCount = 0;
  let missingAddressCount = 0;
  let unsupportedStatusCount = 0;
  let invalidNumericFieldCount = 0;

  for (const row of params.rawRows) {
    const hash = String(row.sourceRowHash || "").trim();
    if (hash) {
      if (seenHashes.has(hash)) duplicateRowHashCount += 1;
      else seenHashes.add(hash);
    }
    if (!row.pid) missingPidCount += 1;
    if (!row.address) missingAddressCount += 1;
    const registeredRaw = String(row.registered || "").trim();
    if (registeredRaw && !["y", "yes", "true", "registered", "n", "no", "false"].includes(registeredRaw.toLowerCase())) {
      unsupportedStatusCount += 1;
    }
    const numericInputs: Array<[unknown, unknown]> = [
      [row.registeredUnits, row.sourcePayload?.["Registered Units"]],
      [row.numberOfFloors, row.sourcePayload?.["Number of Floors"]],
      [row.x, row.sourcePayload?.x],
      [row.y, row.sourcePayload?.y],
    ];
    for (const [parsed, raw] of numericInputs) {
      if (parsed == null && String(raw ?? "").trim()) invalidNumericFieldCount += 1;
    }
  }

  return {
    missingPidCount,
    missingAddressCount,
    unsupportedStatusCount,
    invalidNumericFieldCount,
    duplicateRowHashCount,
    ignoredRowCount: params.matches.filter((item) => item.matchStatus === "ignored").length,
    skippedRowCount: Math.max(0, params.rawRows.length - params.normalizedRows.length),
  };
}

async function resolvePropertyForRegistryOverride(propertyIdInput: string) {
  const propertyId = String(propertyIdInput || "").trim();
  if (!propertyId) {
    throw new RegistryOverrideError("propertyId is required to attach a registry record", {
      code: "invalid_property_id",
      statusCode: 400,
    });
  }
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(propertyId)) {
    throw new RegistryOverrideError(
      "propertyId must be a valid property document identifier using letters, numbers, underscores, or hyphens",
      {
        code: "invalid_property_id",
        statusCode: 400,
      }
    );
  }

  const directSnap = await db.collection("properties").doc(propertyId).get();
  if (directSnap.exists) {
    return { id: directSnap.id, ...(directSnap.data() || {}) } as any;
  }

  const canonical = await getPropertyById(propertyId).catch(() => null);
  if (canonical) {
    return { ...canonical, id: String((canonical as any).id || propertyId) } as any;
  }

  const [idFieldSnap, propertyIdFieldSnap] = await Promise.all([
    db.collection("properties").where("id", "==", propertyId).limit(1).get(),
    db.collection("properties").where("propertyId", "==", propertyId).limit(1).get(),
  ]);

  const fallbackDoc = idFieldSnap.docs?.[0] || propertyIdFieldSnap.docs?.[0] || null;
  if (fallbackDoc?.exists) {
    return { id: fallbackDoc.id, ...(fallbackDoc.data() || {}) } as any;
  }

  throw new RegistryOverrideError(`No property document was found for id "${propertyId}"`, {
    code: "property_not_found" satisfies RegistryMatchOverrideErrorCode,
    statusCode: 404,
  });
}

function isActiveTrustedMatchStatus(status: RegistryMatchRecord["matchStatus"] | null | undefined) {
  return status === "matched" || status === "mismatch" || status === "possible_match";
}

async function findActiveMatchForPropertySource(params: {
  propertyId: string;
  sourceKey: RegistrySourceKey;
  excludeNormalizedRecordId?: string | null;
}) {
  const snap = await db
    .collection("registryMatches")
    .where("propertyId", "==", params.propertyId)
    .where("sourceKey", "==", params.sourceKey)
    .get();

  const matches = (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord))
    .filter((match) => {
      if (!isActiveTrustedMatchStatus(match.matchStatus)) return false;
      if (params.excludeNormalizedRecordId && match.normalizedRecordId === params.excludeNormalizedRecordId) return false;
      return true;
    })
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  return matches[0] || null;
}

async function transitionExistingMatchToReview(params: {
  existingMatch: RegistryMatchRecord;
  actorId: string;
  reason: string;
  source: RegistrySourceRecord;
}) {
  const snap = await db.collection("registryRecordsNormalized").doc(params.existingMatch.normalizedRecordId).get();
  const normalizedRecord = snap.exists ? ({ id: snap.id, ...(snap.data() || {}) } as RegistryRecordNormalized) : null;
  let replacement: RegistryMatchRecord;
  if (normalizedRecord) {
    const reevaluated = await evaluateRegistryMatch({
      adapter: getAdapter(normalizedRecord.sourceKey),
      record: normalizedRecord,
    });
    replacement = {
      ...reevaluated,
      id: params.existingMatch.id,
      normalizedRecordId: params.existingMatch.normalizedRecordId,
      createdAt: params.existingMatch.createdAt || nowIso(),
      updatedAt: nowIso(),
      reviewedBy: params.actorId,
      reviewedAt: nowIso(),
      overrideReason: params.reason,
      propertyId: null,
      landlordId: null,
      matchStatus:
        reevaluated.matchStatus === "matched" || reevaluated.matchStatus === "mismatch"
          ? "possible_match"
          : reevaluated.matchStatus,
    };
  } else {
    replacement = {
      ...params.existingMatch,
      propertyId: null,
      landlordId: null,
      matchStatus: "unmatched",
      matchMethod: params.existingMatch.matchMethod || null,
      updatedAt: nowIso(),
      reviewedBy: params.actorId,
      reviewedAt: nowIso(),
      overrideReason: params.reason,
    };
  }

  await db.collection("registryMatches").doc(params.existingMatch.id).set(replacement, { merge: true });
  await refreshPropertyProjectionFromCurrentMatches({
    propertyId: String(params.existingMatch.propertyId || ""),
    source: params.source,
    actorId: params.actorId,
  });
  await recordRegistryAuditEvent({
    sourceKey: params.source.sourceKey,
    registryRecordId: params.existingMatch.registryRecordId,
    propertyId: String(params.existingMatch.propertyId || "") || null,
    actorType: "admin",
    actorId: params.actorId,
    eventType: "match_returned_to_review",
    eventData: {
      reason: params.reason,
      replacementMatchStatus: replacement.matchStatus,
      replacedByNormalizedRecordId: params.existingMatch.normalizedRecordId,
    },
  });
  return replacement;
}

export async function ensureRegistrySource(sourceKey: RegistrySourceKey) {
  const adapter = getAdapter(sourceKey);
  const base = adapter.getSourceDefinition();
  const now = nowIso();
  const ref = db.collection("registrySources").doc(sourceKey);
  const snap = await ref.get();
  const record: RegistrySourceRecord = {
    ...base,
    id: sourceKey,
    latestImportId: snap.exists ? (snap.data() as any)?.latestImportId || null : null,
    createdAt: snap.exists ? String((snap.data() as any)?.createdAt || now) : now,
    updatedAt: now,
  };
  await ref.set(record, { merge: true });
  await recordRegistryAuditEvent({
    sourceKey,
    actorType: "system",
    actorId: null,
    eventType: "source_upserted",
    eventData: { sourceLabel: record.sourceLabel, active: record.active },
  });
  return { adapter, source: record };
}

async function writeImportRecord(input: RegistryImportRecord) {
  await db.collection("registryImports").doc(input.id).set(input, { merge: true });
}

async function refreshPropertyProjectionFromCurrentMatches(params: {
  propertyId: string;
  source: RegistrySourceRecord;
  actorId?: string | null;
  importBatchId?: string | null;
}) {
  let query: FirebaseFirestore.Query = db
    .collection("registryMatches")
    .where("propertyId", "==", params.propertyId)
    .where("sourceKey", "==", params.source.sourceKey);
  try {
    query = query.orderBy("updatedAt", "desc");
  } catch {
    // no-op for mocked/query-like objects
  }
  const matchesSnap = await query.get();
  const matches = (matchesSnap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord))
    .filter((match) => match.matchStatus === "matched" || match.matchStatus === "mismatch" || match.matchStatus === "possible_match")
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const best = matches[0] || null;

  let record: RegistryRecordNormalized | null = null;
  if (best?.normalizedRecordId) {
    const snap = await db.collection("registryRecordsNormalized").doc(best.normalizedRecordId).get();
    if (snap.exists) record = { id: snap.id, ...(snap.data() || {}) } as RegistryRecordNormalized;
  }

  const projection = await upsertPropertyRegistryProjection({
    propertyId: params.propertyId,
    source: params.source,
    match: best,
    record,
  });
  await recordRegistryAuditEvent({
    sourceKey: params.source.sourceKey,
    importBatchId: params.importBatchId || null,
    registryRecordId: record?.registryRecordId || null,
    propertyId: params.propertyId,
    actorType: params.actorId ? "admin" : "system",
    actorId: params.actorId || null,
    eventType: "projection_updated",
    eventData: {
      triggeredBy: best ? "match_refresh" : "projection_reset",
      registryStatus: projection.registryStatus,
    },
  });
  return projection;
}

export async function runRegistryImport(params: {
  sourceKey: RegistrySourceKey;
  csvText: string;
  sourceFileName?: string | null;
  sourceFileStoragePath?: string | null;
  actorId?: string | null;
}) {
  const { adapter, source } = await ensureRegistrySource(params.sourceKey);
  const now = nowIso();
  const importBatchId = makeStableId([params.sourceKey, Date.now()]);
  const importRecord: RegistryImportRecord = {
    id: importBatchId,
    sourceKey: params.sourceKey,
    sourceFileName: params.sourceFileName || null,
    sourceFileStoragePath: params.sourceFileStoragePath || null,
    importBatchId,
    rowCount: 0,
    parsedRowCount: 0,
    normalizedRowCount: 0,
    matchedRowCount: 0,
    unmatchedRowCount: 0,
    mismatchRowCount: 0,
    ignoredRowCount: 0,
    skippedRowCount: 0,
    status: "processing",
    errorSummary: null,
    diagnostics: {
      missingPidCount: 0,
      missingAddressCount: 0,
      unsupportedStatusCount: 0,
      invalidNumericFieldCount: 0,
      duplicateRowHashCount: 0,
    },
    startedAt: now,
    completedAt: null,
    createdBy: params.actorId || null,
    createdAt: now,
  };

  await writeImportRecord(importRecord);
  await recordRegistryAuditEvent({
    sourceKey: params.sourceKey,
    importBatchId,
    actorType: "admin",
    actorId: params.actorId || null,
    eventType: "import_started",
    eventData: { sourceFileName: params.sourceFileName || null },
  });

  try {
    const parsedRows = adapter.parse(params.csvText);
    const importedAt = nowIso();
    const context = { importRecord, source, importedAt };
    const rawRows = parsedRows.map((row, index) => adapter.mapRawRow(row, index, context));
    const normalizedRows = rawRows.map((row) => adapter.normalizeRawRow(row, context));

    await commitInBatches(
      rawRows.map((row) => (batch) => {
        batch.set(db.collection("registryRecordsRaw").doc(row.id), row, { merge: true });
      })
    );
    await commitInBatches(
      normalizedRows.map((row) => (batch) => {
        batch.set(db.collection("registryRecordsNormalized").doc(row.id), row, { merge: true });
      })
    );

    const matches: RegistryMatchRecord[] = [];
    for (const row of normalizedRows) {
      const evaluatedBase = await evaluateRegistryMatch({ adapter, record: row });
      const evaluated = await enrichRegistryMatchForQueue({
        match: evaluatedBase,
        normalizedRecord: row,
        source,
        includeTopCandidate: true,
      });
      matches.push(evaluated);
      await db.collection("registryMatches").doc(evaluated.id).set(evaluated, { merge: true });
      await recordRegistryAuditEvent({
        sourceKey: params.sourceKey,
        importBatchId,
        registryRecordId: row.registryRecordId,
        propertyId: evaluated.propertyId,
        actorType: "system",
        actorId: null,
        eventType: "match_evaluated",
        eventData: {
          matchStatus: evaluated.matchStatus,
          matchMethod: evaluated.matchMethod,
          matchScore: evaluated.matchScore,
          mismatchReasons: evaluated.mismatchReasons,
        },
      });
    }

    for (const match of matches.filter((item) => item.propertyId)) {
      const record = normalizedRows.find((item) => item.id === match.normalizedRecordId) || null;
      if (!record || !match.propertyId) continue;
      const projection = await upsertPropertyRegistryProjection({
        propertyId: match.propertyId,
        source,
        match,
        record,
      });
      await recordRegistryAuditEvent({
        sourceKey: params.sourceKey,
        importBatchId,
        registryRecordId: record.registryRecordId,
        propertyId: match.propertyId,
        actorType: "system",
        actorId: null,
        eventType: "projection_updated",
        eventData: {
          registryStatus: projection.registryStatus,
          matchStatus: match.matchStatus,
        },
      });
    }

    const diagnostics = summarizeImportDiagnostics({ rawRows, normalizedRows, matches });
    const summary = {
      rowCount: parsedRows.length,
      parsedRowCount: rawRows.length,
      normalizedRowCount: normalizedRows.length,
      matchedRowCount: matches.filter((item) => item.matchStatus === "matched").length,
      unmatchedRowCount: matches.filter((item) => item.matchStatus === "unmatched").length,
      mismatchRowCount: matches.filter((item) => item.matchStatus === "mismatch").length,
      ignoredRowCount: diagnostics.ignoredRowCount,
      skippedRowCount: diagnostics.skippedRowCount,
      diagnostics: {
        missingPidCount: diagnostics.missingPidCount,
        missingAddressCount: diagnostics.missingAddressCount,
        unsupportedStatusCount: diagnostics.unsupportedStatusCount,
        invalidNumericFieldCount: diagnostics.invalidNumericFieldCount,
        duplicateRowHashCount: diagnostics.duplicateRowHashCount,
      },
    };

    const completedImport: RegistryImportRecord = {
      ...importRecord,
      ...summary,
      status: "completed",
      completedAt: nowIso(),
    };
    await writeImportRecord(completedImport);
    await db.collection("registrySources").doc(params.sourceKey).set(
      {
        latestImportId: importBatchId,
        updatedAt: nowIso(),
      },
      { merge: true }
    );
    await recordRegistryAuditEvent({
      sourceKey: params.sourceKey,
      importBatchId,
      actorType: "admin",
      actorId: params.actorId || null,
      eventType: "import_completed",
      eventData: summary,
    });

    return {
      importRecord: completedImport,
      summary,
    };
  } catch (error: any) {
    const failedImport: RegistryImportRecord = {
      ...importRecord,
      status: "failed",
      errorSummary: String(error?.message || "Registry import failed"),
      completedAt: nowIso(),
    };
    await writeImportRecord(failedImport);
    await recordRegistryAuditEvent({
      sourceKey: params.sourceKey,
      importBatchId,
      actorType: "admin",
      actorId: params.actorId || null,
      eventType: "import_failed",
      eventData: { errorSummary: failedImport.errorSummary },
    });
    throw error;
  }
}

export async function listRegistrySources() {
  await ensureRegistrySource("halifax_r400");
  const snap = await db.collection("registrySources").orderBy("sourceLabel").get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

export async function listRegistryImports(sourceKey?: RegistrySourceKey | null) {
  let query: FirebaseFirestore.Query = db.collection("registryImports").orderBy("createdAt", "desc");
  if (sourceKey) {
    query = db.collection("registryImports").where("sourceKey", "==", sourceKey).orderBy("createdAt", "desc");
  }
  try {
    const snap = await query.get();
    return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    if (isMissingIndexError(error)) {
      console.warn("[registry] listRegistryImports missing index", { sourceKey, message: (error as any)?.message });
      return [];
    }
    throw error;
  }
}

export async function listRegistryReviewQueue(input?: {
  sourceKey?: RegistrySourceKey | null;
  matchStatus?: RegistryMatchRecord["matchStatus"] | "all" | null;
  search?: string | null;
  pageSize?: number | null;
  pageCursor?: string | null;
}) {
  const sourceKey = (input?.sourceKey || "halifax_r400") as RegistrySourceKey;
  const searchTokens = tokenizeSearchValue(input?.search).slice(0, 8);
  const statusFilter = input?.matchStatus && input.matchStatus !== "all" ? input.matchStatus : null;
  const pageSizeRaw = Number(input?.pageSize ?? 50);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(Math.floor(pageSizeRaw), 1), 100) : 50;
  const cursor = decodeRegistryReviewCursor(input?.pageCursor);

  const summary = {
    all: 0,
    possible_match: 0,
    mismatch: 0,
    unmatched: 0,
    matched: 0,
    ignored: 0,
  } as Record<"all" | RegistryMatchRecord["matchStatus"], number>;

  const summarySnap = await db.collection("registryMatches").where("sourceKey", "==", sourceKey).get();
  for (const doc of summarySnap.docs || []) {
    const status = String((doc.data() || {}).matchStatus || "").trim() as RegistryMatchRecord["matchStatus"];
    summary.all += 1;
    if (status && status in summary) summary[status] += 1;
  }

  let query: FirebaseFirestore.Query = db.collection("registryMatches").where("sourceKey", "==", sourceKey);
  if (statusFilter) {
    query = query.where("matchStatus", "==", statusFilter);
  }
  query = query.orderBy("updatedAt", "desc").orderBy("__name__", "desc");
  if (cursor) {
    query = query.startAfter(cursor.updatedAt, cursor.id);
  }
  query = query.limit(searchTokens.length ? Math.max(pageSize * 2, pageSize + 1) : pageSize + 1);

  let collected: any[] = [];
  let lastScanned: { updatedAt: string; id: string } | null = cursor;
  let hasMore = false;
  let exhausted = false;
  const search = safeLower(input?.search);

  if (!searchTokens.length) {
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await query.get();
    } catch (error) {
      if (isMissingIndexError(error)) {
        console.warn("[registry] listRegistryReviewQueue missing index", { input, message: (error as any)?.message });
        return listRegistryReviewQueueFallback({
          sourceKey,
          statusFilter,
          searchTokens,
          pageSize,
          cursor,
          summary,
        });
      }
      throw error;
    }
    const docs = snap.docs || [];
    const pageDocs = docs.slice(0, pageSize);
    const items = await Promise.all(
      pageDocs.map(async (doc: any) => {
        const match = await enrichRegistryMatchForQueue({
          match: { id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord,
          includeTopCandidate: true,
        });
        return buildRegistryReviewQueueItem(match);
      })
    );
    const hasMore = docs.length > pageSize;
    const nextCursor = hasMore
      ? encodeRegistryReviewCursor({
          updatedAt: String(pageDocs[pageDocs.length - 1]?.data()?.updatedAt || ""),
          id: String(pageDocs[pageDocs.length - 1]?.id || ""),
        })
      : null;
    return {
      items,
      pageInfo: {
        pageSize,
        nextCursor,
        hasMore,
      },
      summary,
    };
  }

  while (collected.length < pageSize && !exhausted) {
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await query.get();
    } catch (error) {
      if (isMissingIndexError(error)) {
        console.warn("[registry] listRegistryReviewQueue missing index", { input, message: (error as any)?.message });
        return listRegistryReviewQueueFallback({
          sourceKey,
          statusFilter,
          searchTokens,
          pageSize,
          cursor,
          summary,
        });
      }
      throw error;
    }

    const docs = snap.docs || [];
    if (!docs.length) {
      exhausted = true;
      break;
    }

    const chunk = await Promise.all(
      docs.map(async (doc: any) => {
        const match = await enrichRegistryMatchForQueue({
          match: { id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord,
          includeTopCandidate: true,
        });
        const matchesAllTokens = searchTokens.every((token) => (match.queueSearchTokens || []).includes(token));
        if (search && !matchesAllTokens) return null;
        return buildRegistryReviewQueueItem(match);
      })
    );

    collected = collected.concat(chunk.filter(Boolean));
    const lastDoc = docs[docs.length - 1];
    lastScanned = { updatedAt: String(lastDoc.data()?.updatedAt || ""), id: String(lastDoc.id || "") };
    if (docs.length < Math.max(pageSize * 2, pageSize + 1)) {
      exhausted = true;
    } else {
      query = db.collection("registryMatches").where("sourceKey", "==", sourceKey);
      if (statusFilter) query = query.where("matchStatus", "==", statusFilter);
      query = query.orderBy("updatedAt", "desc").orderBy("__name__", "desc");
      if (lastScanned) query = query.startAfter(lastScanned.updatedAt, lastScanned.id);
      query = query.limit(Math.max(pageSize * 2, pageSize + 1));
    }
  }

  if (!exhausted && lastScanned) {
    hasMore = true;
  }
  const items = collected.slice(0, pageSize);
  if (collected.length > pageSize) {
    hasMore = true;
  }
  const nextCursor = hasMore && lastScanned ? encodeRegistryReviewCursor(lastScanned) : null;

  return {
    items,
    pageInfo: {
      pageSize,
      nextCursor,
      hasMore,
    },
    summary,
  };
}

export async function getRegistryRecordDetail(normalizedRecordId: string) {
  const normalizedSnap = await db.collection("registryRecordsNormalized").doc(normalizedRecordId).get();
  if (!normalizedSnap.exists) return null;
  const normalizedRecord = { id: normalizedSnap.id, ...(normalizedSnap.data() || {}) } as RegistryRecordNormalized;
  const rawSnap = await db
    .collection("registryRecordsRaw")
    .where("sourceKey", "==", normalizedRecord.sourceKey)
    .where("registrationNumber", "==", normalizedRecord.registrationNumber || "__missing__")
    .limit(1)
    .get();
  const matchSnap = await db.collection("registryMatches").doc(makeStableId([normalizedRecord.sourceKey, normalizedRecord.registryRecordId])).get();
  const { adapter } = await ensureRegistrySource(normalizedRecord.sourceKey);
  const candidates = await findRegistryCandidatesForRecord({ adapter, record: normalizedRecord });
  const auditSnap = await db
    .collection("registryAuditLog")
    .where("registryRecordId", "==", normalizedRecord.registryRecordId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const candidateComparisons = await Promise.all(
    candidates.map(async (candidate) => {
      const propertySnap = await db.collection("properties").doc(candidate.propertyId).get();
      const property = propertySnap.exists ? { id: propertySnap.id, ...(propertySnap.data() || {}) } : null;
      return {
        ...candidate,
        comparison: property ? buildRegistryPropertyComparison({ adapter, property, record: normalizedRecord }) : null,
      };
    })
  );
  const currentProperty =
    matchSnap.exists && (matchSnap.data() as any)?.propertyId
      ? await db.collection("properties").doc(String((matchSnap.data() as any)?.propertyId)).get()
      : null;
  const currentLinkedProperty = currentProperty?.exists
    ? ({ id: currentProperty.id, ...(currentProperty.data() || {}) } as any)
    : null;
  const propertyConflict =
    currentLinkedProperty?.id
      ? await findActiveMatchForPropertySource({
          propertyId: currentLinkedProperty.id,
          sourceKey: normalizedRecord.sourceKey,
          excludeNormalizedRecordId: normalizedRecord.id,
        })
      : null;

  return {
    normalizedRecord,
    rawRecord: rawSnap.docs?.[0] ? { id: rawSnap.docs[0].id, ...(rawSnap.docs[0].data() || {}) } : null,
    match: matchSnap.exists ? ({ id: matchSnap.id, ...(matchSnap.data() || {}) } as RegistryMatchRecord) : null,
    candidates: candidateComparisons,
    operatorReview: {
      reasonSummary: summarizeRegistryReasons([
        ...(matchSnap.exists ? (((matchSnap.data() || {}) as any).mismatchReasons || []) : []),
        ...(normalizedRecord.internalDiagnostics?.unmatchedReasons || []),
      ]),
      pidState:
        currentProperty?.exists
          ? buildRegistryPropertyComparison({
              adapter,
              property: { id: currentProperty.id, ...(currentProperty.data() || {}) },
              record: normalizedRecord,
              match: matchSnap.exists ? ({ id: matchSnap.id, ...(matchSnap.data() || {}) } as RegistryMatchRecord) : null,
            })
          : null,
      registryPid: normalizedRecord.pid,
      registryAddressCandidates: normalizedRecord.addressCandidates || [],
    },
    currentLinkedProperty,
    propertyConflict,
    auditTrail: (auditSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
  };
}

export async function applyRegistryMatchOverride(input: {
  normalizedRecordId: string;
  action: "attach" | "ignore" | "return_to_review" | "detach";
  propertyId?: string | null;
  reason: string;
  actorId: string;
  replaceExistingMatch?: boolean;
}) {
  const detail = await getRegistryRecordDetail(input.normalizedRecordId);
  if (!detail) {
    throw new RegistryOverrideError("Registry record not found", {
      code: "registry_record_not_found",
      statusCode: 404,
    });
  }
  const { source } = await ensureRegistrySource(detail.normalizedRecord.sourceKey);
  const matchId = makeStableId([detail.normalizedRecord.sourceKey, detail.normalizedRecord.registryRecordId]);
  const current = detail.match;
  const now = nowIso();

  let nextMatch: RegistryMatchRecord;
  let replacedExistingMatch: RegistryMatchRecord | null = null;
  if (input.action === "attach") {
    const property = await resolvePropertyForRegistryOverride(String(input.propertyId || ""));
    const conflictingMatch = await findActiveMatchForPropertySource({
      propertyId: property.id,
      sourceKey: detail.normalizedRecord.sourceKey,
      excludeNormalizedRecordId: detail.normalizedRecord.id,
    });
    if (conflictingMatch && !input.replaceExistingMatch) {
      throw new RegistryOverrideError(
        "This property already has an active matched Halifax registry record. Confirm replacement before attaching this record.",
        {
          code: "existing_property_match_conflict" satisfies RegistryMatchOverrideErrorCode,
          statusCode: 409,
        }
      );
    }
    if (conflictingMatch && input.replaceExistingMatch) {
      replacedExistingMatch = await transitionExistingMatchToReview({
        existingMatch: conflictingMatch,
        actorId: input.actorId,
        reason: `Replaced during manual attach: ${input.reason}`,
        source,
      });
    }
    const resolvedLandlordId =
      String(property.landlordId || property.ownerId || property.owner || "").trim() || null;
    nextMatch = {
      id: matchId,
      sourceKey: detail.normalizedRecord.sourceKey,
      registryRecordId: detail.normalizedRecord.registryRecordId,
      normalizedRecordId: detail.normalizedRecord.id,
      propertyId: property.id,
      landlordId: resolvedLandlordId,
      matchMethod: "manual",
      matchScore: 1,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: input.actorId,
      reviewedAt: now,
      overrideReason: input.reason,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
  } else if (input.action === "detach") {
    nextMatch = {
      id: matchId,
      sourceKey: detail.normalizedRecord.sourceKey,
      registryRecordId: detail.normalizedRecord.registryRecordId,
      normalizedRecordId: detail.normalizedRecord.id,
      propertyId: null,
      landlordId: null,
      matchMethod: current?.matchMethod || null,
      matchScore: current?.matchScore || 0,
      matchStatus: "unmatched",
      mismatchReasons: Array.from(
        new Set([...(current?.mismatchReasons || []), "manual_confirmation_recommended"])
      ),
      reviewedBy: input.actorId,
      reviewedAt: now,
      overrideReason: input.reason,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
  } else if (input.action === "ignore") {
    nextMatch = {
      id: matchId,
      sourceKey: detail.normalizedRecord.sourceKey,
      registryRecordId: detail.normalizedRecord.registryRecordId,
      normalizedRecordId: detail.normalizedRecord.id,
      propertyId: null,
      landlordId: null,
      matchMethod: current?.matchMethod || null,
      matchScore: current?.matchScore || 0,
      matchStatus: "ignored",
      mismatchReasons: current?.mismatchReasons || [],
      reviewedBy: input.actorId,
      reviewedAt: now,
      overrideReason: input.reason,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
  } else {
    const reevaluated = await evaluateRegistryMatch({
      adapter: getAdapter(detail.normalizedRecord.sourceKey),
      record: detail.normalizedRecord,
    });
    nextMatch = {
      ...reevaluated,
      id: matchId,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      reviewedBy: input.actorId,
      reviewedAt: now,
      overrideReason: input.reason,
    };
  }

  nextMatch = await enrichRegistryMatchForQueue({
    match: nextMatch,
    normalizedRecord: detail.normalizedRecord,
    source,
    includeTopCandidate: true,
  });

  const previousPropertyId = String(current?.propertyId || "").trim() || null;
  await db.collection("registryMatches").doc(matchId).set(nextMatch, { merge: true });
  if (nextMatch.propertyId) {
    await refreshPropertyProjectionFromCurrentMatches({
      propertyId: nextMatch.propertyId,
      source,
      actorId: input.actorId,
    });
  }
  if (previousPropertyId && previousPropertyId !== nextMatch.propertyId) {
    await refreshPropertyProjectionFromCurrentMatches({
      propertyId: previousPropertyId,
      source,
      actorId: input.actorId,
    });
  }
  await recordRegistryAuditEvent({
    sourceKey: detail.normalizedRecord.sourceKey,
    registryRecordId: detail.normalizedRecord.registryRecordId,
    propertyId: nextMatch.propertyId,
    actorType: "admin",
    actorId: input.actorId,
    eventType:
      input.action === "detach"
        ? "match_detached"
        : input.action === "ignore"
        ? "match_ignored"
        : input.action === "return_to_review"
        ? "match_returned_to_review"
        : current?.matchStatus === "ignored"
        ? "match_reinstated"
        : "match_overridden",
    eventData: {
      action: input.action,
      reason: input.reason,
      propertyId: nextMatch.propertyId,
      previousPropertyId,
      replaceExistingMatch: Boolean(input.replaceExistingMatch),
      replacedExistingMatchId: replacedExistingMatch?.id || null,
      replacedExistingNormalizedRecordId: replacedExistingMatch?.normalizedRecordId || null,
    },
  });
  return nextMatch;
}

export async function applyRegistryPidToPropertyFromRecord(input: {
  normalizedRecordId: string;
  propertyId: string;
  reason: string;
  actorId: string;
  confirmOverwrite?: boolean;
}) {
  const detail = await getRegistryRecordDetail(input.normalizedRecordId);
  if (!detail) {
    throw new RegistryOverrideError("Registry record not found", {
      code: "registry_record_not_found",
      statusCode: 404,
    });
  }

  const property = await resolvePropertyForRegistryOverride(input.propertyId);
  const registryPid = normalizePid(detail.normalizedRecord?.pid);
  const previousPid = resolvePropertyPidLikeValue(property);
  const { source } = await ensureRegistrySource(detail.normalizedRecord.sourceKey);
  const adapter = getAdapter(detail.normalizedRecord.sourceKey);
  requireRegistryPidUpdateConfirmation({
    propertyPid: previousPid,
    registryPid,
    confirmOverwrite: input.confirmOverwrite,
  });

  if (!property?.id) {
    throw new RegistryOverrideError("A valid property context is required before updating PID.", {
      code: "missing_property_context" satisfies PropertyPidUpdateErrorCode,
      statusCode: 400,
    });
  }

  if (previousPid === registryPid) {
    const reevaluatedExistingBase = await evaluateRegistryMatch({
      adapter,
      record: detail.normalizedRecord,
    });
    const reevaluatedExisting = await enrichRegistryMatchForQueue({
      match: {
        ...reevaluatedExistingBase,
        createdAt: detail.match?.createdAt || nowIso(),
        updatedAt: nowIso(),
        reviewedBy: input.actorId,
        reviewedAt: nowIso(),
      },
      normalizedRecord: detail.normalizedRecord,
      source,
      includeTopCandidate: true,
    });
    await db.collection("registryMatches").doc(makeStableId([detail.normalizedRecord.sourceKey, detail.normalizedRecord.registryRecordId])).set(
      reevaluatedExisting,
      { merge: true }
    );
    await refreshPropertyProjectionFromCurrentMatches({
      propertyId: property.id,
      source,
      actorId: input.actorId,
    });
    return {
      propertyId: property.id,
      previousPid,
      newPid: registryPid,
      changed: false,
      reEvaluation: await reEvaluatePropertyRegistry(property.id, input.actorId),
    };
  }

  await db.collection("properties").doc(property.id).set(
    {
      pid: registryPid,
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  await recordRegistryAuditEvent({
    sourceKey: detail.normalizedRecord.sourceKey,
    registryRecordId: detail.normalizedRecord.registryRecordId,
    propertyId: property.id,
    actorType: "admin",
    actorId: input.actorId,
    eventType: "property_pid_updated_from_registry",
    eventData: {
      previousPid,
      newPid: registryPid,
      reason: input.reason,
      registrationNumber: detail.normalizedRecord.registrationNumber || null,
      propertyAddress: getPropertyDisplayAddress(property),
      registryAddress: detail.normalizedRecord.addressRaw || null,
      overwriteConfirmed: Boolean(input.confirmOverwrite),
    },
  });

  const refreshedMatchBase = await evaluateRegistryMatch({
    adapter,
    record: detail.normalizedRecord,
  });
  const refreshedMatch = await enrichRegistryMatchForQueue({
    match: {
      ...refreshedMatchBase,
      createdAt: detail.match?.createdAt || nowIso(),
      updatedAt: nowIso(),
      reviewedBy: input.actorId,
      reviewedAt: nowIso(),
    },
    normalizedRecord: detail.normalizedRecord,
    source,
    includeTopCandidate: true,
  });
  await db.collection("registryMatches").doc(makeStableId([detail.normalizedRecord.sourceKey, detail.normalizedRecord.registryRecordId])).set(
    refreshedMatch,
    { merge: true }
  );
  await refreshPropertyProjectionFromCurrentMatches({
    propertyId: property.id,
    source,
    actorId: input.actorId,
  });

  const reEvaluation = await reEvaluatePropertyRegistry(property.id, input.actorId);
  return {
    propertyId: property.id,
    previousPid,
    newPid: registryPid,
    changed: true,
    reEvaluation,
  };
}

export function isRegistryOverrideError(error: unknown): error is RegistryOverrideError {
  return error instanceof RegistryOverrideError;
}

export async function getPropertyRegistryReview(propertyId: string, input?: { normalizedRecordId?: string | null }) {
  const propertySnap = await db.collection("properties").doc(propertyId).get();
  if (!propertySnap.exists) return null;
  const property = { id: propertySnap.id, ...(propertySnap.data() || {}) } as any;
  const { source } = await ensureRegistrySource("halifax_r400");
  const projection = await getPropertyRegistryProjection({ propertyId, source });
  const adapter = getAdapter(source.sourceKey);
  const matchesSnap = await db.collection("registryMatches").where("propertyId", "==", propertyId).get();
  const matches = (matchesSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) as RegistryMatchRecord[];
  const matchDetails = await Promise.all(
    matches.map(async (match) => {
      const normalizedSnap = match.normalizedRecordId
        ? await db.collection("registryRecordsNormalized").doc(match.normalizedRecordId).get()
        : null;
      const normalizedRecord =
        normalizedSnap?.exists ? ({ id: normalizedSnap.id, ...(normalizedSnap.data() || {}) } as RegistryRecordNormalized) : null;
      return {
        ...match,
        normalizedRecord,
        comparison: buildRegistryPropertyComparison({ adapter, property, record: normalizedRecord, match }),
        reasonSummary: summarizeRegistryReasons([
          ...(match.mismatchReasons || []),
          ...(normalizedRecord?.internalDiagnostics?.unmatchedReasons || []),
        ]),
      };
    })
  );

  const selectedRecordId = String(input?.normalizedRecordId || "").trim() || null;
  let selectedRecord: RegistryRecordNormalized | null = null;
  let selectedComparison: ReturnType<typeof buildRegistryPropertyComparison> | null = null;
  let selectedMatch: RegistryMatchRecord | null = null;
  if (selectedRecordId) {
    const selectedSnap = await db.collection("registryRecordsNormalized").doc(selectedRecordId).get();
    if (selectedSnap.exists) {
      selectedRecord = { id: selectedSnap.id, ...(selectedSnap.data() || {}) } as RegistryRecordNormalized;
      selectedMatch =
        matchDetails.find((match) => match.normalizedRecordId === selectedRecordId) ||
        null;
      selectedComparison = buildRegistryPropertyComparison({
        adapter,
        property,
        record: selectedRecord,
        match: selectedMatch,
      });
    }
  }

  const conflictingMatch = await findActiveMatchForPropertySource({
    propertyId,
    sourceKey: source.sourceKey,
    excludeNormalizedRecordId: selectedRecord?.id || null,
  });

  return {
    property,
    projection,
    propertyPid: resolvePropertyPidLikeValue(property),
    matches,
    matchDetails,
    selectedRecord,
    selectedMatch,
    selectedComparison,
    conflictingMatch,
  };
}

export async function reEvaluatePropertyRegistry(propertyId: string, actorId: string) {
  const { adapter, source } = await ensureRegistrySource("halifax_r400");
  const matches = await reEvaluatePropertyAgainstRegistry({ adapter, propertyId, sourceKey: source.sourceKey });
  const best = matches[0] || null;
  let record: RegistryRecordNormalized | null = null;
  if (best?.normalizedRecordId) {
    const snap = await db.collection("registryRecordsNormalized").doc(best.normalizedRecordId).get();
    if (snap.exists) record = { id: snap.id, ...(snap.data() || {}) } as RegistryRecordNormalized;
  }
  const projection = await upsertPropertyRegistryProjection({ propertyId, source, match: best, record });
  await recordRegistryAuditEvent({
    sourceKey: source.sourceKey,
    propertyId,
    registryRecordId: record?.registryRecordId || null,
    actorType: "admin",
    actorId,
    eventType: "projection_updated",
    eventData: { triggeredBy: "re_evaluate", registryStatus: projection.registryStatus },
  });
  return { matches, projection };
}

export async function searchRegistryAttachProperties(queryInput: string) {
  const q = String(queryInput || "").trim();
  if (!q) return [];
  const result = await listAdminProperties({
    q,
    province: "NS",
    page: 1,
    pageSize: 8,
  });
  return result.items.map((item) => ({
    id: item.id,
    name: item.name,
    addressLine1: item.address1,
    city: item.city,
    province: item.province,
    postalCode: item.postalCode,
    landlordId: item.landlordId,
    ownerUserId: item.ownerUserId,
    pid: (item as any).pid || null,
    unitCount: item.unitCount ?? null,
  }));
}
