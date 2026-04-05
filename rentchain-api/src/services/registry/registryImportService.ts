import { db } from "../../config/firebase";
import { commitInBatches } from "../../imports/firestoreBatch";
import { recordRegistryAuditEvent } from "./registryAuditService";
import { uploadBufferToGcs } from "../../lib/gcs";
import { getFileMetadata, getFileReadStream } from "../../lib/gcsRead";
import type {
  RegistryImportRecord,
  RegistryImportProgress,
  RegistryImportProgressStage,
  RegistryImportTimingsMs,
  RegistryMatchRecord,
  RegistryPropertyCandidate,
  RegistryRecordNormalized,
  RegistrySourceKey,
  RegistrySourceRecord,
} from "./registryTypes";
import { compactObject, makeStableId, normalizePid, nowIso } from "./registryUtils";
import { HalifaxR400Adapter } from "./adapters/HalifaxR400Adapter";
import type { RegistrySourceAdapter } from "./adapters/RegistrySourceAdapter";
import { evaluateRegistryMatch, findRegistryCandidatesForRecord, reEvaluatePropertyAgainstRegistry } from "./registryMatchingService";
import {
  canRegistryMatchDriveProjection,
  compareRegistryProjectionMatches,
  getPropertyRegistryProjection,
  selectRegistryProjectionWinner,
  upsertPropertyRegistryProjection,
} from "./registryStatusProjectionService";
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

type RegistryQueueSummary = NonNullable<RegistryMatchRecord["queueSummary"]>;

const activeRegistryImportJobs = new Map<string, Promise<void>>();
const REGISTRY_IMPORT_STALE_MS = 2 * 60 * 1000;
const REGISTRY_IMPORT_MATCH_PROGRESS_BATCH = 50;
const REGISTRY_IMPORT_FILE_LOAD_MAX_ATTEMPTS = 3;
const REGISTRY_IMPORT_FILE_LOAD_IDLE_TIMEOUT_MS = 90 * 1000;
const REGISTRY_IMPORT_FILE_LOAD_RETRY_DELAY_MS = 100;
const REGISTRY_IMPORT_PROGRESS_ROW_INTERVAL = 200;
const REGISTRY_IMPORT_PROGRESS_TIME_INTERVAL_MS = 5_000;

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

