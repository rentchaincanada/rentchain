import {
  asBooleanOrNull,
  asString,
  normalizeAddress,
  normalizeBuilding,
  normalizeContact,
  nowIso,
} from "./registrySchemaCommon";
import type {
  RegistrySchemaDefinition,
  RegistrySubmissionConsent,
  RegistrySubmissionDeclarationId,
  RegistrySubmissionDeclarationItem,
  RegistrySubmissionDeclarations,
  RegistrySubmissionDraft,
  RegistrySubmissionFieldMeta,
  RegistrySubmissionFieldValues,
  RegistrySubmissionStatus,
  RegistrySubmissionValidation,
} from "./registrySchemaTypes";

const DECLARATION_ORDER: RegistrySubmissionDeclarationId[] = [
  "acknowledged",
  "maintenancePlanConfirmed",
  "ownerDeclarationConfirmed",
  "informationAccurateConfirmed",
];

function assistantTypeForSchema(schema: Pick<RegistrySchemaDefinition, "mode">): RegistrySubmissionDraft["assistantType"] {
  return schema.mode === "registry_ready_fallback"
    ? "registry_ready_compliance_assistant"
    : "halifax_registry_submission_assistant";
}

function declarationLabelMap(
  assistantType: RegistrySubmissionDraft["assistantType"]
): Record<RegistrySubmissionDeclarationId, string> {
  return {
    acknowledged:
      assistantType === "registry_ready_compliance_assistant"
        ? "I understand this draft is prepared by RentChain for review and export and is not automatically submitted to a municipality."
        : "I understand this draft is prepared by RentChain for review and export and is not automatically submitted to Halifax.",
    maintenancePlanConfirmed:
      "I confirm a maintenance / property management plan exists or will be maintained as required.",
    ownerDeclarationConfirmed:
      "I am authorized to make owner or operator declarations for this property, and I understand that municipal registration requirements remain my responsibility.",
    informationAccurateConfirmed:
      "I confirm the information in this draft is accurate to the best of my knowledge.",
  };
}

export function legacyDeclarationsFromDraft(
  input:
    | Partial<RegistrySubmissionDraft>
    | {
        declarations?: Partial<RegistrySubmissionDeclarations> | { items?: Partial<RegistrySubmissionDeclarationItem>[]; acceptedIds?: string[] };
      }
    | null
    | undefined
): RegistrySubmissionDeclarations {
  const declarations = (input?.declarations || {}) as any;
  if (Array.isArray(declarations.items)) {
    const acceptedIds = new Set<string>(
      Array.isArray(declarations.acceptedIds)
        ? declarations.acceptedIds.map((value: any) => String(value || "").trim())
        : declarations.items
            .filter((item: any) => item?.checked)
            .map((item: any) => String(item?.id || "").trim())
    );
    return {
      acknowledged: acceptedIds.has("acknowledged"),
      maintenancePlanConfirmed: acceptedIds.has("maintenancePlanConfirmed"),
      ownerDeclarationConfirmed: acceptedIds.has("ownerDeclarationConfirmed"),
      informationAccurateConfirmed: acceptedIds.has("informationAccurateConfirmed"),
    };
  }

  return {
    acknowledged: Boolean(declarations.acknowledged),
    maintenancePlanConfirmed: Boolean(declarations.maintenancePlanConfirmed),
    ownerDeclarationConfirmed: Boolean(declarations.ownerDeclarationConfirmed),
    informationAccurateConfirmed: Boolean(declarations.informationAccurateConfirmed),
  };
}

function buildDeclarationItems(input: {
  assistantType: RegistrySubmissionDraft["assistantType"];
  declarations: RegistrySubmissionDeclarations;
  previous?: Partial<RegistrySubmissionDraft> | null;
}): RegistrySubmissionDraft["declarations"] {
  const labels = declarationLabelMap(input.assistantType);
  const previousItems = Array.isArray((input.previous?.declarations as any)?.items)
    ? (((input.previous?.declarations as any)?.items || []) as any[])
    : [];

  const items = DECLARATION_ORDER.map((id) => {
    const previousItem = previousItems.find((item) => String(item?.id || "").trim() === id);
    const checked = Boolean(input.declarations[id]);
    return {
      id,
      label: asString(previousItem?.label) || labels[id],
      required: previousItem?.required ?? true,
      checked,
      checkedAt:
        checked
          ? asString(previousItem?.checkedAt) || nowIso()
          : null,
    };
  });

  return {
    items,
    acceptedIds: items.filter((item) => item.checked).map((item) => item.id),
  };
}

