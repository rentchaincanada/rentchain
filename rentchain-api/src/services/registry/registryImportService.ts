import { db } from "../../config/firebase";
import { commitInBatches } from "../../imports/firestoreBatch";
import { recordRegistryAuditEvent } from "./registryAuditService";
import type {
  RegistryImportRecord,
  RegistryMatchRecord,
  RegistryRecordNormalized,
  RegistrySourceKey,
  RegistrySourceRecord,
} from "./registryTypes";
import { makeStableId, nowIso } from "./registryUtils";
import { HalifaxR400Adapter } from "./adapters/HalifaxR400Adapter";
import type { RegistrySourceAdapter } from "./adapters/RegistrySourceAdapter";
import { evaluateRegistryMatch, findRegistryCandidatesForRecord, reEvaluatePropertyAgainstRegistry } from "./registryMatchingService";
import { getPropertyRegistryProjection, upsertPropertyRegistryProjection } from "./registryStatusProjectionService";
import { getPropertyById } from "../firestorePropertiesService";

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

function getAdapter(sourceKey: RegistrySourceKey): RegistrySourceAdapter {
  if (sourceKey === "halifax_r400") return new HalifaxR400Adapter();
  throw new Error(`Unsupported registry source: ${sourceKey}`);
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
    code: "property_not_found",
    statusCode: 404,
  });
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
    status: "processing",
    errorSummary: null,
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
      const evaluated = await evaluateRegistryMatch({ adapter, record: row });
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

    const summary = {
      rowCount: parsedRows.length,
      parsedRowCount: rawRows.length,
      normalizedRowCount: normalizedRows.length,
      matchedRowCount: matches.filter((item) => item.matchStatus === "matched").length,
      unmatchedRowCount: matches.filter((item) => item.matchStatus === "unmatched").length,
      mismatchRowCount: matches.filter((item) => item.matchStatus === "mismatch").length,
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
  const snap = await query.get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

export async function listRegistryReviewQueue(input?: {
  sourceKey?: RegistrySourceKey | null;
  matchStatus?: RegistryMatchRecord["matchStatus"] | "all" | null;
}) {
  let query: FirebaseFirestore.Query = db.collection("registryMatches").orderBy("updatedAt", "desc");
  if (input?.sourceKey) {
    query = db.collection("registryMatches").where("sourceKey", "==", input.sourceKey).orderBy("updatedAt", "desc");
  }
  const snap = await query.get();
  const items = await Promise.all(
    (snap.docs || []).map(async (doc: any) => {
      const match = { id: doc.id, ...(doc.data() || {}) } as RegistryMatchRecord;
      if (input?.matchStatus && input.matchStatus !== "all" && match.matchStatus !== input.matchStatus) return null;
      const normalizedSnap = await db.collection("registryRecordsNormalized").doc(match.normalizedRecordId).get();
      const propertySnap = match.propertyId ? await db.collection("properties").doc(match.propertyId).get() : null;
      return {
        match,
        normalizedRecord: normalizedSnap.exists ? { id: normalizedSnap.id, ...(normalizedSnap.data() || {}) } : null,
        property: propertySnap?.exists ? { id: propertySnap.id, ...(propertySnap.data() || {}) } : null,
      };
    })
  );
  return items.filter(Boolean);
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

  return {
    normalizedRecord,
    rawRecord: rawSnap.docs?.[0] ? { id: rawSnap.docs[0].id, ...(rawSnap.docs[0].data() || {}) } : null,
    match: matchSnap.exists ? ({ id: matchSnap.id, ...(matchSnap.data() || {}) } as RegistryMatchRecord) : null,
    candidates,
    auditTrail: (auditSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
  };
}

export async function applyRegistryMatchOverride(input: {
  normalizedRecordId: string;
  action: "attach" | "ignore";
  propertyId?: string | null;
  reason: string;
  actorId: string;
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
  if (input.action === "attach") {
    const property = await resolvePropertyForRegistryOverride(String(input.propertyId || ""));
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
  } else {
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
  }

  await db.collection("registryMatches").doc(matchId).set(nextMatch, { merge: true });
  if (nextMatch.propertyId) {
    await upsertPropertyRegistryProjection({
      propertyId: nextMatch.propertyId,
      source,
      match: nextMatch,
      record: detail.normalizedRecord,
    });
  }
  await recordRegistryAuditEvent({
    sourceKey: detail.normalizedRecord.sourceKey,
    registryRecordId: detail.normalizedRecord.registryRecordId,
    propertyId: nextMatch.propertyId,
    actorType: "admin",
    actorId: input.actorId,
    eventType: "match_overridden",
    eventData: {
      action: input.action,
      reason: input.reason,
      propertyId: nextMatch.propertyId,
    },
  });
  return nextMatch;
}

export function isRegistryOverrideError(error: unknown): error is RegistryOverrideError {
  return error instanceof RegistryOverrideError;
}

export async function getPropertyRegistryReview(propertyId: string) {
  const propertySnap = await db.collection("properties").doc(propertyId).get();
  if (!propertySnap.exists) return null;
  const property = { id: propertySnap.id, ...(propertySnap.data() || {}) } as any;
  const { source } = await ensureRegistrySource("halifax_r400");
  const projection = await getPropertyRegistryProjection({ propertyId, source });
  const matchesSnap = await db.collection("registryMatches").where("propertyId", "==", propertyId).get();
  const matches = (matchesSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) as RegistryMatchRecord[];
  return { property, projection, matches };
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