function tokenizeSearchValue(value: unknown, options?: { includeCompact?: boolean }) {
  const normalized = safeLower(value);
  if (!normalized) return [] as string[];
  const compact = normalized.replace(/\s+/g, " ").trim();
  const alnumCompact = compact.replace(/[^a-z0-9_-]+/g, "");
  const tokens = compact
    .split(/[^a-z0-9_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  if (options?.includeCompact === false) {
    return Array.from(new Set(tokens.filter(Boolean)));
  }
  return Array.from(new Set([compact, alnumCompact, ...tokens].filter(Boolean)));
}

function createRegistryReviewQueueSummaryShape(input?: Partial<RegistryQueueSummary> | RegistryQueueSummary | null): RegistryQueueSummary {
  return {
    displayAddress: input?.displayAddress || null,
    registrationNumber: input?.registrationNumber || null,
    registryPid: input?.registryPid || null,
    property: input?.property || null,
    topCandidate: input?.topCandidate || null,
    reasonSummary: Array.isArray(input?.reasonSummary) ? input?.reasonSummary.filter(Boolean) : [],
  };
}

function buildQueueSearchTokensFromSummary(summary?: Partial<RegistryQueueSummary> | RegistryQueueSummary | null) {
  const normalized = createRegistryReviewQueueSummaryShape(summary);
  return Array.from(
    new Set([
      ...tokenizeSearchValue(normalized.displayAddress),
      ...tokenizeSearchValue(normalized.registrationNumber),
      ...tokenizeSearchValue(normalized.registryPid),
      ...tokenizeSearchValue(normalized.property?.name),
      ...tokenizeSearchValue(normalized.property?.addressLine1),
      ...tokenizeSearchValue(normalized.property?.pid),
      ...tokenizeSearchValue(normalized.topCandidate?.propertyName),
      ...tokenizeSearchValue(normalized.topCandidate?.addressLine1),
      ...tokenizeSearchValue(normalized.topCandidate?.pid),
    ])
  );
}

function hasCompleteQueueSummaryForList(match: RegistryMatchRecord, includeTopCandidate: boolean) {
  const summary = match.queueSummary;
  if (!summary) return false;
  const hasReasonSummary = Array.isArray(summary.reasonSummary);
  const hasSearchTokens = Array.isArray(match.queueSearchTokens) && match.queueSearchTokens.length > 0;
  const hasPrimaryContext = Boolean(summary.displayAddress || summary.registrationNumber || summary.registryPid || summary.property);
  if (!hasReasonSummary || !hasPrimaryContext) return false;
  if (!includeTopCandidate || match.propertyId) return true;
  return Boolean(summary.topCandidate) && hasSearchTokens;
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
    const raw = doc.data() || {};
    const match = await enrichRegistryMatchForQueue({
      match: { id: doc.id, ...raw } as RegistryMatchRecord,
      includeTopCandidate: !raw.propertyId,
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

async function getRegistryReviewQueueCount(query: FirebaseFirestore.Query) {
  const countFn = (query as any)?.count;
  if (typeof countFn !== "function") return null;
  try {
    const snapshot = await countFn.call(query).get();
    const data = typeof snapshot?.data === "function" ? snapshot.data() : snapshot;
    const parsed = Number(data?.count ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return null;
  }
}

async function getRegistryReviewQueueSummary(sourceKey: RegistrySourceKey) {
  const summary = {
    all: 0,
    possible_match: 0,
    mismatch: 0,
    unmatched: 0,
    matched: 0,
    ignored: 0,
  } as Record<"all" | RegistryMatchRecord["matchStatus"], number>;
  const baseQuery = db.collection("registryMatches").where("sourceKey", "==", sourceKey);
  const statuses: RegistryMatchRecord["matchStatus"][] = ["possible_match", "mismatch", "unmatched", "matched", "ignored"];
  const allCount = await getRegistryReviewQueueCount(baseQuery);
  if (allCount !== null) {
    summary.all = allCount;
    const statusCounts = await Promise.all(
      statuses.map(async (status) => ({
        status,
        count: await getRegistryReviewQueueCount(baseQuery.where("matchStatus", "==", status)),
      }))
    );
    const hasAllStatusCounts = statusCounts.every((entry) => entry.count !== null);
    if (hasAllStatusCounts) {
      for (const entry of statusCounts) {
        summary[entry.status] = Number(entry.count || 0);
      }
      return summary;
    }
  }

  const summarySnap = await baseQuery.get();
  for (const doc of summarySnap.docs || []) {
    const status = String((doc.data() || {}).matchStatus || "").trim() as RegistryMatchRecord["matchStatus"];
    summary.all += 1;
    if (status && status in summary) summary[status] += 1;
  }
  return summary;
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

  const queueSummary = createRegistryReviewQueueSummaryShape({
    displayAddress: params.normalizedRecord?.addressRaw || null,
    registrationNumber: params.normalizedRecord?.registrationNumber || null,
    registryPid: params.normalizedRecord?.pid || null,
    property: propertySummary,
    topCandidate,
    reasonSummary,
  });

  const queueSearchTokens = buildQueueSearchTokensFromSummary(queueSummary);

  return { queueSummary, queueSearchTokens };
}

async function enrichRegistryMatchForQueue(params: {
  match: RegistryMatchRecord;
  normalizedRecord?: RegistryRecordNormalized | null;
  source?: RegistrySourceRecord | null;
  includeTopCandidate?: boolean;
}): Promise<RegistryMatchRecord> {
  const includeTopCandidate = params.includeTopCandidate !== false;
  if (params.match.queueSummary && (!Array.isArray(params.match.queueSearchTokens) || !params.match.queueSearchTokens.length)) {
    const queueSearchTokens = buildQueueSearchTokensFromSummary(params.match.queueSummary);
    await db.collection("registryMatches").doc(params.match.id).set({ queueSearchTokens }, { merge: true });
    return {
      ...params.match,
      queueSummary: createRegistryReviewQueueSummaryShape(params.match.queueSummary),
      queueSearchTokens,
    };
  }
  if (hasCompleteQueueSummaryForList(params.match, includeTopCandidate)) {
    return {
      ...params.match,
      queueSummary: createRegistryReviewQueueSummaryShape(params.match.queueSummary),
      queueSearchTokens: params.match.queueSearchTokens || [],
    };
  }
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
      queueSummary: params.match.queueSummary ? createRegistryReviewQueueSummaryShape(params.match.queueSummary) : undefined,
      queueSearchTokens: params.match.queueSearchTokens || [],
    };
  }
  const queue = await buildRegistryReviewQueueSummary({
    adapter,
    match: params.match,
    normalizedRecord: normalizedResolved,
    property,
    includeTopCandidate,
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
      if (!canRegistryMatchDriveProjection(match)) return false;
      if (params.excludeNormalizedRecordId && match.normalizedRecordId === params.excludeNormalizedRecordId) return false;
      return true;
    })
    .sort(compareRegistryProjectionMatches);

  return matches[0] || null;
}

async function transitionExistingMatchToReview(params: {
  existingMatch: RegistryMatchRecord;
  actorId: string;
  reason: string;
  source: RegistrySourceRecord;
  eventType?: "match_returned_to_review" | "candidate_returned_to_review_due_to_stronger_match";
  eventData?: Record<string, unknown>;
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
    eventType: params.eventType || "match_returned_to_review",
    eventData: {
      reason: params.reason,
      replacementMatchStatus: replacement.matchStatus,
      replacedByNormalizedRecordId: params.existingMatch.normalizedRecordId,
      ...(params.eventData || {}),
    },
  });
  return replacement;
}

async function listPropertySourceMatches(params: { propertyId: string; sourceKey: RegistrySourceKey }) {
  const snap = await db
    .collection("registryMatches")
    .where("propertyId", "==", params.propertyId)
    .where("sourceKey", "==", params.sourceKey)
    .get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord));
}

async function cleanupWeakerProjectionCandidates(params: {
  winningMatch: RegistryMatchRecord;
  source: RegistrySourceRecord;
  actorId: string;
  reason: string;
}) {
  if (!params.winningMatch.propertyId || params.winningMatch.matchStatus !== "matched") {
    return [] as RegistryMatchRecord[];
  }

  const attachedMatches = await listPropertySourceMatches({
    propertyId: params.winningMatch.propertyId,
    sourceKey: params.source.sourceKey,
  });
  const projectionWinner = selectRegistryProjectionWinner(attachedMatches);
  if (!projectionWinner || projectionWinner.id !== params.winningMatch.id) {
    return [] as RegistryMatchRecord[];
  }

  const demoted: RegistryMatchRecord[] = [];
  for (const sibling of attachedMatches) {
    if (sibling.id === params.winningMatch.id) continue;
    if (!canRegistryMatchDriveProjection(sibling)) continue;
    const siblingWouldWin = selectRegistryProjectionWinner([params.winningMatch, sibling]);
    if (siblingWouldWin?.id === sibling.id) continue;

    const replacement = await transitionExistingMatchToReview({
      existingMatch: sibling,
      actorId: params.actorId,
      reason: params.reason,
      source: params.source,
      eventType: "candidate_returned_to_review_due_to_stronger_match",
      eventData: {
        activeProjectionNormalizedRecordId: params.winningMatch.normalizedRecordId,
        activeProjectionRegistryRecordId: params.winningMatch.registryRecordId,
      },
    });
    demoted.push(replacement);
  }

  return demoted;
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

async function patchImportRecord(importId: string, patch: Partial<RegistryImportRecord>) {
  await db.collection("registryImports").doc(importId).set(patch, { merge: true });
}

function createImportProgress(
  stage: RegistryImportProgressStage,
  rowsProcessed = 0,
  rowCount = 0,
  percent?: number
): RegistryImportProgress {
  const safeRowsProcessed = Math.max(0, Math.floor(rowsProcessed));
  const safeRowCount = Math.max(0, Math.floor(rowCount));
  const computedPercent =
    typeof percent === "number"
      ? percent
      : safeRowCount > 0
        ? Math.min(100, Math.round((safeRowsProcessed / safeRowCount) * 100))
        : stage === "completed"
          ? 100
          : 0;
  return {
    stage,
    rowsProcessed: safeRowsProcessed,
    rowCount: safeRowCount,
    percent: Math.max(0, Math.min(100, Math.floor(computedPercent))),
  };
}

function normalizeImportRecord(record: RegistryImportRecord): RegistryImportRecord {
  return {
    ...record,
    sourceFileStorageBucket: record.sourceFileStorageBucket || null,
    processingMode: record.processingMode || (record.status === "queued" ? "async" : "sync"),
    progress: record.progress || null,
    timingsMs: record.timingsMs || null,
    lastHeartbeatAt: record.lastHeartbeatAt || null,
    failureStage: record.failureStage || null,
    retryCount: typeof record.retryCount === "number" ? record.retryCount : 0,
    startedAt: record.startedAt || null,
  };
}

function mergeImportRecordState(importRecord: RegistryImportRecord, patch?: Partial<RegistryImportRecord> | null) {
  return normalizeImportRecord({
    ...importRecord,
    ...(patch || {}),
    diagnostics: {
      ...(importRecord.diagnostics || {}),
      ...((patch?.diagnostics as RegistryImportRecord["diagnostics"] | undefined) || {}),
    },
    timingsMs: {
      ...(importRecord.timingsMs || {}),
      ...((patch?.timingsMs as RegistryImportTimingsMs | undefined) || {}),
    },
  });
}

function createImportTimings(input?: RegistryImportTimingsMs | null): RegistryImportTimingsMs {
  return compactObject({
    fileLoad: input?.fileLoad ?? null,
    parse: input?.parse ?? null,
    rawWrite: input?.rawWrite ?? null,
    normalize: input?.normalize ?? null,
    matching: input?.matching ?? null,
    projection: input?.projection ?? null,
    total: input?.total ?? null,
  });
}

function createStageTimer() {
  const startedAtByStage = new Map<string, number>();
  const timings: RegistryImportTimingsMs = {};
  return {
    start(stage: keyof RegistryImportTimingsMs) {
      startedAtByStage.set(stage, Date.now());
    },
    end(stage: keyof RegistryImportTimingsMs) {
      const startedAt = startedAtByStage.get(stage);
      if (typeof startedAt === "number") {
        timings[stage] = Date.now() - startedAt;
        startedAtByStage.delete(stage);
      }
      return timings[stage] ?? null;
    },
    snapshot() {
      return createImportTimings(timings);
    },
    set(stage: keyof RegistryImportTimingsMs, value: number | null | undefined) {
      if (typeof value === "number" && Number.isFinite(value)) timings[stage] = value;
    },
  };
}

function shouldWriteImportProgress(params: {
  rowsProcessed: number;
  rowCount: number;
  lastRowsProcessed: number;
  lastWrittenAt: number;
  force?: boolean;
}) {
  if (params.force) return true;
  if (params.rowsProcessed >= params.rowCount) return true;
  if (params.rowsProcessed - params.lastRowsProcessed >= REGISTRY_IMPORT_PROGRESS_ROW_INTERVAL) return true;
  return Date.now() - params.lastWrittenAt >= REGISTRY_IMPORT_PROGRESS_TIME_INTERVAL_MS;
}

function buildRegistryAuditLogDoc(input: Parameters<typeof recordRegistryAuditEvent>[0]) {
  return {
    sourceKey: input.sourceKey,
    importBatchId: input.importBatchId || null,
    registryRecordId: input.registryRecordId || null,
    propertyId: input.propertyId || null,
    actorType: input.actorType,
    actorId: input.actorId || null,
    eventType: input.eventType,
    eventData: compactObject(input.eventData || {}),
    createdAt: nowIso(),
  };
}

async function getRegistryImportRecord(importId: string) {
  const snap = await db.collection("registryImports").doc(importId).get();
  if (!snap.exists) return null;
  return normalizeImportRecord({ id: snap.id, ...(snap.data() || {}) } as RegistryImportRecord);
}

function isRegistryImportTerminal(status: RegistryImportRecord["status"] | null | undefined) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isImportHeartbeatStale(lastHeartbeatAt: string | null | undefined) {
  if (!lastHeartbeatAt) return true;
  const ts = Date.parse(lastHeartbeatAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts >= REGISTRY_IMPORT_STALE_MS;
}

function isRetryableFileLoadError(error: unknown) {
  const message = String((error as any)?.message || "").toLowerCase();
  const code = String((error as any)?.code || "").toLowerCase();
  return [
    "deadline_exceeded",
    "timed out",
    "timeout",
    "econnreset",
    "etimedout",
    "socket hang up",
    "unavailable",
    "resource exhausted",
    "internal",
  ].some((token) => message.includes(token) || code.includes(token));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStreamToString(
  stream: NodeJS.ReadableStream,
  options?: { idleTimeoutMs?: number; onProgress?: (loadedBytes: number) => void }
) {
  const idleTimeoutMs = Math.max(10_000, Number(options?.idleTimeoutMs || REGISTRY_IMPORT_FILE_LOAD_IDLE_TIMEOUT_MS));
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let loadedBytes = 0;
    let settled = false;
    let idleTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      stream.removeListener("error", onError);
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const timeoutError = new Error(`Registry import file load stalled after ${idleTimeoutMs}ms`);
        (timeoutError as any).code = "FILE_LOAD_IDLE_TIMEOUT";
        if (typeof (stream as any).destroy === "function") {
          (stream as any).destroy(timeoutError);
        } else {
          onError(timeoutError);
        }
      }, idleTimeoutMs);
    };

    const onData = (chunk: any) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      loadedBytes += buffer.length;
      options?.onProgress?.(loadedBytes);
      resetIdleTimer();
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks).toString("utf8"));
    };

    const onError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    resetIdleTimer();
    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
  });
}