function normalizeFieldValues(value: any): RegistrySubmissionFieldValues {
  const fieldValues = (value || {}) as Partial<RegistrySubmissionFieldValues>;
  const buildings = Array.isArray(fieldValues.buildings) ? fieldValues.buildings : [];
  return {
    siteAddress: normalizeAddress(fieldValues.siteAddress, null),
    propertyIdentifierPid: asString(fieldValues.propertyIdentifierPid),
    owner: normalizeContact(fieldValues.owner, null),
    primaryContactSameAsOwner: asBooleanOrNull(fieldValues.primaryContactSameAsOwner),
    primaryContact: normalizeContact(fieldValues.primaryContact, null),
    moreThanFiveBuildings: asBooleanOrNull(fieldValues.moreThanFiveBuildings),
    buildings: buildings.map((building, index) =>
      normalizeBuilding(building, normalizeBuilding(null, {
        id: asString((building as any)?.id) || `building-${index + 1}`,
        primaryAddress: normalizeAddress((building as any)?.primaryAddress, null),
        hasAlternateContact: null,
        alternateContact: normalizeContact(null, null),
        hasAdditionalCivicAddress: null,
        additionalCivicAddress: null,
        rentalUnitTypes: [],
        otherRentalUnitType: null,
        residentialUnitsRented: null,
        shortTermRentalUnits: null,
        buildingType: null,
        otherBuildingType: null,
        totalResidentialUnits: null,
        hasCommercialUnits: null,
        amenities: [],
        fireLifeSafetySystems: [],
        accessibilityFeatures: [],
        yearConstructed: null,
        notes: null,
      }))
    ),
    propertyDescription: asString(fieldValues.propertyDescription),
  };
}

export function validateRegistrySubmissionDraftV2(input: {
  draft: RegistrySubmissionDraft;
  schema?: RegistrySchemaDefinition;
}): RegistrySubmissionValidation {
  const schema = input.schema;
  if (!schema) {
    const validation = input.draft.review?.validation || {
      missingRequiredFields: [],
      missingConsentItems: [],
      warnings: [],
      readinessScore: 0,
      completionPercent: 0,
      exportReady: false,
      errors: [],
    };
    return {
      ...validation,
      errors: validation.errors || [...validation.missingRequiredFields, ...validation.missingConsentItems],
    };
  }
  const validation = schema.validate({
    fieldValues: input.draft.form.fieldValues,
    declarations: legacyDeclarationsFromDraft(input.draft),
    consent: input.draft.submission.consent,
  });
  return {
    ...validation,
    errors: [...validation.missingRequiredFields, ...validation.missingConsentItems],
  };
}

