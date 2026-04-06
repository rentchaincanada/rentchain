import { db, FieldValue } from "../../config/firebase";
import {
  applyFieldMetaOverrides,
  asBooleanOrNull,
  asString,
  buildDefaultBuilding,
  determineStatus,
  evolveConsent,
  firstString,
  normalizeAddress,
  normalizeBuilding,
  normalizeContact,
  normalizeDeclarations,
  nowIso,
} from "./schemas/registrySchemaCommon";
import { HALIFAX_FIELD_MAP, HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY } from "./schemas/halifaxRentalRegistrySchema";
import { resolveRegistrySchemaForProperty } from "./schemas/registrySchemaResolver";
import {
  buildRegistrySubmissionDraftV2,
  exportRegistrySubmissionDraftV2,
  hydrateRegistryAssistantUiState,
  legacyDeclarationsFromDraft,
  migrateRegistryDraftToV2,
  validateRegistrySubmissionDraftV2,
} from "./schemas/registrySubmissionDraftV2";
import type {
  PropertyRegistryReadiness,
  RegistryAddress,
  RegistryBuildingDraft,
  RegistryContact,
  RegistryFieldMapEntry,
  RegistryFieldMetaEntry,
  RegistrySchemaDefinition,
  RegistrySchemaSummary,
  RegistrySubmissionConsent,
  RegistrySubmissionDeclarations,
  RegistrySubmissionDraft,
  RegistrySubmissionFieldMeta,
  RegistrySubmissionFieldValues,
  RegistrySubmissionSaveInput,
  RegistrySubmissionStatus,
  RegistrySubmissionValidation,
  RegistryValidationItem,
} from "./schemas/registrySchemaTypes";

// Canonical persisted draft store for the schema-driven submission assistant.
export const REGISTRY_SUBMISSION_DRAFT_COLLECTION = "propertyRegistrySubmissions";
export const HALIFAX_REGISTRY_SUBMISSION_COLLECTION = REGISTRY_SUBMISSION_DRAFT_COLLECTION;

export type HalifaxSubmissionStatus = RegistrySubmissionStatus;
export type HalifaxAddress = RegistryAddress;
export type HalifaxContact = RegistryContact;
export type HalifaxBuildingDraft = RegistryBuildingDraft;
export type HalifaxSubmissionFieldValues = RegistrySubmissionFieldValues;
export type HalifaxSubmissionDeclarations = RegistrySubmissionDeclarations;
export type HalifaxSubmissionConsent = RegistrySubmissionConsent;
export type HalifaxFieldMetaEntry = RegistryFieldMetaEntry;
export type HalifaxSubmissionFieldMeta = RegistrySubmissionFieldMeta;
export type HalifaxValidationItem = RegistryValidationItem;
export type HalifaxSubmissionValidation = RegistrySubmissionValidation;
export type HalifaxFieldMapEntry = RegistryFieldMapEntry;
export type HalifaxSubmissionDraft = RegistrySubmissionDraft;
export type RegistryReadinessView = PropertyRegistryReadiness;

export { HALIFAX_FIELD_MAP };

async function appendRegistryDraftAuditEvent(input: {
  propertyId: string;
  actorUserId: string | null;
  sourceKey: string;
  action:
    | "registry_submission_preparation_authorized"
    | "registry_submission_draft_saved"
    | "registry_submission_declarations_confirmed"
    | "registry_submission_exported";
}) {
  await db.collection("propertyRegistrySubmissionAudit").doc().set({
    propertyId: input.propertyId,
    actorUserId: input.actorUserId,
    sourceKey: input.sourceKey,
    action: input.action,
    createdAt: nowIso(),
    createdAtServer: FieldValue.serverTimestamp(),
  });
}

function resolveRegistryDraftId(propertyId: string, schema: RegistrySchemaDefinition) {
  return `${propertyId}__${schema.sourceKey}`;
}