async function loadRegistryImportCsv(importRecord: RegistryImportRecord) {
  let currentImportRecord = normalizeImportRecord(importRecord);
  const bucket = importRecord.sourceFileStorageBucket || String(process.env.GCS_UPLOAD_BUCKET || "").trim() || null;
  const path = String(importRecord.sourceFileStoragePath || "").trim() || null;
  if (!bucket || !path) {
    throw new Error("Registry import source file is unavailable for background processing");
  }
  let expectedBytes: number | null = null;
  try {
    const meta = await getFileMetadata({ bucket, path });
    const size = Number((meta as any)?.size);
    expectedBytes = Number.isFinite(size) ? size : null;
  } catch (error) {
    console.warn("[registry] import file metadata unavailable", {
      importId: importRecord.id,
      bucket,
      path,
      message: (error as any)?.message || String(error),
    });
  }

  let lastLoadedBytes = 0;
  for (let attempt = 1; attempt <= REGISTRY_IMPORT_FILE_LOAD_MAX_ATTEMPTS; attempt += 1) {
    const retryCount = Math.max(0, attempt - 1);
    const startedAt = currentImportRecord.startedAt || nowIso();
    currentImportRecord = mergeImportRecordState(currentImportRecord, {
      status: "processing",
      progress: createImportProgress("file_load", 0, 0, 3 + retryCount),
      lastHeartbeatAt: nowIso(),
      failureStage: null,
      retryCount,
      errorSummary: null,
      startedAt,
    });
    await patchImportRecord(importRecord.id, {
      status: currentImportRecord.status,
      progress: currentImportRecord.progress,
      lastHeartbeatAt: currentImportRecord.lastHeartbeatAt,
      failureStage: currentImportRecord.failureStage,
      retryCount: currentImportRecord.retryCount,
      errorSummary: currentImportRecord.errorSummary,
      startedAt: currentImportRecord.startedAt,
    });
    console.info("[registry] import file load start", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      bucket,
      path,
      attempt,
      maxAttempts: REGISTRY_IMPORT_FILE_LOAD_MAX_ATTEMPTS,
      expectedBytes,
    });

    try {
      const fileLoadStartedAt = Date.now();
      lastLoadedBytes = 0;
      const csvText = await readStreamToString(getFileReadStream({ bucket, path, validation: false }), {
        idleTimeoutMs: REGISTRY_IMPORT_FILE_LOAD_IDLE_TIMEOUT_MS,
        onProgress: (loadedBytes) => {
          lastLoadedBytes = loadedBytes;
        },
      });
      const durationMs = Date.now() - fileLoadStartedAt;
      const nextRecord = mergeImportRecordState(currentImportRecord, {
        progress: createImportProgress("file_load", 0, 0, 10),
        lastHeartbeatAt: nowIso(),
        retryCount,
        timingsMs: createImportTimings({
          ...(currentImportRecord.timingsMs || {}),
          fileLoad: durationMs,
        }),
      });
      await patchImportRecord(importRecord.id, {
        progress: nextRecord.progress,
        lastHeartbeatAt: nextRecord.lastHeartbeatAt,
        retryCount: nextRecord.retryCount,
        startedAt: nextRecord.startedAt,
        timingsMs: nextRecord.timingsMs || null,
      });
      currentImportRecord = nextRecord;
      console.info("[registry] import file load success", {
        importId: importRecord.id,
        sourceKey: importRecord.sourceKey,
        bucket,
        path,
        attempt,
        bytesLoaded: Buffer.byteLength(csvText, "utf8"),
        expectedBytes,
        durationMs,
      });
      return { csvText, importRecord: nextRecord, durationMs };
    } catch (error) {
      const retryable = isRetryableFileLoadError(error);
      console.error("[registry] import file load failure", {
        importId: importRecord.id,
        sourceKey: importRecord.sourceKey,
        bucket,
        path,
        attempt,
        maxAttempts: REGISTRY_IMPORT_FILE_LOAD_MAX_ATTEMPTS,
        bytesLoaded: lastLoadedBytes,
        expectedBytes,
        retryable,
        message: (error as any)?.message || String(error),
      });
      if (retryable && attempt < REGISTRY_IMPORT_FILE_LOAD_MAX_ATTEMPTS) {
        await patchImportRecord(importRecord.id, {
          retryCount,
          lastHeartbeatAt: nowIso(),
          startedAt,
        });
        currentImportRecord = mergeImportRecordState(currentImportRecord, {
          retryCount,
          lastHeartbeatAt: nowIso(),
          startedAt,
        });
        console.warn("[registry] import file load retry scheduled", {
          importId: importRecord.id,
          attempt,
          nextAttempt: attempt + 1,
        });
        await wait(REGISTRY_IMPORT_FILE_LOAD_RETRY_DELAY_MS * attempt);
        continue;
      }
      (error as any).fileLoadRetryCount = retryCount;
      throw error;
    }
  }

  throw new Error("Registry import file load failed");
}