export function buildRegistrySubmissionDraftV2(input: {
  schema: RegistrySchemaDefinition;
  draftId: string;
  propertyId: string;
  landlordId: string | null;
  previous?: Partial<RegistrySubmissionDraft> | null;
  fieldValues: RegistrySubmissionFieldValues;
  fieldMeta: RegistrySubmissionFieldMeta;
  consent: RegistrySubmissionConsent;
  declarations: RegistrySubmissionDeclarations;
  status?: RegistrySubmissionStatus | null;
  updatedBy?: string | null;
  migratedFromVersion?: number | string | null;
}): RegistrySubmissionDraft {
  const assistantType = assistantTypeForSchema(input.schema);
  const previous = input.previous || null;
  const declarations = buildDeclarationItems({
    assistantType,
    declarations: input.declarations,
    previous,
  });
  const createdAt = asString((previous as any)?.timestamps?.createdAt) || asString((previous as any)?.createdAt) || nowIso();
  const updatedAt = nowIso();
  const validation = validateRegistrySubmissionDraftV2({
    draft: {
      schemaVersion: 2,
      draftId: input.draftId,
      assistantType,
      status: input.status || "draft",
      timestamps: {
        createdAt,
        updatedAt,
        exportedAt: asString((previous as any)?.timestamps?.exportedAt) || asString((previous as any)?.exportedAt),
        lastReviewedAt: updatedAt,
      },
      actor: {
        landlordId: input.landlordId,
        updatedBy: asString(input.updatedBy) || asString((previous as any)?.actor?.updatedBy) || asString((previous as any)?.updatedBy),
      },
      context: {
        propertyId: input.propertyId,
        sourceKey: input.schema.sourceKey,
        schemaKey: input.schema.schemaKey,
        schemaLabel: input.schema.label,
        mode: input.schema.mode,
        jurisdiction: { ...input.schema.jurisdiction },
      },
      entity: {
        siteAddress: input.fieldValues.siteAddress,
        propertyIdentifierPid: input.fieldValues.propertyIdentifierPid,
        moreThanFiveBuildings: input.fieldValues.moreThanFiveBuildings,
        propertyDescription: input.fieldValues.propertyDescription,
        buildings: input.fieldValues.buildings,
      },
      contact: {
        owner: input.fieldValues.owner,
        primaryContactSameAsOwner: input.fieldValues.primaryContactSameAsOwner,
        primaryContact: input.fieldValues.primaryContact,
      },
      people: {
        owner: input.fieldValues.owner,
        primaryContact: input.fieldValues.primaryContact,
      },
      declarations,
      attachments: Array.isArray((previous as any)?.attachments) ? ((previous as any)?.attachments as any[]) : [],
      form: {
        fieldValues: input.fieldValues,
        fieldMeta: input.fieldMeta,
      },
      review: {
        validation: {
          missingRequiredFields: [],
          missingConsentItems: [],
          warnings: [],
          readinessScore: 0,
          completionPercent: 0,
          exportReady: false,
          errors: [],
        },
      },
      submission: {
        consent: input.consent,
      },
      audit: {
        migratedFromVersion: input.migratedFromVersion ?? (previous?.audit?.migratedFromVersion ?? null),
      },
      meta: {
        disclaimer:
          assistantType === "registry_ready_compliance_assistant"
            ? "This file is a preparation draft generated by RentChain for review and export. It is not a direct municipal filing or proof of official registration."
            : "This file is a preparation draft generated by RentChain for review and export. It is not a direct Halifax filing.",
        exportPreparedAt: null,
      },
    },
    schema: input.schema,
  });

  const status =
    input.status ||
    ((previous?.status === "submitted_external" && "submitted_external") ||
      (previous?.status === "exported" && validation.exportReady && "exported") ||
      (validation.exportReady ? "ready" : "draft"));

  return {
    schemaVersion: 2,
    draftId: input.draftId,
    assistantType,
    status,
    timestamps: {
      createdAt,
      updatedAt,
      exportedAt: asString((previous as any)?.timestamps?.exportedAt) || asString((previous as any)?.exportedAt),
      lastReviewedAt: updatedAt,
    },
    actor: {
      landlordId: input.landlordId,
      updatedBy: asString(input.updatedBy) || asString((previous as any)?.actor?.updatedBy) || asString((previous as any)?.updatedBy),
    },
    context: {
      propertyId: input.propertyId,
      sourceKey: input.schema.sourceKey,
      schemaKey: input.schema.schemaKey,
      schemaLabel: input.schema.label,
      mode: input.schema.mode,
      jurisdiction: { ...input.schema.jurisdiction },
    },
    entity: {
      siteAddress: input.fieldValues.siteAddress,
      propertyIdentifierPid: input.fieldValues.propertyIdentifierPid,
      moreThanFiveBuildings: input.fieldValues.moreThanFiveBuildings,
      propertyDescription: input.fieldValues.propertyDescription,
      buildings: input.fieldValues.buildings,
    },
    contact: {
      owner: input.fieldValues.owner,
      primaryContactSameAsOwner: input.fieldValues.primaryContactSameAsOwner,
      primaryContact: input.fieldValues.primaryContact,
    },
    people: {
      owner: input.fieldValues.owner,
      primaryContact: input.fieldValues.primaryContact,
    },
    declarations,
    attachments: Array.isArray((previous as any)?.attachments) ? ((previous as any)?.attachments as any[]) : [],
    form: {
      fieldValues: input.fieldValues,
      fieldMeta: input.fieldMeta,
    },
    review: {
      validation,
    },
    submission: {
      consent: input.consent,
    },
    audit: {
      migratedFromVersion: input.migratedFromVersion ?? (previous?.audit?.migratedFromVersion ?? null),
    },
    meta: {
      disclaimer:
        assistantType === "registry_ready_compliance_assistant"
          ? "This file is a preparation draft generated by RentChain for review and export. It is not a direct municipal filing or proof of official registration."
          : "This file is a preparation draft generated by RentChain for review and export. It is not a direct Halifax filing.",
      exportPreparedAt: previous?.meta?.exportPreparedAt || null,
    },
  };
}

export function hydrateRegistryAssistantUiState(draft: Partial<RegistrySubmissionDraft> | null | undefined): RegistrySubmissionDraft {
  return migrateRegistryDraftToV2(draft);
}

export function exportRegistrySubmissionDraftV2(draft: RegistrySubmissionDraft): RegistrySubmissionDraft {
  return {
    ...draft,
    meta: {
      ...draft.meta,
      exportPreparedAt: nowIso(),
    },
  };
}

