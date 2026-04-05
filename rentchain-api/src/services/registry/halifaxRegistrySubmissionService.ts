import { db, FieldValue } from "../../config/firebase";
import {
  applyFieldMetaOverrides,
  asBooleanOrNull,
  asString,
  buildDefaultBuilding,
  determineStatus,
  evolveConsent,
  normalizeAddress,
  normalizeBuilding,
  normalizeContact,
  normalizeDeclarations,
  nowIso,
} from "./schemas/registrySchemaCommon";
import { HALIFAX_FIELD_MAP, HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY } from "./schemas/halifaxRentalRegistrySchema";
import { resolveRegistrySchemaForProperty } from "./schemas/registrySchemaResolver";
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

export const HALIFAX_REGISTRY_SUBMISSION_COLLECTION = "propertyRegistrySubmissions";

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

export const HALIFAX_FIELD_MAP_COMPAT = HALIFAX_FIELD_MAP;
export const HALIFAX_FIELD_MAP_ALIAS = HALIFAX_FIELD_MAP;
export const HALIFAX_FIELD_MAP_EXPORT = HALIFAX_FIELD_MAP;
export { HALIFAX_FIELD_MAP };

async function appendSubmissionAuditEvent(input: {
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

function resolveDraftId(propertyId: string, schema: RegistrySchemaDefinition) {
  return `${propertyId}__${schema.sourceKey}`;
}

function applyResolvedSchemaDraft(input: {
  schema: RegistrySchemaDefinition;
  propertyId: string;
  landlordId: string | null;
  persisted: Partial<RegistrySubmissionDraft> | null;
  prefilled: Pick<RegistrySubmissionDraft, "fieldValues" | "fieldMeta" | "declarations" | "consent">;
}): RegistrySubmissionDraft {
  const { schema, propertyId, landlordId, persisted, prefilled } = input;
  const validation = schema.validate(prefilled);
  const createdAt = asString(persisted?.createdAt) || nowIso();
  const updatedAt = asString(persisted?.updatedAt) || createdAt;

  return {
    id: resolveDraftId(propertyId, schema),
    propertyId,
    landlordId,
    sourceKey: schema.sourceKey,
    schemaKey: schema.schemaKey,
    schemaLabel: schema.label,
    mode: schema.mode,
    jurisdiction: {
      ...schema.jurisdiction,
    },
    status: determineStatus({
      validation,
      fieldValues: prefilled.fieldValues,
      declarations: prefilled.declarations,
      consent: prefilled.consent,
      previousStatus: persisted?.status || null,
    }),
    fieldValues: prefilled.fieldValues,
    fieldMeta: prefilled.fieldMeta,
    declarations: prefilled.declarations,
    consent: prefilled.consent,
    validation,
    exportedAt: asString(persisted?.exportedAt) || null,
    lastReviewedAt: asString(persisted?.lastReviewedAt) || null,
    createdAt,
    updatedAt,
    updatedBy: asString(persisted?.updatedBy) || null,
  };
}

async function loadRegistryProfileContext(landlordId: string | null) {
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

export async function loadPropertyRegistrySubmissionDraft(input: {
  property: Record<string, any>;
  landlordId: string | null;
}): Promise<RegistrySubmissionDraft> {
  const propertyId = String(input.property?.id || "").trim();
  const landlordId = asString(input.landlordId);
  const schema = resolveRegistrySchemaForProperty(input.property);
  const docId = resolveDraftId(propertyId, schema);

  const [draftSnap, profileContext] = await Promise.all([
    db.collection(HALIFAX_REGISTRY_SUBMISSION_COLLECTION).doc(docId).get(),
    loadRegistryProfileContext(landlordId),
  ]);

  const persisted = draftSnap?.exists ? ({ id: draftSnap.id, ...(draftSnap.data() as any) } as Partial<RegistrySubmissionDraft>) : null;
  const prefilled = schema.buildPrefill({
    property: input.property,
    landlordProfile: profileContext.landlordProfile,
    userAccount: profileContext.userAccount,
    persisted,
  });

  return applyResolvedSchemaDraft({
    schema,
    propertyId,
    landlordId,
    persisted,
    prefilled,
  });
}

export async function savePropertyRegistrySubmissionDraft(
  input: RegistrySubmissionSaveInput
): Promise<RegistrySubmissionDraft> {
  const current = await loadPropertyRegistrySubmissionDraft({
    property: input.property,
    landlordId: input.landlordId,
  });
  const schema = resolveRegistrySchemaForProperty(input.property);

  const mergedFieldValues: RegistrySubmissionFieldValues = {
    ...current.fieldValues,
    ...(input.fieldValues || {}),
    siteAddress: normalizeAddress(input.fieldValues?.siteAddress, current.fieldValues.siteAddress),
    owner: normalizeContact(input.fieldValues?.owner, current.fieldValues.owner),
    primaryContact: normalizeContact(input.fieldValues?.primaryContact, current.fieldValues.primaryContact),
    buildings: (() => {
      const nextBuildings = Array.isArray(input.fieldValues?.buildings)
        ? input.fieldValues?.buildings
        : current.fieldValues.buildings;
      return (nextBuildings || [])
        .slice(0, 5)
        .map((building, index) =>
          normalizeBuilding(building, current.fieldValues.buildings[index] || buildDefaultBuilding(input.property))
        );
    })(),
    propertyIdentifierPid: asString(input.fieldValues?.propertyIdentifierPid) || current.fieldValues.propertyIdentifierPid || null,
    primaryContactSameAsOwner:
      asBooleanOrNull(input.fieldValues?.primaryContactSameAsOwner) ?? current.fieldValues.primaryContactSameAsOwner,
    moreThanFiveBuildings:
      asBooleanOrNull(input.fieldValues?.moreThanFiveBuildings) ?? current.fieldValues.moreThanFiveBuildings,
    propertyDescription: asString(input.fieldValues?.propertyDescription) || current.fieldValues.propertyDescription || null,
  };
  const mergedDeclarations = normalizeDeclarations(input.declarations, current.declarations);
  const mergedFieldMeta = applyFieldMetaOverrides(
    schema.buildPrefill({
      property: input.property,
      landlordProfile: null,
      userAccount: null,
      persisted: {
        ...current,
        fieldValues: mergedFieldValues,
        declarations: mergedDeclarations,
        fieldMeta: current.fieldMeta,
      },
    }).fieldMeta,
    input.fieldMeta
  );
  const mergedConsent = evolveConsent({
    current: current.consent,
    incoming: input.consent,
    declarations: mergedDeclarations,
    actor: asString(input.actorUserId || input.actorEmail),
  });
  const validation = schema.validate({
    fieldValues: mergedFieldValues,
    declarations: mergedDeclarations,
    consent: mergedConsent,
  });
  const updatedAt = nowIso();

  const next: RegistrySubmissionDraft = {
    ...current,
    sourceKey: schema.sourceKey,
    schemaKey: schema.schemaKey,
    schemaLabel: schema.label,
    mode: schema.mode,
    jurisdiction: { ...schema.jurisdiction },
    fieldValues: mergedFieldValues,
    fieldMeta: mergedFieldMeta,
    declarations: mergedDeclarations,
    consent: mergedConsent,
    validation,
    status:
      input.status ||
      determineStatus({
        validation,
        fieldValues: mergedFieldValues,
        declarations: mergedDeclarations,
        consent: mergedConsent,
        previousStatus: current.status,
      }),
    updatedAt,
    updatedBy: asString(input.actorUserId || input.actorEmail) || null,
    lastReviewedAt: updatedAt,
  };

  await db.collection(HALIFAX_REGISTRY_SUBMISSION_COLLECTION).doc(current.id).set(
    {
      propertyId: current.propertyId,
      landlordId: current.landlordId,
      sourceKey: next.sourceKey,
      schemaKey: next.schemaKey,
      schemaLabel: next.schemaLabel,
      mode: next.mode,
      jurisdiction: next.jurisdiction,
      status: next.status,
      fieldValues: next.fieldValues,
      fieldMeta: next.fieldMeta,
      declarations: next.declarations,
      consent: next.consent,
      validation: next.validation,
      exportedAt: next.exportedAt,
      lastReviewedAt: next.lastReviewedAt,
      createdAt: current.createdAt,
      updatedAt: next.updatedAt,
      updatedAtServer: FieldValue.serverTimestamp(),
      updatedBy: next.updatedBy,
    },
    { merge: true }
  );

  if (!current.consent.preparationAuthorized && next.consent.preparationAuthorized) {
    await appendSubmissionAuditEvent({
      propertyId: current.propertyId,
      actorUserId: asString(input.actorUserId),
      sourceKey: next.sourceKey,
      action: "registry_submission_preparation_authorized",
    });
  }
  if (!current.consent.declarationsConfirmed && next.consent.declarationsConfirmed) {
    await appendSubmissionAuditEvent({
      propertyId: current.propertyId,
      actorUserId: asString(input.actorUserId),
      sourceKey: next.sourceKey,
      action: "registry_submission_declarations_confirmed",
    });
  }
  await appendSubmissionAuditEvent({
    propertyId: current.propertyId,
    actorUserId: asString(input.actorUserId),
    sourceKey: next.sourceKey,
    action: "registry_submission_draft_saved",
  });

  return next;
}

export async function markPropertyRegistrySubmissionExported(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorUserId: string | null;
  actorEmail?: string | null;
}) {
  const current = await loadPropertyRegistrySubmissionDraft({
    property: input.property,
    landlordId: input.landlordId,
  });
  const exportedAt = nowIso();
  if (!current.validation.exportReady) {
    throw new Error("Registry submission draft is not ready for export yet.");
  }
  const nextStatus: RegistrySubmissionStatus = "exported";
  const nextConsent = {
    ...current.consent,
    finalReviewConfirmed: true,
    finalReviewConfirmedAt: current.consent.finalReviewConfirmedAt || exportedAt,
  };

  await db.collection(HALIFAX_REGISTRY_SUBMISSION_COLLECTION).doc(current.id).set(
    {
      exportedAt,
      status: nextStatus,
      consent: nextConsent,
      updatedAt: exportedAt,
      updatedAtServer: FieldValue.serverTimestamp(),
      updatedBy: asString(input.actorUserId || input.actorEmail) || null,
    },
    { merge: true }
  );

  await appendSubmissionAuditEvent({
    propertyId: current.propertyId,
    actorUserId: asString(input.actorUserId),
    sourceKey: current.sourceKey,
    action: "registry_submission_exported",
  });

  return {
    ...current,
    status: nextStatus,
    consent: nextConsent,
    exportedAt,
    updatedAt: exportedAt,
    updatedBy: asString(input.actorUserId || input.actorEmail) || null,
  };
}

export function buildPropertyRegistrySubmissionExportPayload(input: {
  property: Record<string, any>;
  submission: RegistrySubmissionDraft;
}) {
  const schema = resolveRegistrySchemaForProperty(input.property);
  return schema.buildExportPayload(input);
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

export function buildPropertyRegistryReadiness(input: {
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
  } else if (input.submission.validation.exportReady) {
    readinessStatus = "registry_ready";
  } else if (schema.mode === "registry_ready_fallback" && !input.coverageAvailable) {
    readinessStatus = "incomplete";
  } else {
    readinessStatus = "incomplete";
  }
  if (projectionStatus === "not_found" && input.submission.validation.exportReady) {
    readinessStatus = "registry_ready";
  } else if (projectionStatus === "not_found" && !input.submission.validation.exportReady && input.coverageAvailable) {
    readinessStatus = "no_public_match";
  }

  let nextRecommendedAction: PropertyRegistryReadiness["nextRecommendedAction"];
  if (readinessStatus === "verified") {
    nextRecommendedAction = "view_verified_details";
  } else if (readinessStatus === "possible_mismatch") {
    nextRecommendedAction = "review_possible_match";
  } else if (readinessStatus === "manual_review_in_progress") {
    nextRecommendedAction = "resolve_mismatch";
  } else if (input.submission.validation.exportReady) {
    nextRecommendedAction = "export_ready_draft";
  } else if (!input.propertyPid) {
    nextRecommendedAction = "add_pid";
  } else if (input.submission.validation.missingRequiredFields.length || input.submission.validation.missingConsentItems.length) {
    nextRecommendedAction = "complete_missing_fields";
  } else {
    nextRecommendedAction = "prepare_registry_submission";
  }

  return {
    schemaKey: input.submission.schemaKey,
    schemaLabel: input.submission.schemaLabel,
    jurisdiction: input.submission.jurisdiction,
    mode: input.submission.mode,
    readinessStatus,
    readinessScore: input.submission.validation.readinessScore,
    completionPercent: input.submission.validation.completionPercent,
    exportReady: input.submission.validation.exportReady,
    missingRequiredFields: input.submission.validation.missingRequiredFields,
    missingConsentItems: input.submission.validation.missingConsentItems,
    warnings: input.submission.validation.warnings,
    topMissingItems: summarizeMissingItems(input.submission.validation),
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
  return loadPropertyRegistrySubmissionDraft(input);
}

export async function saveHalifaxRegistrySubmissionDraft(
  input: RegistrySubmissionSaveInput
): Promise<HalifaxSubmissionDraft> {
  return savePropertyRegistrySubmissionDraft(input);
}

export async function markHalifaxRegistrySubmissionExported(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorUserId: string | null;
  actorEmail?: string | null;
}) {
  const next = await markPropertyRegistrySubmissionExported(input);
  if (next.sourceKey !== HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY) {
    throw new Error("Registry submission draft is not a Halifax draft.");
  }
  return next;
}

export function buildHalifaxRegistrySubmissionExportPayload(input: {
  property: Record<string, any>;
  submission: HalifaxSubmissionDraft;
}) {
  return buildPropertyRegistrySubmissionExportPayload(input);
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