async function persistRegistryImportCsv(params: {
  importId: string;
  sourceKey: RegistrySourceKey;
  csvText: string;
  sourceFileName?: string | null;
  actorId?: string | null;
}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = String(params.sourceFileName || "registry-import.csv")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "registry-import.csv";
  const path = `registry-imports/${params.sourceKey}/${timestamp}__${params.importId}__${safeName}`;
  return uploadBufferToGcs({
    path,
    contentType: "text/csv; charset=utf-8",
    buffer: Buffer.from(params.csvText, "utf8"),
    metadata: {
      importId: params.importId,
      sourceKey: params.sourceKey,
      actorId: params.actorId || "",
      originalName: params.sourceFileName || "",
    },
  });
}

async function updateRegistryImportProgress(
  importRecord: RegistryImportRecord,
  progress: RegistryImportProgress,
  patch?: Partial<RegistryImportRecord>
) {
  const nextRecord = mergeImportRecordState(importRecord, {
    progress,
    status: progress.stage === "queued" ? "queued" : progress.stage === "completed" ? "completed" : "processing",
    lastHeartbeatAt: nowIso(),
    failureStage: progress.stage === "failed" ? progress.stage : null,
    ...patch,
  });
  await patchImportRecord(importRecord.id, {
    progress: nextRecord.progress,
    status: nextRecord.status,
    lastHeartbeatAt: nextRecord.lastHeartbeatAt,
    failureStage: nextRecord.failureStage,
    startedAt: nextRecord.startedAt,
    completedAt: nextRecord.completedAt,
    retryCount: nextRecord.retryCount,
    rowCount: nextRecord.rowCount,
    parsedRowCount: nextRecord.parsedRowCount,
    normalizedRowCount: nextRecord.normalizedRowCount,
    matchedRowCount: nextRecord.matchedRowCount,
    unmatchedRowCount: nextRecord.unmatchedRowCount,
    mismatchRowCount: nextRecord.mismatchRowCount,
    ignoredRowCount: nextRecord.ignoredRowCount,
    skippedRowCount: nextRecord.skippedRowCount,
    errorSummary: nextRecord.errorSummary,
    timingsMs: nextRecord.timingsMs || null,
  });
  return nextRecord;
}

