import { db, FieldValue } from "../../config/firebase";
import { halifaxRentalRegistryManualPortalAdapter } from "./adapters/halifaxRentalRegistryManualPortalAdapter";
import { HALIFAX_REGISTRY_SUBMISSION_COLLECTION, loadPropertyRegistrySubmissionDraft } from "./halifaxRegistrySubmissionService";
import { nowIso } from "./schemas/registrySchemaCommon";
import { resolveRegistrySchemaForProperty, resolveRegistrySchemaSummaryByKey } from "./schemas/registrySchemaResolver";
import { validateRegistrySubmissionDraftV2 } from "./schemas/registrySubmissionDraftV2";
import type { RegistrySubmissionDraftV2 } from "./schemas/registrySchemaTypes";
import type {
  RegistryFilingAdapter,
  RegistrySubmissionAttemptV3,
  RegistrySubmissionAuditEventV3,
  RegistrySubmissionEvidenceV3,
  RegistrySubmissionFilingSummaryV3,
  RegistrySubmissionLifecycleStatus,
  RegistrySubmissionNormalizedSectionV3,
  RegistrySubmissionReadyV3,
  RegistrySubmissionReferenceNumberV3,
  RegistrySubmissionRequestV3,
  RegistrySubmissionResultV3,
} from "./registrySubmissionLayerTypes";

export const REGISTRY_SUBMISSION_READY_COLLECTION = "propertyRegistrySubmissionReadyV3";
export const REGISTRY_SUBMISSION_ATTEMPT_COLLECTION = "propertyRegistrySubmissionAttemptsV3";
export const REGISTRY_SUBMISSION_REQUEST_COLLECTION = "propertyRegistrySubmissionRequestsV3";
export const REGISTRY_SUBMISSION_RESULT_COLLECTION = "propertyRegistrySubmissionResultsV3";

type FilingTerminalStatus = Extract<
  RegistrySubmissionLifecycleStatus,
  "filed_pending_confirmation" | "filed_confirmed" | "rejected" | "failed" | "cancelled"
>;

function appendAuditEvent(
  events: RegistrySubmissionAuditEventV3[] | null | undefined,
  input: Omit<RegistrySubmissionAuditEventV3, "at">
): RegistrySubmissionAuditEventV3[] {
  return [
    ...(Array.isArray(events) ? events : []),
    {
      at: nowIso(),
      ...input,
    },
  ];
}

function normalizeScalar(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean).join(", ") || null;
  }
  return JSON.stringify(value);
}

