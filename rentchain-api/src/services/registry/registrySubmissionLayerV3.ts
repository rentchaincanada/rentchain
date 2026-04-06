import { db, FieldValue } from "../../config/firebase";
import { halifaxRentalRegistryManualPortalAdapter } from "./adapters/halifaxRentalRegistryManualPortalAdapter";
import { loadPropertyRegistrySubmissionDraft } from "./halifaxRegistrySubmissionService";
import { nowIso } from "./schemas/registrySchemaCommon";
import { resolveRegistrySchemaForProperty, resolveRegistrySchemaSummaryByKey } from "./schemas/registrySchemaResolver";
import { validateRegistrySubmissionDraftV2 } from "./schemas/registrySubmissionDraftV2";
import type { RegistrySubmissionDraftV2 } from "./schemas/registrySchemaTypes";
import type {
  RegistryFilingAdapter,
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
export const REGISTRY_SUBMISSION_REQUEST_COLLECTION = "propertyRegistrySubmissionRequestsV3";
export const REGISTRY_SUBMISSION_RESULT_COLLECTION = "propertyRegistrySubmissionResultsV3";

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
  const parts = [
    contact.name,
    contact.company,
    contact.email,
    contact.phone,
    formatAddress(contact.address),
  ].filter(Boolean);
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

export function buildRegistrySubmissionReadyV3FromDraft(draft: RegistrySubmissionDraftV2): RegistrySubmissionReadyV3 {
  const schema = resolveRegistrySchemaSummaryByKey(draft.context.schemaKey) || resolveRegistrySchemaForProperty({
    country: draft.context.jurisdiction.country,
    province: draft.context.jurisdiction.province,
    city: draft.context.jurisdiction.municipality,
  });
  const validation = validateRegistrySubmissionDraftV2({ draft, schema });
  const adapter = resolveFilingAdapter(draft);
  const now = nowIso();
  const ready: RegistrySubmissionReadyV3 = {
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
  return ready;
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
  return {
    ...request,
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

function buildResultFromRequest(input: {
  request: RegistrySubmissionRequestV3;
  status: Extract<
    RegistrySubmissionLifecycleStatus,
    "filed_pending_confirmation" | "filed_confirmed" | "rejected" | "failed" | "cancelled"
  >;
  actorId: string | null;
  note?: string | null;
  referenceNumbers?: RegistrySubmissionReferenceNumberV3[];
  evidence?: RegistrySubmissionEvidenceV3[];
}): RegistrySubmissionResultV3 {
  const now = nowIso();
  return {
    schemaVersion: 3,
    resultId: `${input.request.requestId}__result`,
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

export async function loadRegistrySubmissionFilingSummaryByDraftId(
  draftId: string
): Promise<RegistrySubmissionFilingSummaryV3> {
  const [ready, request, result] = await Promise.all([
    loadDoc<RegistrySubmissionReadyV3>(REGISTRY_SUBMISSION_READY_COLLECTION, draftId),
    loadDoc<RegistrySubmissionRequestV3>(REGISTRY_SUBMISSION_REQUEST_COLLECTION, draftId),
    loadDoc<RegistrySubmissionResultV3>(REGISTRY_SUBMISSION_RESULT_COLLECTION, draftId),
  ]);

  return {
    ready,
    request,
    result,
    currentStatus: result?.status || request?.status || ready?.status || null,
  };
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

export async function createRegistrySubmissionFilingRequest(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorId: string | null;
}): Promise<RegistrySubmissionRequestV3> {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  const ready =
    (await loadDoc<RegistrySubmissionReadyV3>(REGISTRY_SUBMISSION_READY_COLLECTION, draft.draftId)) ||
    (await createRegistrySubmissionReadyPackage(input));
  if (ready.status !== "ready_to_file") {
    throw new Error("Registry submission filing request cannot be created until the draft is ready to file.");
  }
  const request = buildRegistrySubmissionFilingRequestFromReady(ready, input.actorId);
  await db.collection(REGISTRY_SUBMISSION_REQUEST_COLLECTION).doc(draft.draftId).set(
    {
      ...request,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return request;
}

export async function updateRegistrySubmissionFilingLifecycle(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorId: string | null;
  status: Extract<
    RegistrySubmissionLifecycleStatus,
    "filed_pending_confirmation" | "filed_confirmed" | "rejected" | "failed" | "cancelled"
  >;
  note?: string | null;
  referenceNumbers?: Array<Partial<RegistrySubmissionReferenceNumberV3>> | null;
  evidence?: Array<Partial<RegistrySubmissionEvidenceV3>> | null;
}): Promise<RegistrySubmissionFilingSummaryV3> {
  const draft = await loadPropertyRegistrySubmissionDraft(input);
  const request = await loadDoc<RegistrySubmissionRequestV3>(REGISTRY_SUBMISSION_REQUEST_COLLECTION, draft.draftId);
  if (!request) {
    throw new Error("No filing request exists for this registry submission yet.");
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

  const existingResult = await loadDoc<RegistrySubmissionResultV3>(REGISTRY_SUBMISSION_RESULT_COLLECTION, draft.draftId);
  const baseResult = existingResult || buildResultFromRequest({
    request: nextRequest,
    status: input.status,
    actorId: input.actorId,
    note: input.note || null,
    referenceNumbers: normalizedReferences,
    evidence: normalizedEvidence,
  });
  const nextResult: RegistrySubmissionResultV3 = {
    ...baseResult,
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

  await Promise.all([
    db.collection(REGISTRY_SUBMISSION_REQUEST_COLLECTION).doc(draft.draftId).set(
      {
        ...nextRequest,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.collection(REGISTRY_SUBMISSION_RESULT_COLLECTION).doc(draft.draftId).set(
      {
        ...nextResult,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  return {
    ready: await loadDoc<RegistrySubmissionReadyV3>(REGISTRY_SUBMISSION_READY_COLLECTION, draft.draftId),
    request: nextRequest,
    result: nextResult,
    currentStatus: input.status,
  };
}