async function processRegistryImportCore(params: {
  importRecord: RegistryImportRecord;
  csvText: string;
  source: RegistrySourceRecord;
  adapter: RegistrySourceAdapter;
  actorId?: string | null;
}) {
  let importRecord = normalizeImportRecord(params.importRecord);
  let currentStage: RegistryImportProgressStage = "parse";
  const stageTimer = createStageTimer();
  console.info("[registry] import processing started", {
    importId: importRecord.id,
    sourceKey: importRecord.sourceKey,
    processingMode: importRecord.processingMode || "sync",
  });

  stageTimer.start("parse");
  console.info("[registry] import stage start", {
    importId: importRecord.id,
    sourceKey: importRecord.sourceKey,
    stage: "parse",
  });
  importRecord = await updateRegistryImportProgress(
    importRecord,
    createImportProgress("parse", 0, 0, 5),
    {
      status: "processing",
      startedAt: importRecord.startedAt || nowIso(),
      completedAt: null,
      errorSummary: null,
      failureStage: null,
      timingsMs: createImportTimings(importRecord.timingsMs),
    }
  );

  try {
    const parsedRows = params.adapter.parse(params.csvText);
    const parseMs = stageTimer.end("parse");
    console.info("[registry] import stage end", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "parse",
      durationMs: parseMs,
      rowCount: parsedRows.length,
    });

    stageTimer.start("rawWrite");
    console.info("[registry] import stage start", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "raw_write",
      rowCount: parsedRows.length,
    });
    importRecord = await updateRegistryImportProgress(
      importRecord,
      createImportProgress("raw_write", parsedRows.length, parsedRows.length, 15),
      {
        rowCount: parsedRows.length,
        parsedRowCount: parsedRows.length,
        timingsMs: createImportTimings({
          ...(importRecord.timingsMs || {}),
          parse: parseMs,
        }),
      }
    );

    const importedAt = nowIso();
    const context = { importRecord, source: params.source, importedAt };
    const rawRows = parsedRows.map((row, index) => params.adapter.mapRawRow(row, index, context));

    await commitInBatches(
      rawRows.map((row) => (batch) => {
        batch.set(db.collection("registryRecordsRaw").doc(row.id), row, { merge: true });
      })
    );
    const rawWriteMs = stageTimer.end("rawWrite");
    console.info("[registry] import stage end", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "raw_write",
      durationMs: rawWriteMs,
      rowCount: rawRows.length,
    });

    currentStage = "normalize";
    stageTimer.start("normalize");
    console.info("[registry] import stage start", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "normalize",
      rowCount: rawRows.length,
    });
    const normalizedRows = rawRows.map((row) => params.adapter.normalizeRawRow(row, context));
    importRecord = await updateRegistryImportProgress(
      importRecord,
      createImportProgress("normalize", normalizedRows.length, parsedRows.length, 30),
      {
        normalizedRowCount: normalizedRows.length,
        timingsMs: createImportTimings({
          ...(importRecord.timingsMs || {}),
          parse: parseMs,
          rawWrite: rawWriteMs,
        }),
      }
    );

    await commitInBatches(
      normalizedRows.map((row) => (batch) => {
        batch.set(db.collection("registryRecordsNormalized").doc(row.id), row, { merge: true });
      })
    );
    const normalizeMs = stageTimer.end("normalize");
    console.info("[registry] import stage end", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "normalize",
      durationMs: normalizeMs,
      rowCount: normalizedRows.length,
    });

    currentStage = "matching";
    stageTimer.start("matching");
    console.info("[registry] import stage start", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "matching",
      rowCount: normalizedRows.length,
    });
    importRecord = await updateRegistryImportProgress(importRecord, createImportProgress("matching", 0, normalizedRows.length, 45), {
      timingsMs: createImportTimings({
        ...(importRecord.timingsMs || {}),
        parse: parseMs,
        rawWrite: rawWriteMs,
        normalize: normalizeMs,
      }),
    });

    const matches: RegistryMatchRecord[] = [];
    let matchedRowCount = 0;
    let unmatchedRowCount = 0;
    let mismatchRowCount = 0;
    let lastMatchingProgressRows = 0;
    let lastMatchingProgressAt = Date.now();
    let bufferedMatchOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

    const flushMatchingWrites = async () => {
      if (!bufferedMatchOps.length) return;
      const pendingOps = bufferedMatchOps;
      bufferedMatchOps = [];
      await commitInBatches(pendingOps);
    };

    for (const [index, row] of normalizedRows.entries()) {
      const evaluatedBase = await evaluateRegistryMatch({ adapter: params.adapter, record: row });
      const evaluated = await enrichRegistryMatchForQueue({
        match: evaluatedBase,
        normalizedRecord: row,
        source: params.source,
        includeTopCandidate: true,
      });
      matches.push(evaluated);
      bufferedMatchOps.push((batch) => {
        batch.set(db.collection("registryMatches").doc(evaluated.id), evaluated, { merge: true });
      });

      if (evaluated.matchStatus === "matched") matchedRowCount += 1;
      if (evaluated.matchStatus === "unmatched") unmatchedRowCount += 1;
      if (evaluated.matchStatus === "mismatch") mismatchRowCount += 1;

      const auditDoc = buildRegistryAuditLogDoc({
        sourceKey: importRecord.sourceKey,
        importBatchId: importRecord.importBatchId,
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
      bufferedMatchOps.push((batch) => {
        batch.set(db.collection("registryAuditLog").doc(), auditDoc);
      });

      const rowsProcessed = index + 1;
      if (bufferedMatchOps.length >= REGISTRY_IMPORT_MATCH_PROGRESS_BATCH * 2) {
        await flushMatchingWrites();
      }
      if (
        shouldWriteImportProgress({
          rowsProcessed,
          rowCount: normalizedRows.length,
          lastRowsProcessed: lastMatchingProgressRows,
          lastWrittenAt: lastMatchingProgressAt,
          force: rowsProcessed === normalizedRows.length,
        })
      ) {
        await flushMatchingWrites();
        importRecord = await updateRegistryImportProgress(
          importRecord,
          createImportProgress("matching", rowsProcessed, normalizedRows.length, 45 + Math.round((rowsProcessed / Math.max(normalizedRows.length, 1)) * 35)),
          {
            matchedRowCount,
            unmatchedRowCount,
            mismatchRowCount,
            timingsMs: createImportTimings({
              ...(importRecord.timingsMs || {}),
              parse: parseMs,
              rawWrite: rawWriteMs,
              normalize: normalizeMs,
            }),
          }
        );
        lastMatchingProgressRows = rowsProcessed;
        lastMatchingProgressAt = Date.now();
      }
    }
    await flushMatchingWrites();
    const matchingMs = stageTimer.end("matching");
    console.info("[registry] import stage end", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "matching",
      durationMs: matchingMs,
      rowCount: normalizedRows.length,
    });

    currentStage = "projection";
    const matchedPropertyIds = Array.from(new Set(matches.map((item) => String(item.propertyId || "").trim()).filter(Boolean)));
    stageTimer.start("projection");
    console.info("[registry] import stage start", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "projection",
      propertyCount: matchedPropertyIds.length,
    });
    importRecord = await updateRegistryImportProgress(
      importRecord,
      createImportProgress("projection", 0, matchedPropertyIds.length, 85),
      {
        matchedRowCount,
        unmatchedRowCount,
        mismatchRowCount,
        timingsMs: createImportTimings({
          ...(importRecord.timingsMs || {}),
          parse: parseMs,
          rawWrite: rawWriteMs,
          normalize: normalizeMs,
          matching: matchingMs,
        }),
      }
    );

    let lastProjectionProgressRows = 0;
    let lastProjectionProgressAt = Date.now();
    for (const [index, propertyId] of matchedPropertyIds.entries()) {
      await refreshPropertyProjectionFromCurrentMatches({
        propertyId,
        source: params.source,
        importBatchId: importRecord.importBatchId,
      });
      const rowsProcessed = index + 1;
      if (
        shouldWriteImportProgress({
          rowsProcessed,
          rowCount: matchedPropertyIds.length,
          lastRowsProcessed: lastProjectionProgressRows,
          lastWrittenAt: lastProjectionProgressAt,
          force: rowsProcessed === matchedPropertyIds.length,
        })
      ) {
        importRecord = await updateRegistryImportProgress(
          importRecord,
          createImportProgress("projection", rowsProcessed, matchedPropertyIds.length, 85 + Math.round((rowsProcessed / Math.max(matchedPropertyIds.length, 1)) * 10))
        );
        lastProjectionProgressRows = rowsProcessed;
        lastProjectionProgressAt = Date.now();
      }
    }
    const projectionMs = stageTimer.end("projection");
    console.info("[registry] import stage end", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      stage: "projection",
      durationMs: projectionMs,
      propertyCount: matchedPropertyIds.length,
    });

    const diagnostics = summarizeImportDiagnostics({ rawRows, normalizedRows, matches });
    const completedAt = nowIso();
    const totalMs = importRecord.startedAt ? Math.max(0, Date.parse(completedAt) - Date.parse(importRecord.startedAt)) : null;
    const summary = {
      rowCount: parsedRows.length,
      parsedRowCount: rawRows.length,
      normalizedRowCount: normalizedRows.length,
      matchedRowCount,
      unmatchedRowCount,
      mismatchRowCount,
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

    const completedImport: RegistryImportRecord = normalizeImportRecord({
      ...importRecord,
      ...summary,
      status: "completed",
      progress: createImportProgress("completed", summary.rowCount, summary.rowCount, 100),
      timingsMs: createImportTimings({
        ...(importRecord.timingsMs || {}),
        parse: parseMs,
        rawWrite: rawWriteMs,
        normalize: normalizeMs,
        matching: matchingMs,
        projection: projectionMs,
        total: totalMs,
      }),
      completedAt,
      lastHeartbeatAt: nowIso(),
      failureStage: null,
    });
    await writeImportRecord(completedImport);
    await db.collection("registrySources").doc(importRecord.sourceKey).set(
      {
        latestImportId: importRecord.importBatchId,
        updatedAt: nowIso(),
      },
      { merge: true }
    );
    await recordRegistryAuditEvent({
      sourceKey: importRecord.sourceKey,
      importBatchId: importRecord.importBatchId,
      actorType: "admin",
      actorId: params.actorId || null,
      eventType: "import_completed",
      eventData: summary,
    });
    console.info("[registry] import completed", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      rowCount: summary.rowCount,
      matchedRowCount: summary.matchedRowCount,
      unmatchedRowCount: summary.unmatchedRowCount,
      mismatchRowCount: summary.mismatchRowCount,
      timingsMs: completedImport.timingsMs || null,
    });

    return {
      importRecord: completedImport,
      summary,
    };
  } catch (error: any) {
    const failedAt = nowIso();
    const totalMs = importRecord.startedAt ? Math.max(0, Date.parse(failedAt) - Date.parse(importRecord.startedAt)) : null;
    const failedImport: RegistryImportRecord = normalizeImportRecord({
      ...importRecord,
      status: "failed",
      progress: createImportProgress("failed", 0, importRecord.rowCount || 0, 100),
      errorSummary: String(error?.message || "Registry import failed"),
      timingsMs: createImportTimings({
        ...(importRecord.timingsMs || {}),
        total: totalMs,
      }),
      completedAt: failedAt,
      lastHeartbeatAt: nowIso(),
      failureStage: currentStage,
    });
    await writeImportRecord(failedImport);
    await recordRegistryAuditEvent({
      sourceKey: importRecord.sourceKey,
      importBatchId: importRecord.importBatchId,
      actorType: "admin",
      actorId: params.actorId || null,
      eventType: "import_failed",
      eventData: {
        errorSummary: failedImport.errorSummary,
        failureStage: currentStage,
      },
    });
    console.error("[registry] import failed", {
      importId: importRecord.id,
      sourceKey: importRecord.sourceKey,
      failureStage: currentStage,
      message: failedImport.errorSummary,
      timingsMs: failedImport.timingsMs || null,
    });
    throw error;
  }
}