function buildResolvedRegistryDraft(input: {
  schema: RegistrySchemaDefinition;
  propertyId: string;
  landlordId: string | null;
  persisted: Partial<RegistrySubmissionDraft> | null;
  prefilled: {
    fieldValues: RegistrySubmissionFieldValues;
    fieldMeta: RegistrySubmissionFieldMeta;
    declarations: RegistrySubmissionDeclarations;
    consent: RegistrySubmissionConsent;
  };
  updatedBy?: string | null;
}): RegistrySubmissionDraft {
  const { schema, propertyId, landlordId, persisted, prefilled } = input;
  const migrated = persisted ? migrateRegistryDraftToV2(persisted) : null;
  const validation = schema.validate(prefilled);
  const status = determineStatus({
    validation,
    fieldValues: prefilled.fieldValues,
    declarations: prefilled.declarations,
    consent: prefilled.consent,
    previousStatus: migrated?.status || null,
  });

  return buildRegistrySubmissionDraftV2({
    schema,
    draftId: resolveRegistryDraftId(propertyId, schema),
    propertyId,
    landlordId,
    previous: migrated,
    fieldValues: prefilled.fieldValues,
    fieldMeta: prefilled.fieldMeta,
    consent: prefilled.consent,
    declarations: prefilled.declarations,
    status,
    updatedBy: input.updatedBy || migrated?.actor.updatedBy || null,
    migratedFromVersion: migrated?.audit.migratedFromVersion ?? null,
  });
}

async function loadRegistryDraftProfileContext(landlordId: string | null) {
  const normalizedLandlordId = asString(landlordId);
  const [landlordSnap, userSnap, accountSnap] = await Promise.all([
    normalizedLandlordId ? db.collection("landlords").doc(normalizedLandlordId).get() : Promise.resolve(null as any),
    normalizedLandlordId ? db.collection("users").doc(normalizedLandlordId).get() : Promise.resolve(null as any),
    normalizedLandlordId ? db.collection("accounts").doc(normalizedLandlordId).get() : Promise.resolve(null as any),
  ]);

  return {
    landlordProfile: landlordSnap?.exists ? (landlordSnap.data() as any) : null,
    userAccount: {
      ...(userSnap?.exists ? (userSnap.data() as any) : {}),
      ...(accountSnap?.exists ? (accountSnap.data() as any) : {}),
    },
  };
}

export async function loadRegistrySubmissionDraft(input: {
  property: Record<string, any>;
  landlordId: string | null;
}): Promise<RegistrySubmissionDraft> {
  const propertyId = String(input.property?.id || "").trim();
  const landlordId = asString(input.landlordId);
  const schema = resolveRegistrySchemaForProperty(input.property);
  const docId = resolveRegistryDraftId(propertyId, schema);

  const [draftSnap, profileContext] = await Promise.all([
    db.collection(REGISTRY_SUBMISSION_DRAFT_COLLECTION).doc(docId).get(),
    loadRegistryDraftProfileContext(landlordId),
  ]);

  const persisted = draftSnap?.exists ? ({ draftId: draftSnap.id, ...(draftSnap.data() as any) } as Partial<RegistrySubmissionDraft>) : null;
  const prefilled = schema.buildPrefill({
    property: input.property,
    landlordProfile: profileContext.landlordProfile,
    userAccount: profileContext.userAccount,
    persisted,
  });

  return buildResolvedRegistryDraft({
    schema,
    propertyId,
    landlordId,
    persisted,
    prefilled,
  });
}