export function migrateRegistryDraftToV2(input: Partial<RegistrySubmissionDraft> | null | undefined): RegistrySubmissionDraft {
  if (input?.schemaVersion === 2 && input.draftId && input.context && input.form) {
    const normalized = input as RegistrySubmissionDraft;
    const assistantType = normalized.assistantType;
    const declarations = legacyDeclarationsFromDraft(normalized);
    const declarationState = buildDeclarationItems({
      assistantType,
      declarations,
      previous: normalized,
    });
    const validation = normalized.review?.validation || {
      missingRequiredFields: [],
      missingConsentItems: [],
      warnings: [],
      readinessScore: 0,
      completionPercent: 0,
      exportReady: false,
      errors: [],
    };
    return {
      ...normalized,
      schemaVersion: 2,
      declarations: declarationState,
      form: {
        fieldValues: normalizeFieldValues(normalized.form.fieldValues),
        fieldMeta: normalized.form.fieldMeta || {},
      },
      review: {
        validation: {
          ...validation,
          errors: validation.errors || [...validation.missingRequiredFields, ...validation.missingConsentItems],
        },
      },
      attachments: Array.isArray(normalized.attachments) ? normalized.attachments : [],
      audit: {
        migratedFromVersion: normalized.audit?.migratedFromVersion ?? null,
      },
      meta: {
        disclaimer: normalized.meta?.disclaimer || null,
        exportPreparedAt: normalized.meta?.exportPreparedAt || null,
      },
    };
  }

  const legacy = (input || {}) as any;
  const mode = legacy.mode || "official_registry";
  const assistantType =
    mode === "registry_ready_fallback"
      ? "registry_ready_compliance_assistant"
      : "halifax_registry_submission_assistant";
  const fieldValues = normalizeFieldValues(legacy.fieldValues || {});
  const declarations = legacyDeclarationsFromDraft(legacy);
  const declarationState = buildDeclarationItems({
    assistantType,
    declarations,
    previous: null,
  });

  return {
    schemaVersion: 2,
    draftId: asString(legacy.draftId) || asString(legacy.id) || "draft",
    assistantType,
    status: legacy.status || "draft",
    timestamps: {
      createdAt: asString(legacy.createdAt) || nowIso(),
      updatedAt: asString(legacy.updatedAt) || asString(legacy.createdAt) || nowIso(),
      exportedAt: asString(legacy.exportedAt),
      lastReviewedAt: asString(legacy.lastReviewedAt),
    },
    actor: {
      landlordId: asString(legacy.landlordId),
      updatedBy: asString(legacy.updatedBy),
    },
    context: {
      propertyId: asString(legacy.propertyId) || "property",
      sourceKey: asString(legacy.sourceKey) || "halifax_rental_registry_form",
      schemaKey: asString(legacy.schemaKey) || "halifax_rental_registry_v1",
      schemaLabel: asString(legacy.schemaLabel) || "Halifax Rental Registry",
      mode,
      jurisdiction: {
        country: asString(legacy.jurisdiction?.country) || "CA",
        province: asString(legacy.jurisdiction?.province),
        municipality: asString(legacy.jurisdiction?.municipality),
      },
    },
    entity: {
      siteAddress: fieldValues.siteAddress,
      propertyIdentifierPid: fieldValues.propertyIdentifierPid,
      moreThanFiveBuildings: fieldValues.moreThanFiveBuildings,
      propertyDescription: fieldValues.propertyDescription,
      buildings: fieldValues.buildings,
    },
    contact: {
      owner: fieldValues.owner,
      primaryContactSameAsOwner: fieldValues.primaryContactSameAsOwner,
      primaryContact: fieldValues.primaryContact,
    },
    people: {
      owner: fieldValues.owner,
      primaryContact: fieldValues.primaryContact,
    },
    declarations: declarationState,
    attachments: [],
    form: {
      fieldValues,
      fieldMeta: (legacy.fieldMeta || {}) as RegistrySubmissionFieldMeta,
    },
    review: {
      validation: {
        ...(legacy.validation || {
          missingRequiredFields: [],
          missingConsentItems: [],
          warnings: [],
          readinessScore: 0,
          completionPercent: 0,
          exportReady: false,
        }),
        errors: [
          ...((legacy.validation?.missingRequiredFields || []) as any[]),
          ...((legacy.validation?.missingConsentItems || []) as any[]),
        ],
      },
    },
    submission: {
      consent: {
        preparationAuthorized: Boolean(legacy.consent?.preparationAuthorized),
        preparationAuthorizedAt: asString(legacy.consent?.preparationAuthorizedAt),
        preparationAuthorizedBy: asString(legacy.consent?.preparationAuthorizedBy),
        declarationsConfirmed: Boolean(legacy.consent?.declarationsConfirmed),
        declarationsConfirmedAt: asString(legacy.consent?.declarationsConfirmedAt),
        declarationsConfirmedBy: asString(legacy.consent?.declarationsConfirmedBy),
        finalReviewConfirmed: Boolean(legacy.consent?.finalReviewConfirmed),
        finalReviewConfirmedAt: asString(legacy.consent?.finalReviewConfirmedAt),
      },
    },
    audit: {
      migratedFromVersion: legacy.schemaVersion ?? 1,
    },
    meta: {
      disclaimer: null,
      exportPreparedAt: null,
    },
  };
}