async function runRegistryImportJob(importId: string) {
  const importRecord = await getRegistryImportRecord(importId);
  if (!importRecord || isRegistryImportTerminal(importRecord.status)) return;

  try {
    const { adapter, source } = await ensureRegistrySource(importRecord.sourceKey);
    const fileLoadResult = await loadRegistryImportCsv(importRecord);
    await processRegistryImportCore({
      importRecord: fileLoadResult.importRecord,
      csvText: fileLoadResult.csvText,
      source,
      adapter,
      actorId: fileLoadResult.importRecord.createdBy || null,
    });
  } catch (error: any) {
    const currentImportRecord = (await getRegistryImportRecord(importRecord.id)) || importRecord;
    const failedAt = nowIso();
    const totalMs = currentImportRecord.startedAt ? Math.max(0, Date.parse(failedAt) - Date.parse(currentImportRecord.startedAt)) : null;
    const failedImport = normalizeImportRecord({
      ...currentImportRecord,
      status: "failed",
      progress: createImportProgress("failed", 0, currentImportRecord.rowCount || 0, 100),
      errorSummary: String(error?.message || "Registry import failed"),
      timingsMs: createImportTimings({
        ...(currentImportRecord.timingsMs || {}),
        total: totalMs,
      }),
      completedAt: failedAt,
      lastHeartbeatAt: nowIso(),
      failureStage: "file_load",
      retryCount:
        typeof error?.fileLoadRetryCount === "number"
          ? error.fileLoadRetryCount
          : typeof currentImportRecord.retryCount === "number"
            ? currentImportRecord.retryCount
            : 0,
    });
    await writeImportRecord(failedImport);
    await recordRegistryAuditEvent({
      sourceKey: currentImportRecord.sourceKey,
      importBatchId: currentImportRecord.importBatchId,
      actorType: "admin",
      actorId: currentImportRecord.createdBy || null,
      eventType: "import_failed",
      eventData: {
        errorSummary: failedImport.errorSummary,
        failureStage: "file_load",
      },
    });
    throw error;
  }
}