function formatAddress(address: RegistrySubmissionDraftV2["entity"]["siteAddress"]) {
  return [address.line1, address.line2, address.city, address.province, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
}

function formatContact(contact: RegistrySubmissionDraftV2["contact"]["owner"]) {
  const parts = [contact.name, contact.company, contact.email, contact.phone, formatAddress(contact.address)].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

function buildNormalizedSectionsFromDraft(draft: RegistrySubmissionDraftV2): RegistrySubmissionNormalizedSectionV3[] {
  const sections: RegistrySubmissionNormalizedSectionV3[] = [
    {
      id: "property_site",
      label: "Property / Site",
      fields: [
        {
          id: "siteAddress",
          label: "Site address",
          value: formatAddress(draft.form.fieldValues.siteAddress),
          required: true,
        },
        {
          id: "propertyIdentifierPid",
          label: "Property PID",
          value: draft.form.fieldValues.propertyIdentifierPid,
          required: false,
        },
        {
          id: "moreThanFiveBuildings",
          label: "More than five buildings",
          value: draft.form.fieldValues.moreThanFiveBuildings,
          required: true,
        },
      ],
    },
    {
      id: "owner_contact",
      label: "Owner / Primary Contact",
      fields: [
        {
          id: "owner",
          label: "Owner",
          value: formatContact(draft.form.fieldValues.owner),
          required: true,
        },
        {
          id: "primaryContactSameAsOwner",
          label: "Primary contact same as owner",
          value: draft.form.fieldValues.primaryContactSameAsOwner,
          required: true,
        },
        {
          id: "primaryContact",
          label: "Primary contact",
          value:
            draft.form.fieldValues.primaryContactSameAsOwner === false
              ? formatContact(draft.form.fieldValues.primaryContact)
              : "Same as owner",
          required: draft.form.fieldValues.primaryContactSameAsOwner === false,
        },
      ],
    },
  ];

  draft.form.fieldValues.buildings.forEach((building, index) => {
    sections.push({
      id: `building_${index + 1}`,
      label: `Building ${index + 1}`,
      fields: [
        {
          id: `building_${index + 1}_address`,
          label: "Primary address",
          value: formatAddress(building.primaryAddress),
          required: true,
        },
        {
          id: `building_${index + 1}_rentalUnitTypes`,
          label: "Rental unit types",
          value: normalizeScalar(building.rentalUnitTypes),
          required: true,
        },
        {
          id: `building_${index + 1}_residentialUnitsRented`,
          label: "Residential units rented",
          value: building.residentialUnitsRented,
          required: true,
        },
        {
          id: `building_${index + 1}_shortTermRentalUnits`,
          label: "Short-term rental units",
          value: building.shortTermRentalUnits,
          required: true,
        },
        {
          id: `building_${index + 1}_buildingType`,
          label: "Building type",
          value: building.buildingType,
          required: true,
        },
        {
          id: `building_${index + 1}_totalResidentialUnits`,
          label: "Total residential units",
          value: building.totalResidentialUnits,
          required: true,
        },
        {
          id: `building_${index + 1}_hasCommercialUnits`,
          label: "Commercial units present",
          value: building.hasCommercialUnits,
          required: true,
        },
        {
          id: `building_${index + 1}_fireLifeSafetySystems`,
          label: "Fire / life-safety systems",
          value: normalizeScalar(building.fireLifeSafetySystems),
          required: false,
        },
        {
          id: `building_${index + 1}_yearConstructed`,
          label: "Year constructed",
          value: building.yearConstructed,
          required: false,
        },
      ],
    });
  });

  sections.push(
    {
      id: "declarations",
      label: "Declarations",
      fields: draft.declarations.items.map((item) => ({
        id: item.id,
        label: item.label,
        value: item.checked,
        required: item.required,
      })),
    },
    {
      id: "consent",
      label: "Consent",
      fields: [
        {
          id: "preparationAuthorized",
          label: "Preparation authorized",
          value: draft.submission.consent.preparationAuthorized,
          required: true,
        },
        {
          id: "declarationsConfirmed",
          label: "Declarations confirmed",
          value: draft.submission.consent.declarationsConfirmed,
          required: true,
        },
        {
          id: "finalReviewConfirmed",
          label: "Final review confirmed",
          value: draft.submission.consent.finalReviewConfirmed,
          required: false,
        },
      ],
    }
  );

  return sections;
}

function resolveFilingAdapter(
  draftOrReady: Pick<RegistrySubmissionDraftV2, "context"> | Pick<RegistrySubmissionReadyV3, "schemaKey">
): RegistryFilingAdapter {
  const schemaKey = "schemaKey" in draftOrReady ? draftOrReady.schemaKey : draftOrReady.context.schemaKey;
  if (schemaKey === halifaxRentalRegistryManualPortalAdapter.schemaKey) {
    return halifaxRentalRegistryManualPortalAdapter;
  }
  throw new Error(`No filing adapter is configured for schema ${schemaKey} yet.`);
}

function attemptIdForDraft(draftId: string, attemptNumber: number) {
  return `${draftId}__attempt_${attemptNumber}`;
}

function requestIdForAttempt(attemptId: string) {
  return `${attemptId}__request`;
}

function resultIdForAttempt(attemptId: string) {
  return `${attemptId}__result`;
}

function mergeReferences(
  current: RegistrySubmissionReferenceNumberV3[],
  incoming: RegistrySubmissionReferenceNumberV3[] | undefined
) {
  const merged = [...current];
  (incoming || []).forEach((entry) => {
    const key = `${entry.type}:${entry.value}`;
    if (!merged.some((item) => `${item.type}:${item.value}` === key)) {
      merged.push(entry);
    }
  });
  return merged;
}

function mergeEvidence(current: RegistrySubmissionEvidenceV3[], incoming: RegistrySubmissionEvidenceV3[] | undefined) {
  const merged = [...current];
  (incoming || []).forEach((entry) => {
    if (!merged.some((item) => item.id === entry.id)) {
      merged.push(entry);
    }
  });
  return merged;
}

async function loadDoc<T>(collection: string, id: string): Promise<T | null> {
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as T;
}

async function loadPersistedDraftUpdatedAt(draftId: string): Promise<string | null> {
  const stored = await loadDoc<any>(HALIFAX_REGISTRY_SUBMISSION_COLLECTION, draftId);
  const persistedUpdatedAt =
    (stored?.timestamps && typeof stored.timestamps === "object" ? stored.timestamps.updatedAt : null) ||
    stored?.updatedAt ||
    null;
  return typeof persistedUpdatedAt === "string" && persistedUpdatedAt.trim() ? persistedUpdatedAt : null;
}

async function isReadyPackageStale(draftId: string, ready: RegistrySubmissionReadyV3 | null): Promise<boolean> {
  if (!ready?.audit?.sourceDraftUpdatedAt) return false;
  const persistedUpdatedAt = await loadPersistedDraftUpdatedAt(draftId);
  if (!persistedUpdatedAt) return false;
  return new Date(persistedUpdatedAt).getTime() > new Date(ready.audit.sourceDraftUpdatedAt).getTime();
}

function sortAttemptsNewestFirst(attempts: RegistrySubmissionAttemptV3[]) {
  return [...attempts].sort((a, b) => {
    if (b.attemptNumber !== a.attemptNumber) return b.attemptNumber - a.attemptNumber;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

async function listAttemptsByDraftId(draftId: string): Promise<RegistrySubmissionAttemptV3[]> {
  const snap = await db.collection(REGISTRY_SUBMISSION_ATTEMPT_COLLECTION).where("sourceDraftId", "==", draftId).get();
  return sortAttemptsNewestFirst((snap.docs || []).map((doc: any) => doc.data() as RegistrySubmissionAttemptV3));
}

function buildAttemptFromRequest(input: {
  ready: RegistrySubmissionReadyV3;
  request: RegistrySubmissionRequestV3;
  attemptNumber: number;
  actorId: string | null;
  note?: string | null;
}): RegistrySubmissionAttemptV3 {
  const now = input.request.createdAt || nowIso();
  return {
    schemaVersion: 3,
    attemptId: input.request.attemptId,
    propertyId: input.ready.propertyId,
    sourceDraftId: input.ready.sourceDraftId,
    readyId: input.ready.readyId,
    requestId: input.request.requestId,
    resultId: null,
    attemptNumber: input.attemptNumber,
    filingChannel: input.request.filingChannel,
    adapterKey: input.request.adapterKey,
    status: input.request.status,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actorId,
    updatedBy: input.actorId,
    referenceNumbers: input.request.referenceNumbers || [],
    operatorNotes: input.note || input.request.operatorNotes || null,
    evidence: input.request.evidence || [],
    audit: {
      events: [
        {
          at: now,
          actorId: input.actorId,
          type: "filing_attempt_created",
          status: input.request.status,
          note: input.note || "Filing attempt created from ready package.",
        },
      ],
    },
  };
}

function buildResultFromRequest(input: {
  request: RegistrySubmissionRequestV3;
  status: FilingTerminalStatus;
  actorId: string | null;
  note?: string | null;
  referenceNumbers?: RegistrySubmissionReferenceNumberV3[];
  evidence?: RegistrySubmissionEvidenceV3[];
}): RegistrySubmissionResultV3 {
  const now = nowIso();
  return {
    schemaVersion: 3,
    resultId: resultIdForAttempt(input.request.attemptId),
    attemptId: input.request.attemptId,
    requestId: input.request.requestId,
    readyId: input.request.readyId,
    sourceDraftId: input.request.sourceDraftId,
    propertyId: input.request.propertyId,
    sourceKey: input.request.sourceKey,
    schemaKey: input.request.schemaKey,
    filingChannel: input.request.filingChannel,
    adapterKey: input.request.adapterKey,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    submittedAt: input.status === "filed_pending_confirmation" || input.status === "filed_confirmed" ? now : null,
    confirmedAt: input.status === "filed_confirmed" ? now : null,
    rejectedAt: input.status === "rejected" ? now : null,
    failedAt: input.status === "failed" ? now : null,
    cancelledAt: input.status === "cancelled" ? now : null,
    actor: {
      updatedBy: input.actorId,
    },
    referenceNumbers: input.referenceNumbers || [],
    operatorNotes: input.note || null,
    evidence: input.evidence || [],
    outcome: {
      message: input.note || null,
    },
    audit: {
      events: [
        {
          at: now,
          actorId: input.actorId,
          type: "filing_result_recorded",
          status: input.status,
          note: input.note || null,
        },
      ],
    },
  };
}

export function buildRegistrySubmissionReadyV3FromDraft(draft: RegistrySubmissionDraftV2): RegistrySubmissionReadyV3 {
  const schema =
    resolveRegistrySchemaSummaryByKey(draft.context.schemaKey) ||
    resolveRegistrySchemaForProperty({
      country: draft.context.jurisdiction.country,
      province: draft.context.jurisdiction.province,
      city: draft.context.jurisdiction.municipality,
    });
  const validation = validateRegistrySubmissionDraftV2({ draft, schema });
  const adapter = resolveFilingAdapter(draft);
  const now = nowIso();
  return {
    ...adapter.normalize(draft),
    createdAt: now,
    updatedAt: now,
    status: validation.exportReady ? "ready_to_file" : "in_review",
    validation,
    normalizedSubmission: {
      sections: buildNormalizedSectionsFromDraft(draft),
      attachments: draft.attachments,
      disclaimer: draft.meta.disclaimer,
    },
    audit: {
      sourceDraftUpdatedAt: draft.timestamps.updatedAt,
      events: [
        {
          at: now,
          actorId: draft.actor.updatedBy,
          type: "ready_package_created",
          status: validation.exportReady ? "ready_to_file" : "in_review",
          note: "Ready package derived from canonical RegistrySubmissionDraftV2.",
        },
      ],
    },
  };
}

export function buildRegistrySubmissionFilingRequestFromReady(
  ready: RegistrySubmissionReadyV3,
  actorId: string | null
): RegistrySubmissionRequestV3 {
  const adapter = resolveFilingAdapter(ready);
  const now = nowIso();
  const request = adapter.buildRequest({
    ...ready,
    actor: {
      ...ready.actor,
      updatedBy: actorId || ready.actor.updatedBy,
    },
    updatedAt: now,
  });
  const attemptId = request.attemptId || attemptIdForDraft(ready.sourceDraftId, 1);
  return {
    ...request,
    attemptId,
    requestId: request.requestId || requestIdForAttempt(attemptId),
    createdAt: now,
    updatedAt: now,
    status: ready.status,
    actor: {
      requestedBy: actorId || request.actor.requestedBy,
      updatedBy: actorId || request.actor.updatedBy,
    },
    checklist: adapter.buildOperatorChecklist ? adapter.buildOperatorChecklist(ready) : request.checklist,
    audit: {
      events: appendAuditEvent(request.audit.events, {
        actorId,
        type: "filing_request_initialized",
        status: ready.status,
        note: "Manual filing request initialized from ready package.",
      }),
    },
  };
}

async function loadAttemptById(attemptId: string): Promise<RegistrySubmissionAttemptV3 | null> {
  return loadDoc<RegistrySubmissionAttemptV3>(REGISTRY_SUBMISSION_ATTEMPT_COLLECTION, attemptId);
}

async function loadLatestAttemptByDraftId(draftId: string): Promise<RegistrySubmissionAttemptV3 | null> {
  const attempts = await listAttemptsByDraftId(draftId);
  return attempts[0] || null;
}

async function buildFilingSummary(draftId: string): Promise<RegistrySubmissionFilingSummaryV3> {
  const ready = await loadDoc<RegistrySubmissionReadyV3>(REGISTRY_SUBMISSION_READY_COLLECTION, draftId);
  const attempts = await listAttemptsByDraftId(draftId);
  const latestAttempt = attempts[0] || null;
  const [request, result] = latestAttempt
    ? await Promise.all([
        loadDoc<RegistrySubmissionRequestV3>(REGISTRY_SUBMISSION_REQUEST_COLLECTION, latestAttempt.requestId),
        latestAttempt.resultId
          ? loadDoc<RegistrySubmissionResultV3>(REGISTRY_SUBMISSION_RESULT_COLLECTION, latestAttempt.resultId)
          : Promise.resolve(null),
      ])
    : [null, null];

  return {
    ready,
    latestAttempt,
    attempts,
    request,
    result,
    currentStatus: latestAttempt?.status || result?.status || request?.status || ready?.status || null,
  };
}

export async function loadRegistrySubmissionFilingSummaryByDraftId(
  draftId: string
): Promise<RegistrySubmissionFilingSummaryV3> {
  return buildFilingSummary(draftId);
}

export async function listRegistrySubmissionAttempts(input: {
  property: Record<string, any>;
  landlordId: string | null;
}) {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  const attempts = await listAttemptsByDraftId(draft.draftId);
  return {
    sourceDraftId: draft.draftId,
    latestAttempt: attempts[0] || null,
    attempts,
  };
}

export async function getLatestRegistrySubmissionAttempt(input: {
  property: Record<string, any>;
  landlordId: string | null;
}) {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  return loadLatestAttemptByDraftId(draft.draftId);
}

export async function createRegistrySubmissionReadyPackage(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorId: string | null;
}): Promise<RegistrySubmissionReadyV3> {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  const ready = buildRegistrySubmissionReadyV3FromDraft(draft);
  await db.collection(REGISTRY_SUBMISSION_READY_COLLECTION).doc(draft.draftId).set(
    {
      ...ready,
      actor: {
        ...ready.actor,
        updatedBy: input.actorId || ready.actor.updatedBy,
      },
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return {
    ...ready,
    actor: {
      ...ready.actor,
      updatedBy: input.actorId || ready.actor.updatedBy,
    },
  };
}

export async function loadRegistrySubmissionReadyPackage(input: {
  property: Record<string, any>;
  landlordId: string | null;
}): Promise<RegistrySubmissionReadyV3 | null> {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  return loadDoc<RegistrySubmissionReadyV3>(REGISTRY_SUBMISSION_READY_COLLECTION, draft.draftId);
}

export async function createAttemptFromReady(input: {
  ready: RegistrySubmissionReadyV3;
  actorId: string | null;
  attemptNumber: number;
  note?: string | null;
}): Promise<{ attempt: RegistrySubmissionAttemptV3; request: RegistrySubmissionRequestV3 }> {
  const attemptId = attemptIdForDraft(input.ready.sourceDraftId, input.attemptNumber);
  const request = buildRegistrySubmissionFilingRequestFromReady(input.ready, input.actorId);
  const nextRequest: RegistrySubmissionRequestV3 = {
    ...request,
    attemptId,
    requestId: requestIdForAttempt(attemptId),
    updatedAt: nowIso(),
    actor: {
      requestedBy: input.actorId || request.actor.requestedBy,
      updatedBy: input.actorId || request.actor.updatedBy,
    },
  };
  const attempt = buildAttemptFromRequest({
    ready: input.ready,
    request: nextRequest,
    attemptNumber: input.attemptNumber,
    actorId: input.actorId,
    note: input.note || null,
  });

  await Promise.all([
    db.collection(REGISTRY_SUBMISSION_REQUEST_COLLECTION).doc(nextRequest.requestId).set(
      {
        ...nextRequest,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.collection(REGISTRY_SUBMISSION_ATTEMPT_COLLECTION).doc(attempt.attemptId).set(
      {
        ...attempt,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  return { attempt, request: nextRequest };
}

export async function createRegistrySubmissionFilingRequest(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorId: string | null;
}): Promise<RegistrySubmissionRequestV3> {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  const ready =
    (await loadDoc<RegistrySubmissionReadyV3>(REGISTRY_SUBMISSION_READY_COLLECTION, draft.draftId)) ||
    (await createRegistrySubmissionReadyPackage(input));
  if (await isReadyPackageStale(draft.draftId, ready)) {
    throw new Error("Draft has changed since this ready package was prepared. Regenerate the ready package before filing.");
  }
  if (ready.status !== "ready_to_file") {
    throw new Error("Registry submission filing request cannot be created until the draft is ready to file.");
  }

  const latestAttempt = await loadLatestAttemptByDraftId(draft.draftId);
  const nextAttemptNumber = (latestAttempt?.attemptNumber || 0) + 1;
  const created = await createAttemptFromReady({
    ready,
    actorId: input.actorId,
    attemptNumber: nextAttemptNumber,
  });
  return created.request;
}

export async function retryRegistrySubmissionAttempt(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorId: string | null;
  attemptId?: string | null;
}): Promise<{ attempt: RegistrySubmissionAttemptV3; request: RegistrySubmissionRequestV3; ready: RegistrySubmissionReadyV3 }> {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  const ready = await loadDoc<RegistrySubmissionReadyV3>(REGISTRY_SUBMISSION_READY_COLLECTION, draft.draftId);
  if (!ready) {
    throw new Error("A filing package does not exist yet. Prepare a ready package before retrying.");
  }
  if (await isReadyPackageStale(draft.draftId, ready)) {
    throw new Error("Draft has changed since this ready package was prepared. Regenerate the ready package before retrying.");
  }

  const baseAttempt =
    (input.attemptId ? await loadAttemptById(String(input.attemptId)) : await loadLatestAttemptByDraftId(draft.draftId)) || null;
  if (!baseAttempt || baseAttempt.sourceDraftId !== draft.draftId) {
    throw new Error("No filing attempt exists for this draft yet.");
  }
  if (baseAttempt.status === "filed_confirmed") {
    throw new Error("Confirmed filings cannot be retried automatically. Use an explicit re-open workflow first.");
  }
  if (!["rejected", "failed", "cancelled"].includes(baseAttempt.status)) {
    throw new Error("Only rejected, failed, or cancelled attempts can be retried.");
  }

  const latestAttempt = await loadLatestAttemptByDraftId(draft.draftId);
  const nextAttemptNumber = Math.max(latestAttempt?.attemptNumber || 0, baseAttempt.attemptNumber) + 1;
  return createAttemptFromReady({
    ready,
    actorId: input.actorId,
    attemptNumber: nextAttemptNumber,
    note: `Retry created from ${baseAttempt.attemptId}.`,
  }).then((created) => ({
    ...created,
    ready,
  }));
}

export async function updateAttemptLifecycle(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorId: string | null;
  status: FilingTerminalStatus;
  attemptId?: string | null;
  note?: string | null;
  referenceNumbers?: Array<Partial<RegistrySubmissionReferenceNumberV3>> | null;
  evidence?: Array<Partial<RegistrySubmissionEvidenceV3>> | null;
}): Promise<RegistrySubmissionAttemptV3> {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  const attempt =
    (input.attemptId ? await loadAttemptById(String(input.attemptId)) : await loadLatestAttemptByDraftId(draft.draftId)) || null;
  if (!attempt || attempt.sourceDraftId !== draft.draftId) {
    throw new Error("No filing attempt exists for this registry submission yet.");
  }
  const request = await loadDoc<RegistrySubmissionRequestV3>(REGISTRY_SUBMISSION_REQUEST_COLLECTION, attempt.requestId);
  if (!request) {
    throw new Error("The filing request for this attempt could not be found.");
  }

  const now = nowIso();
  const normalizedReferences = (input.referenceNumbers || [])
    .filter((entry) => entry?.type && entry?.value)
    .map((entry) => ({
      type: entry.type as RegistrySubmissionReferenceNumberV3["type"],
      value: String(entry.value || "").trim(),
      label: entry?.label ? String(entry.label) : null,
      recordedAt: entry?.recordedAt ? String(entry.recordedAt) : now,
      recordedBy: entry?.recordedBy ? String(entry.recordedBy) : input.actorId,
    }));
  const normalizedEvidence = (input.evidence || [])
    .filter((entry) => entry?.id && entry?.type)
    .map((entry) => ({
      id: String(entry.id),
      type: entry.type as RegistrySubmissionEvidenceV3["type"],
      label: String(entry.label || entry.id),
      url: entry?.url ? String(entry.url) : null,
      note: entry?.note ? String(entry.note) : null,
      recordedAt: entry?.recordedAt ? String(entry.recordedAt) : now,
      recordedBy: entry?.recordedBy ? String(entry.recordedBy) : input.actorId,
    }));

  const nextRequest: RegistrySubmissionRequestV3 = {
    ...request,
    status: input.status,
    updatedAt: now,
    actor: {
      ...request.actor,
      updatedBy: input.actorId,
    },
    referenceNumbers: mergeReferences(request.referenceNumbers || [], normalizedReferences),
    operatorNotes: input.note || request.operatorNotes || null,
    evidence: mergeEvidence(request.evidence || [], normalizedEvidence),
    audit: {
      events: appendAuditEvent(request.audit.events, {
        actorId: input.actorId,
        type: "filing_status_updated",
        status: input.status,
        note: input.note || null,
      }),
    },
  };

  const existingResult =
    (attempt.resultId ? await loadDoc<RegistrySubmissionResultV3>(REGISTRY_SUBMISSION_RESULT_COLLECTION, attempt.resultId) : null) ||
    null;
  const baseResult =
    existingResult ||
    buildResultFromRequest({
      request: nextRequest,
      status: input.status,
      actorId: input.actorId,
      note: input.note || null,
      referenceNumbers: normalizedReferences,
      evidence: normalizedEvidence,
    });
  const nextResult: RegistrySubmissionResultV3 = {
    ...baseResult,
    attemptId: attempt.attemptId,
    requestId: attempt.requestId,
    readyId: attempt.readyId,
    sourceDraftId: attempt.sourceDraftId,
    propertyId: attempt.propertyId,
    status: input.status,
    updatedAt: now,
    actor: {
      updatedBy: input.actorId,
    },
    confirmedAt: input.status === "filed_confirmed" ? baseResult.confirmedAt || now : baseResult.confirmedAt,
    submittedAt:
      input.status === "filed_pending_confirmation" || input.status === "filed_confirmed"
        ? baseResult.submittedAt || now
        : baseResult.submittedAt,
    rejectedAt: input.status === "rejected" ? baseResult.rejectedAt || now : baseResult.rejectedAt,
    failedAt: input.status === "failed" ? baseResult.failedAt || now : baseResult.failedAt,
    cancelledAt: input.status === "cancelled" ? baseResult.cancelledAt || now : baseResult.cancelledAt,
    referenceNumbers: mergeReferences(baseResult.referenceNumbers || [], normalizedReferences),
    operatorNotes: input.note || baseResult.operatorNotes || null,
    evidence: mergeEvidence(baseResult.evidence || [], normalizedEvidence),
    outcome: {
      message: input.note || baseResult.outcome.message || null,
    },
    audit: {
      events: appendAuditEvent(baseResult.audit.events, {
        actorId: input.actorId,
        type: "filing_result_updated",
        status: input.status,
        note: input.note || null,
      }),
    },
  };

  const nextAttempt: RegistrySubmissionAttemptV3 = {
    ...attempt,
    resultId: nextResult.resultId,
    status: input.status,
    updatedAt: now,
    updatedBy: input.actorId,
    referenceNumbers: mergeReferences(attempt.referenceNumbers || [], normalizedReferences),
    operatorNotes: input.note || attempt.operatorNotes || null,
    evidence: mergeEvidence(attempt.evidence || [], normalizedEvidence),
    audit: {
      events: appendAuditEvent(attempt.audit.events, {
        actorId: input.actorId,
        type: "filing_attempt_updated",
        status: input.status,
        note: input.note || null,
      }),
    },
  };

  await Promise.all([
    db.collection(REGISTRY_SUBMISSION_REQUEST_COLLECTION).doc(nextRequest.requestId).set(
      {
        ...nextRequest,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.collection(REGISTRY_SUBMISSION_RESULT_COLLECTION).doc(nextResult.resultId).set(
      {
        ...nextResult,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.collection(REGISTRY_SUBMISSION_ATTEMPT_COLLECTION).doc(nextAttempt.attemptId).set(
      {
        ...nextAttempt,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  return nextAttempt;
}

export async function updateRegistrySubmissionFilingLifecycle(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorId: string | null;
  status: FilingTerminalStatus;
  attemptId?: string | null;
  note?: string | null;
  referenceNumbers?: Array<Partial<RegistrySubmissionReferenceNumberV3>> | null;
  evidence?: Array<Partial<RegistrySubmissionEvidenceV3>> | null;
}): Promise<RegistrySubmissionFilingSummaryV3> {
  const attempt = await updateAttemptLifecycle(input);
  return buildFilingSummary(attempt.sourceDraftId);
}