export async function saveRegistrySubmissionDraft(
  input: RegistrySubmissionSaveInput
): Promise<RegistrySubmissionDraft> {
  const current = await loadRegistrySubmissionDraft({
    property: input.property,
    landlordId: input.landlordId,
  });
  const schema = resolveRegistrySchemaForProperty(input.property);
  const actor = asString(input.actorUserId || input.actorEmail);
  const incomingDraft = input.draft ? hydrateRegistryAssistantUiState(input.draft) : null;
  const currentFieldValues = current.form.fieldValues;
  const nextFieldValues: RegistrySubmissionFieldValues = incomingDraft
    ? incomingDraft.form.fieldValues
    : {
        ...currentFieldValues,
        ...(input.fieldValues || {}),
        siteAddress: normalizeAddress(input.fieldValues?.siteAddress, currentFieldValues.siteAddress),
        owner: normalizeContact(input.fieldValues?.owner, currentFieldValues.owner),
        primaryContact: normalizeContact(input.fieldValues?.primaryContact, currentFieldValues.primaryContact),
        buildings: (() => {
          const nextBuildings = Array.isArray(input.fieldValues?.buildings)
            ? input.fieldValues?.buildings
            : currentFieldValues.buildings;
          return (nextBuildings || [])
            .slice(0, 5)
            .map((building, index) =>
              normalizeBuilding(building, currentFieldValues.buildings[index] || buildDefaultBuilding(input.property))
            );
        })(),
        propertyIdentifierPid:
          asString(input.fieldValues?.propertyIdentifierPid) || currentFieldValues.propertyIdentifierPid || null,
        primaryContactSameAsOwner:
          asBooleanOrNull(input.fieldValues?.primaryContactSameAsOwner) ?? currentFieldValues.primaryContactSameAsOwner,
        moreThanFiveBuildings:
          asBooleanOrNull(input.fieldValues?.moreThanFiveBuildings) ?? currentFieldValues.moreThanFiveBuildings,
        propertyDescription: asString(input.fieldValues?.propertyDescription) || currentFieldValues.propertyDescription || null,
      };
  const nextDeclarations = incomingDraft
    ? legacyDeclarationsFromDraft(incomingDraft)
    : normalizeDeclarations(input.declarations, legacyDeclarationsFromDraft(current));
  const nextConsent = incomingDraft
    ? evolveConsent({
        current: current.submission.consent,
        incoming: incomingDraft.submission.consent,
        declarations: nextDeclarations,
        actor,
      })
    : evolveConsent({
        current: current.submission.consent,
        incoming: input.consent,
        declarations: nextDeclarations,
        actor,
      });
  const nextFieldMeta = incomingDraft
    ? applyFieldMetaOverrides(current.form.fieldMeta, incomingDraft.form.fieldMeta)
    : applyFieldMetaOverrides(
        schema.buildPrefill({
          property: input.property,
          landlordProfile: null,
          userAccount: null,
          persisted: current,
        }).fieldMeta,
        input.fieldMeta
      );
  const validation = schema.validate({
    fieldValues: nextFieldValues,
    declarations: nextDeclarations,
    consent: nextConsent,
  });
  const next = buildRegistrySubmissionDraftV2({
    schema,
    draftId: current.draftId,
    propertyId: current.context.propertyId,
    landlordId: current.actor.landlordId,
    previous: current,
    fieldValues: nextFieldValues,
    fieldMeta: nextFieldMeta,
    consent: nextConsent,
    declarations: nextDeclarations,
    status:
      input.status ||
      incomingDraft?.status ||
      determineStatus({
        validation,
        fieldValues: nextFieldValues,
        declarations: nextDeclarations,
        consent: nextConsent,
        previousStatus: current.status,
      }),
    updatedBy: actor,
    migratedFromVersion: current.audit.migratedFromVersion,
  });

  await db.collection(REGISTRY_SUBMISSION_DRAFT_COLLECTION).doc(current.draftId).set(
    {
      ...next,
      review: {
        ...next.review,
        validation: validateRegistrySubmissionDraftV2({ draft: next, schema }),
      },
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (!current.submission.consent.preparationAuthorized && next.submission.consent.preparationAuthorized) {
    await appendRegistryDraftAuditEvent({
      propertyId: current.context.propertyId,
      actorUserId: asString(input.actorUserId),
      sourceKey: next.context.sourceKey,
      action: "registry_submission_preparation_authorized",
    });
  }
  if (!current.submission.consent.declarationsConfirmed && next.submission.consent.declarationsConfirmed) {
    await appendRegistryDraftAuditEvent({
      propertyId: current.context.propertyId,
      actorUserId: asString(input.actorUserId),
      sourceKey: next.context.sourceKey,
      action: "registry_submission_declarations_confirmed",
    });
  }
  await appendRegistryDraftAuditEvent({
    propertyId: current.context.propertyId,
    actorUserId: asString(input.actorUserId),
    sourceKey: next.context.sourceKey,
    action: "registry_submission_draft_saved",
  });

  return next;
}

export async function markRegistrySubmissionDraftExported(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorUserId: string | null;
  actorEmail?: string | null;
}) {
  const current = await loadRegistrySubmissionDraft({
    property: input.property,
    landlordId: input.landlordId,
  });
  const exportedAt = nowIso();
  if (!current.review.validation.exportReady) {
    throw new Error("Registry submission draft is not ready for export yet.");
  }
  const next = exportRegistrySubmissionDraftV2({
    ...current,
    status: "exported",
    timestamps: {
      ...current.timestamps,
      exportedAt,
      updatedAt: exportedAt,
      lastReviewedAt: exportedAt,
    },
    submission: {
      ...current.submission,
      consent: {
        ...current.submission.consent,
        finalReviewConfirmed: true,
        finalReviewConfirmedAt: current.submission.consent.finalReviewConfirmedAt || exportedAt,
      },
    },
    actor: {
      ...current.actor,
      updatedBy: asString(input.actorUserId || input.actorEmail) || null,
    },
  });

  await db.collection(REGISTRY_SUBMISSION_DRAFT_COLLECTION).doc(current.draftId).set(
    {
      ...next,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await appendRegistryDraftAuditEvent({
    propertyId: current.context.propertyId,
    actorUserId: asString(input.actorUserId),
    sourceKey: current.context.sourceKey,
    action: "registry_submission_exported",
  });

  return next;
}

export function buildRegistrySubmissionExportPayload(input: {
  property: Record<string, any>;
  submission: RegistrySubmissionDraft;
}) {
  return exportRegistrySubmissionDraftV2(input.submission);
}

export function getRegistrySchemaSummaryForProperty(property: Record<string, any>): RegistrySchemaSummary {
  const schema = resolveRegistrySchemaForProperty(property);
  return {
    schemaKey: schema.schemaKey,
    sourceKey: schema.sourceKey,
    label: schema.label,
    mode: schema.mode,
    jurisdiction: schema.jurisdiction,
  };
}

function categorizeMissingItem(item: RegistryValidationItem): PropertyRegistryReadiness["topMissingItems"][number]["category"] {
  if (item.path.startsWith("consent.") || item.path.startsWith("declarations.")) {
    return "declarations_consent";
  }
  if (item.path.includes("owner") || item.path.includes("primaryContact")) {
    return "owner_contact";
  }
  if (item.path.includes("siteAddress") || item.path.includes("propertyIdentifierPid")) {
    return "property_identity";
  }
  if (item.path.includes("fireLifeSafetySystems") || item.path.includes("amenities") || item.path.includes("yearConstructed")) {
    return "safety_compliance";
  }
  return "building_details";
}

function headlineForCategory(category: PropertyRegistryReadiness["topMissingItems"][number]["category"]) {
  switch (category) {
    case "owner_contact":
      return "Owner or contact details are incomplete";
    case "property_identity":
      return "Property identity details still need review";
    case "building_details":
      return "Building details are incomplete";
    case "safety_compliance":
      return "Safety and compliance details are incomplete";
    case "declarations_consent":
    default:
      return "Consent or declarations still need confirmation";
  }
}

function summarizeMissingItems(validation: RegistrySubmissionValidation) {
  const grouped = new Map<string, { category: PropertyRegistryReadiness["topMissingItems"][number]["category"]; count: number }>();
  [...validation.missingRequiredFields, ...validation.missingConsentItems].forEach((item) => {
    const category = categorizeMissingItem(item);
    const current = grouped.get(category);
    grouped.set(category, {
      category,
      count: (current?.count || 0) + 1,
    });
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item) => ({
      category: item.category,
      headline: headlineForCategory(item.category),
      count: item.count,
    }));
}

function assistantCopyForSchema(input: { schema: RegistrySchemaSummary; readinessStatus: PropertyRegistryReadiness["readinessStatus"] }) {
  if (input.schema.mode === "registry_ready_fallback") {
    return {
      title: "Registry-ready compliance profile",
      description:
        "Prepare a registry-ready compliance profile for this property. This jurisdiction does not currently use the Halifax municipal registry workflow.",
      ctaLabel:
        input.readinessStatus === "registry_ready" ? "Review compliance draft" : "Complete registry-ready profile",
    };
  }
  return {
    title: "Halifax registration draft",
    description:
      "Prepare or review the Halifax rental registry draft using RentChain-prefilled property and owner data.",
    ctaLabel:
      input.readinessStatus === "registry_ready" ? "Review Halifax draft" : "Complete Halifax registration draft",
  };
}

export function buildRegistryReadinessSummary(input: {
  property: Record<string, any>;
  submission: RegistrySubmissionDraft;
  projection: {
    registryStatus?: "verified" | "pending_review" | "possible_mismatch" | "manual_review" | "not_found" | null;
    summary?: string | null;
  } | null;
  coverageAvailable: boolean;
  coverageMessage: string | null;
  propertyPid: string | null;
}): PropertyRegistryReadiness {
  const schema = getRegistrySchemaSummaryForProperty(input.property);
  const projectionStatus = input.coverageAvailable
    ? input.projection?.registryStatus || "not_found"
    : "not_applicable";
  let readinessStatus: PropertyRegistryReadiness["readinessStatus"];
  if (projectionStatus === "verified") {
    readinessStatus = "verified";
  } else if (projectionStatus === "possible_mismatch") {
    readinessStatus = "possible_mismatch";
  } else if (projectionStatus === "manual_review" || projectionStatus === "pending_review") {
    readinessStatus = "manual_review_in_progress";
  } else if (input.submission.review.validation.exportReady) {
    readinessStatus = "registry_ready";
  } else if (schema.mode === "registry_ready_fallback" && !input.coverageAvailable) {
    readinessStatus = "incomplete";
  } else {
    readinessStatus = "incomplete";
  }
  if (projectionStatus === "not_found" && input.submission.review.validation.exportReady) {
    readinessStatus = "registry_ready";
  } else if (projectionStatus === "not_found" && !input.submission.review.validation.exportReady && input.coverageAvailable) {
    readinessStatus = "no_public_match";
  }

  let nextRecommendedAction: PropertyRegistryReadiness["nextRecommendedAction"];
  if (readinessStatus === "verified") {
    nextRecommendedAction = "view_verified_details";
  } else if (readinessStatus === "possible_mismatch") {
    nextRecommendedAction = "review_possible_match";
  } else if (readinessStatus === "manual_review_in_progress") {
    nextRecommendedAction = "resolve_mismatch";
  } else if (input.submission.review.validation.exportReady) {
    nextRecommendedAction = "export_ready_draft";
  } else if (!input.propertyPid) {
    nextRecommendedAction = "add_pid";
  } else if (
    input.submission.review.validation.missingRequiredFields.length ||
    input.submission.review.validation.missingConsentItems.length
  ) {
    nextRecommendedAction = "complete_missing_fields";
  } else {
    nextRecommendedAction = "prepare_registry_submission";
  }

  return {
    schemaKey: input.submission.context.schemaKey,
    schemaLabel: input.submission.context.schemaLabel,
    jurisdiction: input.submission.context.jurisdiction,
    mode: input.submission.context.mode,
    readinessStatus,
    readinessScore: input.submission.review.validation.readinessScore,
    completionPercent: input.submission.review.validation.completionPercent,
    exportReady: input.submission.review.validation.exportReady,
    missingRequiredFields: input.submission.review.validation.missingRequiredFields,
    missingConsentItems: input.submission.review.validation.missingConsentItems,
    warnings: input.submission.review.validation.warnings,
    topMissingItems: summarizeMissingItems(input.submission.review.validation),
    nextRecommendedAction,
    currentRegistryState: {
      status: projectionStatus,
      summary:
        input.projection?.summary ||
        (projectionStatus === "not_applicable"
          ? "No public registry workflow is currently connected for this jurisdiction."
          : "No public match found."),
      publicRegistryAvailable: input.coverageAvailable,
    },
    registryAvailabilityNote: input.coverageMessage,
    assistant: assistantCopyForSchema({ schema, readinessStatus }),
  };
}

export async function loadHalifaxRegistrySubmissionDraft(input: {
  property: Record<string, any>;
  landlordId: string | null;
}): Promise<HalifaxSubmissionDraft> {
  return loadRegistrySubmissionDraft(input);
}

export async function saveHalifaxRegistrySubmissionDraft(
  input: RegistrySubmissionSaveInput
): Promise<HalifaxSubmissionDraft> {
  return saveRegistrySubmissionDraft(input);
}

export async function markHalifaxRegistrySubmissionExported(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorUserId: string | null;
  actorEmail?: string | null;
}) {
  const next = await markRegistrySubmissionDraftExported(input);
  if (next.context.sourceKey !== HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY) {
    throw new Error("Registry submission draft is not a Halifax draft.");
  }
  return next;
}

export function buildHalifaxRegistrySubmissionExportPayload(input: {
  property: Record<string, any>;
  submission: HalifaxSubmissionDraft;
}) {
  return buildRegistrySubmissionExportPayload(input);
}

export function buildHalifaxRegistrySubmissionPrefill(input: Parameters<RegistrySchemaDefinition["buildPrefill"]>[0]) {
  const schema = resolveRegistrySchemaForProperty(input.property);
  return schema.buildPrefill(input);
}

export function validateHalifaxRegistrySubmissionDraft(input: {
  fieldValues: HalifaxSubmissionFieldValues;
  declarations: HalifaxSubmissionDeclarations;
  consent: HalifaxSubmissionConsent;
}) {
  const schema = resolveRegistrySchemaForProperty({
    country: "CA",
    province: "NS",
    city: "Halifax",
  });
  return schema.validate(input);
}

export {
  buildRegistryReadinessSummary as buildPropertyRegistryReadiness,
  buildRegistrySubmissionDraftV2,
  buildRegistrySubmissionExportPayload as buildPropertyRegistrySubmissionExportPayload,
  exportRegistrySubmissionDraftV2,
  hydrateRegistryAssistantUiState,
  loadRegistrySubmissionDraft as loadPropertyRegistrySubmissionDraft,
  migrateRegistryDraftToV2,
  markRegistrySubmissionDraftExported as markPropertyRegistrySubmissionExported,
  saveRegistrySubmissionDraft as savePropertyRegistrySubmissionDraft,
  validateRegistrySubmissionDraftV2,
};