function scheduleRegistryImportJob(importId: string) {
  if (activeRegistryImportJobs.has(importId)) return activeRegistryImportJobs.get(importId)!;
  const jobPromise = Promise.resolve()
    .then(() => runRegistryImportJob(importId))
    .catch((error) => {
      console.error("[registry] async import job failed", { importId, message: (error as any)?.message || String(error) });
    })
    .finally(() => {
      activeRegistryImportJobs.delete(importId);
    });
  activeRegistryImportJobs.set(importId, jobPromise);
  return jobPromise;
}

function maybeScheduleRegistryImportResume(importRecord: RegistryImportRecord | null | undefined) {
  if (!importRecord || isRegistryImportTerminal(importRecord.status)) return;
  if (importRecord.status === "queued") {
    scheduleRegistryImportJob(importRecord.id);
    return;
  }
  if (importRecord.status === "processing" && !activeRegistryImportJobs.has(importRecord.id) && isImportHeartbeatStale(importRecord.lastHeartbeatAt)) {
    scheduleRegistryImportJob(importRecord.id);
  }
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
  const matches = (matchesSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord));
  const best = selectRegistryProjectionWinner(matches);

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
      activeNormalizedRecordId: best?.normalizedRecordId || null,
    },
  });
  return projection;
}

export async function runRegistryImport(params: {
  sourceKey: RegistrySourceKey;
  csvText: string;
  sourceFileName?: string | null;
  sourceFileStorageBucket?: string | null;
  sourceFileStoragePath?: string | null;
  actorId?: string | null;
}) {
  const { adapter, source } = await ensureRegistrySource(params.sourceKey);
  const now = nowIso();
  const importBatchId = makeStableId([params.sourceKey, Date.now()]);
  const importRecord = normalizeImportRecord({
    id: importBatchId,
    sourceKey: params.sourceKey,
    sourceFileName: params.sourceFileName || null,
    sourceFileStorageBucket: params.sourceFileStorageBucket || null,
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
    processingMode: "sync",
    progress: createImportProgress("parse", 0, 0, 5),
    lastHeartbeatAt: now,
    failureStage: null,
    retryCount: 0,
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
  });

  await writeImportRecord(importRecord);
  await recordRegistryAuditEvent({
    sourceKey: params.sourceKey,
    importBatchId,
      actorType: "admin",
      actorId: params.actorId || null,
      eventType: "import_started",
      eventData: { sourceFileName: params.sourceFileName || null, processingMode: "sync" },
    });
  return processRegistryImportCore({
    importRecord,
    csvText: params.csvText,
    source,
    adapter,
    actorId: params.actorId || null,
  });
}

export async function startRegistryImportJob(params: {
  sourceKey: RegistrySourceKey;
  csvText: string;
  sourceFileName?: string | null;
  sourceFileStoragePath?: string | null;
  actorId?: string | null;
}) {
  await ensureRegistrySource(params.sourceKey);
  const now = nowIso();
  const importBatchId = makeStableId([params.sourceKey, Date.now()]);
  const storedSource =
    params.sourceFileStoragePath
      ? { bucket: String(process.env.GCS_UPLOAD_BUCKET || "").trim() || null, path: params.sourceFileStoragePath }
      : await persistRegistryImportCsv({
          importId: importBatchId,
          sourceKey: params.sourceKey,
          csvText: params.csvText,
          sourceFileName: params.sourceFileName || null,
          actorId: params.actorId || null,
        });

  const importRecord = normalizeImportRecord({
    id: importBatchId,
    sourceKey: params.sourceKey,
    sourceFileName: params.sourceFileName || null,
    sourceFileStorageBucket: storedSource.bucket || null,
    sourceFileStoragePath: storedSource.path || null,
    importBatchId,
    rowCount: 0,
    parsedRowCount: 0,
    normalizedRowCount: 0,
    matchedRowCount: 0,
    unmatchedRowCount: 0,
    mismatchRowCount: 0,
    ignoredRowCount: 0,
    skippedRowCount: 0,
    status: "queued",
    processingMode: "async",
    progress: createImportProgress("queued", 0, 0, 0),
    lastHeartbeatAt: now,
    failureStage: null,
    retryCount: 0,
    errorSummary: null,
    diagnostics: {
      missingPidCount: 0,
      missingAddressCount: 0,
      unsupportedStatusCount: 0,
      invalidNumericFieldCount: 0,
      duplicateRowHashCount: 0,
    },
    startedAt: null,
    completedAt: null,
    createdBy: params.actorId || null,
    createdAt: now,
  });

  await writeImportRecord(importRecord);
  await recordRegistryAuditEvent({
    sourceKey: params.sourceKey,
    importBatchId,
    actorType: "admin",
    actorId: params.actorId || null,
    eventType: "import_started",
    eventData: {
      sourceFileName: params.sourceFileName || null,
      processingMode: "async",
      sourceFileStoragePath: importRecord.sourceFileStoragePath,
    },
  });
  console.info("[registry] import queued", {
    importId: importBatchId,
    sourceKey: params.sourceKey,
    sourceFileName: params.sourceFileName || null,
    sourceFileStoragePath: importRecord.sourceFileStoragePath,
  });
  scheduleRegistryImportJob(importBatchId);
  return {
    importId: importBatchId,
    status: importRecord.status,
    importRecord,
  };
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
    const items = (snap.docs || []).map((doc: any) => normalizeImportRecord({ id: doc.id, ...(doc.data() || {}) } as RegistryImportRecord));
    items.forEach((item) => maybeScheduleRegistryImportResume(item));
    return items;
  } catch (error) {
    if (isMissingIndexError(error)) {
      console.warn("[registry] listRegistryImports missing index", { sourceKey, message: (error as any)?.message });
      return [];
    }
    throw error;
  }
}

export async function getRegistryImport(importId: string) {
  const record = await getRegistryImportRecord(importId);
  if (!record) return null;
  maybeScheduleRegistryImportResume(record);
  return record;
}

export async function listRegistryReviewQueue(input?: {
  sourceKey?: RegistrySourceKey | null;
  matchStatus?: RegistryMatchRecord["matchStatus"] | "all" | null;
  search?: string | null;
  pageSize?: number | null;
  pageCursor?: string | null;
}) {
  const startedAt = Date.now();
  const sourceKey = (input?.sourceKey || "halifax_r400") as RegistrySourceKey;
  const searchTokens = tokenizeSearchValue(input?.search, { includeCompact: false }).slice(0, 8);
  const statusFilter = input?.matchStatus && input.matchStatus !== "all" ? input.matchStatus : null;
  const pageSizeRaw = Number(input?.pageSize ?? 50);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(Math.floor(pageSizeRaw), 1), 100) : 50;
  const cursor = decodeRegistryReviewCursor(input?.pageCursor);
  const summaryStartedAt = Date.now();
  const summary = await getRegistryReviewQueueSummary(sourceKey);
  const summaryMs = Date.now() - summaryStartedAt;

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
  const queryStartedAt = Date.now();

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
    const enrichmentStartedAt = Date.now();
    const items = await Promise.all(
      pageDocs.map(async (doc: any) => {
        const raw = doc.data() || {};
        const match = await enrichRegistryMatchForQueue({
          match: { id: doc.id, ...raw } as RegistryMatchRecord,
          includeTopCandidate: !raw.propertyId,
        });
        return buildRegistryReviewQueueItem(match);
      })
    );
    const enrichmentMs = Date.now() - enrichmentStartedAt;
    const hasMore = docs.length > pageSize;
    const nextCursor = hasMore
      ? encodeRegistryReviewCursor({
          updatedAt: String(pageDocs[pageDocs.length - 1]?.data()?.updatedAt || ""),
          id: String(pageDocs[pageDocs.length - 1]?.id || ""),
        })
      : null;
    const result = {
      items,
      pageInfo: {
        pageSize,
        nextCursor,
        hasMore,
      },
      summary,
    };
    const totalMs = Date.now() - startedAt;
    if (totalMs >= 150) {
      console.info("[registry] review queue timing", {
        sourceKey,
        matchStatus: statusFilter || "all",
        searchTokens: searchTokens.length,
        pageSize,
        returnedItems: items.length,
        summaryMs,
        queryMs: Date.now() - queryStartedAt - enrichmentMs,
        enrichmentMs,
        totalMs,
      });
    }
    return result;
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
        const raw = doc.data() || {};
        const match = await enrichRegistryMatchForQueue({
          match: { id: doc.id, ...raw } as RegistryMatchRecord,
          includeTopCandidate: !raw.propertyId,
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

  const result = {
    items,
    pageInfo: {
      pageSize,
      nextCursor,
      hasMore,
    },
    summary,
  };
  const totalMs = Date.now() - startedAt;
  if (totalMs >= 150) {
    console.info("[registry] review queue timing", {
      sourceKey,
      matchStatus: statusFilter || "all",
      searchTokens: searchTokens.length,
      pageSize,
      returnedItems: items.length,
      summaryMs,
      queryMs: Date.now() - queryStartedAt,
      totalMs,
      usedSearchScan: true,
    });
  }
  return result;
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
    if (conflictingMatch && conflictingMatch.matchStatus === "matched" && !input.replaceExistingMatch) {
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
  const demotedCandidates =
    nextMatch.propertyId && nextMatch.matchStatus === "matched"
      ? await cleanupWeakerProjectionCandidates({
          winningMatch: nextMatch,
          source,
          actorId: input.actorId,
          reason: "Returned to review after a stronger property/source registry match became active.",
        })
      : [];
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
      demotedCandidateNormalizedRecordIds: demotedCandidates.map((match) => match.normalizedRecordId),
    },
  });
  if ((replacedExistingMatch || demotedCandidates.length) && nextMatch.propertyId) {
    await recordRegistryAuditEvent({
      sourceKey: detail.normalizedRecord.sourceKey,
      registryRecordId: detail.normalizedRecord.registryRecordId,
      propertyId: nextMatch.propertyId,
      actorType: "admin",
      actorId: input.actorId,
      eventType: "active_projection_replaced",
      eventData: {
        action: input.action,
        reason: input.reason,
        activeNormalizedRecordId: nextMatch.normalizedRecordId,
        replacedActiveNormalizedRecordId: replacedExistingMatch?.normalizedRecordId || null,
        demotedCandidateNormalizedRecordIds: demotedCandidates.map((match) => match.normalizedRecordId),
      },
    });
  }
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
  const best = selectRegistryProjectionWinner(matches);
  if (best?.propertyId) {
    await cleanupWeakerProjectionCandidates({
      winningMatch: best,
      source,
      actorId,
      reason: "Returned to review after a stronger property/source registry match became active during re-evaluation.",
    });
  }
  const projection = await refreshPropertyProjectionFromCurrentMatches({
    propertyId,
    source,
    actorId,
  });
  await recordRegistryAuditEvent({
    sourceKey: source.sourceKey,
    propertyId,
    registryRecordId: projection?.registryRecordId || null,
    actorType: "admin",
    actorId,
    eventType: "projection_updated",
    eventData: {
      triggeredBy: "re_evaluate",
      registryStatus: projection.registryStatus,
      activeNormalizedRecordId: best?.normalizedRecordId || null,
    },
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
