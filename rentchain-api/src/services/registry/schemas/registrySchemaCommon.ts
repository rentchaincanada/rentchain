import type {
  RegistryAddress,
  RegistryBuildingDraft,
  RegistryContact,
  RegistryFieldMetaEntry,
  RegistrySubmissionBuildContext,
  RegistrySubmissionConsent,
  RegistrySubmissionDeclarations,
  RegistrySubmissionDraft,
  RegistrySubmissionFieldMeta,
  RegistrySubmissionFieldValues,
  RegistryValidationItem,
} from "./registrySchemaTypes";

export function nowIso() {
  return new Date().toISOString();
}

export function asString(value: any): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function asBooleanOrNull(value: any): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

export function asNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function asStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .filter((entry, index, items) => items.indexOf(entry) === index) as string[];
}

export function firstString(...values: any[]): string | null {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return null;
}

export function blankAddress(): RegistryAddress {
  return {
    line1: null,
    line2: null,
    city: null,
    province: null,
    postalCode: null,
    country: "Canada",
  };
}

export function normalizeAddress(
  value?: Partial<RegistryAddress> | null,
  fallback?: Partial<RegistryAddress> | null
): RegistryAddress {
  return {
    line1: asString(value?.line1) || asString(fallback?.line1) || null,
    line2: asString(value?.line2) || asString(fallback?.line2) || null,
    city: asString(value?.city) || asString(fallback?.city) || null,
    province: asString(value?.province) || asString(fallback?.province) || null,
    postalCode: asString(value?.postalCode) || asString(fallback?.postalCode) || null,
    country: asString(value?.country) || asString(fallback?.country) || null,
  };
}

export function normalizeContact(
  value?: Partial<RegistryContact> | null,
  fallback?: Partial<RegistryContact> | null
): RegistryContact {
  return {
    name: asString(value?.name) || asString(fallback?.name) || null,
    company: asString(value?.company) || asString(fallback?.company) || null,
    email: asString(value?.email) || asString(fallback?.email) || null,
    phone: asString(value?.phone) || asString(fallback?.phone) || null,
    address: normalizeAddress(value?.address, fallback?.address || blankAddress()),
  };
}

export function buildDefaultBuilding(property: Record<string, any>): RegistryBuildingDraft {
  return {
    id: "building-1",
    primaryAddress: normalizeAddress(
      {
        line1: property?.addressLine1 || property?.address1 || null,
        line2: property?.addressLine2 || property?.address2 || null,
        city: property?.city || null,
        province: property?.province || null,
        postalCode: property?.postalCode || null,
        country: property?.country || "Canada",
      },
      blankAddress()
    ),
    hasAlternateContact: null,
    alternateContact: normalizeContact({}, {}),
    hasAdditionalCivicAddress: null,
    additionalCivicAddress: null,
    rentalUnitTypes: [],
    otherRentalUnitType: null,
    residentialUnitsRented: null,
    shortTermRentalUnits: null,
    buildingType: null,
    otherBuildingType: null,
    totalResidentialUnits: asNumberOrNull(property?.totalUnits),
    hasCommercialUnits: null,
    amenities: [],
    fireLifeSafetySystems: [],
    accessibilityFeatures: [],
    yearConstructed: null,
    notes: null,
  };
}

export function normalizeBuilding(
  value: Partial<RegistryBuildingDraft> | null | undefined,
  fallback: RegistryBuildingDraft
): RegistryBuildingDraft {
  return {
    id: asString(value?.id) || fallback.id,
    primaryAddress: normalizeAddress(value?.primaryAddress, fallback.primaryAddress),
    hasAlternateContact: asBooleanOrNull(value?.hasAlternateContact) ?? fallback.hasAlternateContact,
    alternateContact: normalizeContact(value?.alternateContact, fallback.alternateContact),
    hasAdditionalCivicAddress:
      asBooleanOrNull(value?.hasAdditionalCivicAddress) ?? fallback.hasAdditionalCivicAddress,
    additionalCivicAddress: asString(value?.additionalCivicAddress) || fallback.additionalCivicAddress || null,
    rentalUnitTypes: asStringArray(value?.rentalUnitTypes?.length ? value?.rentalUnitTypes : fallback.rentalUnitTypes),
    otherRentalUnitType: asString(value?.otherRentalUnitType) || fallback.otherRentalUnitType || null,
    residentialUnitsRented: asNumberOrNull(value?.residentialUnitsRented) ?? fallback.residentialUnitsRented ?? null,
    shortTermRentalUnits: asNumberOrNull(value?.shortTermRentalUnits) ?? fallback.shortTermRentalUnits ?? null,
    buildingType: asString(value?.buildingType) || fallback.buildingType || null,
    otherBuildingType: asString(value?.otherBuildingType) || fallback.otherBuildingType || null,
    totalResidentialUnits: asNumberOrNull(value?.totalResidentialUnits) ?? fallback.totalResidentialUnits ?? null,
    hasCommercialUnits: asBooleanOrNull(value?.hasCommercialUnits) ?? fallback.hasCommercialUnits,
    amenities: asStringArray(value?.amenities?.length ? value?.amenities : fallback.amenities),
    fireLifeSafetySystems: asStringArray(
      value?.fireLifeSafetySystems?.length ? value?.fireLifeSafetySystems : fallback.fireLifeSafetySystems
    ),
    accessibilityFeatures: asStringArray(
      value?.accessibilityFeatures?.length ? value?.accessibilityFeatures : fallback.accessibilityFeatures
    ),
    yearConstructed: asNumberOrNull(value?.yearConstructed) ?? fallback.yearConstructed ?? null,
    notes: asString(value?.notes) || fallback.notes || null,
  };
}

export function normalizeDeclarations(
  value?: Partial<RegistrySubmissionDeclarations> | null,
  fallback?: Partial<RegistrySubmissionDeclarations> | null
): RegistrySubmissionDeclarations {
  return {
    acknowledged: value?.acknowledged ?? fallback?.acknowledged ?? false,
    maintenancePlanConfirmed: value?.maintenancePlanConfirmed ?? fallback?.maintenancePlanConfirmed ?? false,
    ownerDeclarationConfirmed: value?.ownerDeclarationConfirmed ?? fallback?.ownerDeclarationConfirmed ?? false,
    informationAccurateConfirmed:
      value?.informationAccurateConfirmed ?? fallback?.informationAccurateConfirmed ?? false,
  };
}

export function buildOwnerPrefill(
  landlordProfile?: Record<string, any> | null,
  userAccount?: Record<string, any> | null
): RegistryContact {
  const mailingAddress = normalizeAddress(
    {
      line1: firstString(
        landlordProfile?.addressLine1,
        landlordProfile?.mailingAddressLine1,
        landlordProfile?.mailingAddress?.line1,
        userAccount?.addressLine1,
        userAccount?.mailingAddressLine1,
        userAccount?.mailingAddress?.line1
      ),
      line2: firstString(
        landlordProfile?.addressLine2,
        landlordProfile?.mailingAddressLine2,
        landlordProfile?.mailingAddress?.line2,
        userAccount?.addressLine2,
        userAccount?.mailingAddressLine2,
        userAccount?.mailingAddress?.line2
      ),
      city: firstString(
        landlordProfile?.city,
        landlordProfile?.mailingCity,
        landlordProfile?.mailingAddress?.city,
        userAccount?.city,
        userAccount?.mailingCity,
        userAccount?.mailingAddress?.city
      ),
      province: firstString(
        landlordProfile?.province,
        landlordProfile?.mailingProvince,
        landlordProfile?.mailingAddress?.province,
        userAccount?.province,
        userAccount?.mailingProvince,
        userAccount?.mailingAddress?.province
      ),
      postalCode: firstString(
        landlordProfile?.postalCode,
        landlordProfile?.mailingPostalCode,
        landlordProfile?.mailingAddress?.postalCode,
        userAccount?.postalCode,
        userAccount?.mailingPostalCode,
        userAccount?.mailingAddress?.postalCode
      ),
      country: firstString(
        landlordProfile?.country,
        landlordProfile?.mailingCountry,
        landlordProfile?.mailingAddress?.country,
        userAccount?.country,
        userAccount?.mailingCountry,
        userAccount?.mailingAddress?.country,
        "Canada"
      ),
    },
    blankAddress()
  );

  return normalizeContact(
    {
      name: firstString(
        landlordProfile?.contactName,
        landlordProfile?.name,
        landlordProfile?.fullName,
        landlordProfile?.displayName,
        userAccount?.name,
        userAccount?.fullName,
        userAccount?.displayName
      ),
      company: firstString(
        landlordProfile?.businessName,
        landlordProfile?.company,
        landlordProfile?.companyName,
        userAccount?.businessName,
        userAccount?.company,
        userAccount?.companyName
      ),
      email: firstString(landlordProfile?.email, userAccount?.email),
      phone: firstString(landlordProfile?.phone, userAccount?.phone, userAccount?.phoneNumber),
      address: mailingAddress,
    },
    {}
  );
}

export function buildInitialConsent(
  persisted?: Partial<RegistrySubmissionDraft> | null
): RegistrySubmissionConsent {
  const consent = (((persisted as any)?.submission?.consent || (persisted as any)?.consent || {}) as Partial<RegistrySubmissionConsent>);
  return {
    preparationAuthorized: Boolean(consent.preparationAuthorized),
    preparationAuthorizedAt: asString(consent.preparationAuthorizedAt) || null,
    preparationAuthorizedBy: asString(consent.preparationAuthorizedBy) || null,
    declarationsConfirmed: Boolean(consent.declarationsConfirmed),
    declarationsConfirmedAt: asString(consent.declarationsConfirmedAt) || null,
    declarationsConfirmedBy: asString(consent.declarationsConfirmedBy) || null,
    finalReviewConfirmed: Boolean(consent.finalReviewConfirmed),
    finalReviewConfirmedAt: asString(consent.finalReviewConfirmedAt) || null,
  };
}

export function deriveFieldMeta(
  fieldValues: RegistrySubmissionFieldValues,
  declarations: RegistrySubmissionDeclarations,
  persisted?: Partial<RegistrySubmissionDraft> | null
): RegistrySubmissionFieldMeta {
  const previous = ((((persisted as any)?.form?.fieldMeta || (persisted as any)?.fieldMeta) as RegistrySubmissionFieldMeta | undefined) || {}) as RegistrySubmissionFieldMeta;
  const next: RegistrySubmissionFieldMeta = {
    "fieldValues.siteAddress.line1": {
      source: fieldValues.siteAddress.line1 ? "rentchain_property" : "unknown",
      status: fieldValues.siteAddress.line1 ? "needs_confirmation" : "missing",
      confirmed: Boolean(previous["fieldValues.siteAddress.line1"]?.confirmed),
    },
    "fieldValues.owner.name": {
      source: fieldValues.owner.name ? "rentchain_profile" : "unknown",
      status: fieldValues.owner.name ? "needs_confirmation" : "missing",
      confirmed: Boolean(previous["fieldValues.owner.name"]?.confirmed),
    },
    "fieldValues.owner.email": {
      source: fieldValues.owner.email ? "rentchain_profile" : "unknown",
      status: fieldValues.owner.email ? "needs_confirmation" : "missing",
      confirmed: Boolean(previous["fieldValues.owner.email"]?.confirmed),
    },
    "fieldValues.owner.phone": {
      source: fieldValues.owner.phone ? "rentchain_profile" : "unknown",
      status: fieldValues.owner.phone ? "needs_confirmation" : "missing",
      confirmed: Boolean(previous["fieldValues.owner.phone"]?.confirmed),
    },
    "fieldValues.propertyIdentifierPid": {
      source: fieldValues.propertyIdentifierPid ? "rentchain_property" : "unknown",
      status: fieldValues.propertyIdentifierPid ? "needs_confirmation" : "missing",
      confirmed: Boolean(previous["fieldValues.propertyIdentifierPid"]?.confirmed),
    },
    "fieldValues.buildings[0].buildingType": {
      source: fieldValues.buildings[0]?.buildingType ? "manual" : "unknown",
      status: fieldValues.buildings[0]?.buildingType ? "provided_by_user" : "missing",
      confirmed:
        Boolean(previous["fieldValues.buildings[0].buildingType"]?.confirmed) ||
        Boolean(fieldValues.buildings[0]?.buildingType),
    },
    "fieldValues.buildings[0].residentialUnitsRented": {
      source: fieldValues.buildings[0]?.residentialUnitsRented != null ? "manual" : "unknown",
      status: fieldValues.buildings[0]?.residentialUnitsRented != null ? "provided_by_user" : "missing",
      confirmed:
        Boolean(previous["fieldValues.buildings[0].residentialUnitsRented"]?.confirmed) ||
        fieldValues.buildings[0]?.residentialUnitsRented != null,
    },
    "fieldValues.buildings[0].yearConstructed": {
      source: fieldValues.buildings[0]?.yearConstructed != null ? "manual" : "unknown",
      status: fieldValues.buildings[0]?.yearConstructed != null ? "provided_by_user" : "missing",
      confirmed:
        Boolean(previous["fieldValues.buildings[0].yearConstructed"]?.confirmed) ||
        fieldValues.buildings[0]?.yearConstructed != null,
    },
    "fieldValues.buildings[0].fireLifeSafetySystems": {
      source: fieldValues.buildings[0]?.fireLifeSafetySystems?.length ? "manual" : "unknown",
      status: fieldValues.buildings[0]?.fireLifeSafetySystems?.length ? "provided_by_user" : "missing",
      confirmed:
        Boolean(previous["fieldValues.buildings[0].fireLifeSafetySystems"]?.confirmed) ||
        Boolean(fieldValues.buildings[0]?.fireLifeSafetySystems?.length),
    },
    "declarations.acknowledged": {
      source: declarations.acknowledged ? "manual" : previous["declarations.acknowledged"]?.source || "unknown",
      status: declarations.acknowledged ? "provided_by_user" : "missing",
      confirmed: Boolean(previous["declarations.acknowledged"]?.confirmed) || declarations.acknowledged,
    },
  };
  return { ...previous, ...next };
}

export function applyFieldMetaOverrides(
  current: RegistrySubmissionFieldMeta,
  overrides?: Partial<RegistrySubmissionFieldMeta>
): RegistrySubmissionFieldMeta {
  if (!overrides) return current;
  const next = { ...current };
  for (const [key, value] of Object.entries(overrides)) {
    if (!value) continue;
    next[key] = {
      source: value.source || current[key]?.source || "unknown",
      status: value.status || current[key]?.status || "missing",
      confirmed: value.confirmed ?? current[key]?.confirmed ?? false,
    };
  }
  return next;
}

export function declarationsAllConfirmed(declarations: RegistrySubmissionDeclarations) {
  return Boolean(
    declarations.acknowledged &&
      declarations.maintenancePlanConfirmed &&
      declarations.ownerDeclarationConfirmed &&
      declarations.informationAccurateConfirmed
  );
}

export function evolveConsent(input: {
  current: RegistrySubmissionConsent;
  incoming?: Partial<RegistrySubmissionConsent>;
  declarations: RegistrySubmissionDeclarations;
  actor: string | null;
}): RegistrySubmissionConsent {
  const { current, incoming, declarations, actor } = input;
  const now = nowIso();
  const nextPreparationAuthorized = incoming?.preparationAuthorized ?? current.preparationAuthorized;
  const nextDeclarationsConfirmed =
    declarationsAllConfirmed(declarations) &&
    (incoming?.declarationsConfirmed ?? current.declarationsConfirmed ?? true);

  return {
    preparationAuthorized: Boolean(nextPreparationAuthorized),
    preparationAuthorizedAt: nextPreparationAuthorized
      ? current.preparationAuthorizedAt || asString(incoming?.preparationAuthorizedAt) || now
      : null,
    preparationAuthorizedBy: nextPreparationAuthorized
      ? current.preparationAuthorizedBy || asString(incoming?.preparationAuthorizedBy) || actor
      : null,
    declarationsConfirmed: Boolean(nextDeclarationsConfirmed),
    declarationsConfirmedAt: nextDeclarationsConfirmed
      ? current.declarationsConfirmedAt || asString(incoming?.declarationsConfirmedAt) || now
      : null,
    declarationsConfirmedBy: nextDeclarationsConfirmed
      ? current.declarationsConfirmedBy || asString(incoming?.declarationsConfirmedBy) || actor
      : null,
    finalReviewConfirmed: Boolean(incoming?.finalReviewConfirmed ?? current.finalReviewConfirmed),
    finalReviewConfirmedAt:
      incoming?.finalReviewConfirmed || current.finalReviewConfirmed
        ? current.finalReviewConfirmedAt || asString(incoming?.finalReviewConfirmedAt) || now
        : null,
  };
}

export function buildBaseSubmissionPrefill(
  context: RegistrySubmissionBuildContext
): {
  fieldValues: RegistrySubmissionFieldValues;
  fieldMeta: RegistrySubmissionFieldMeta;
  declarations: RegistrySubmissionDeclarations;
  consent: RegistrySubmissionConsent;
} {
  const property = context.property || {};
  const persisted = (context.persisted || null) as any;
  const persistedFieldValues = (((persisted?.form?.fieldValues || persisted?.fieldValues) || {}) as Partial<RegistrySubmissionFieldValues>);
  const declarationState = persisted?.declarations || {};
  const persistedDeclarations: RegistrySubmissionDeclarations = Array.isArray(declarationState?.items)
    ? {
        acknowledged: declarationState.items.some((item: any) => item?.id === "acknowledged" && item?.checked),
        maintenancePlanConfirmed: declarationState.items.some(
          (item: any) => item?.id === "maintenancePlanConfirmed" && item?.checked
        ),
        ownerDeclarationConfirmed: declarationState.items.some(
          (item: any) => item?.id === "ownerDeclarationConfirmed" && item?.checked
        ),
        informationAccurateConfirmed: declarationState.items.some(
          (item: any) => item?.id === "informationAccurateConfirmed" && item?.checked
        ),
      }
    : normalizeDeclarations(declarationState, {
        acknowledged: false,
        maintenancePlanConfirmed: false,
        ownerDeclarationConfirmed: false,
        informationAccurateConfirmed: false,
      });

  const ownerPrefill = buildOwnerPrefill(context.landlordProfile, context.userAccount);
  const baseFieldValues: RegistrySubmissionFieldValues = {
    siteAddress: normalizeAddress(
      {
        line1: property?.addressLine1 || property?.address1 || null,
        line2: property?.addressLine2 || property?.address2 || null,
        city: property?.city || null,
        province: property?.province || null,
        postalCode: property?.postalCode || null,
        country: property?.country || "Canada",
      },
      blankAddress()
    ),
    propertyIdentifierPid: firstString(property?.pid, property?.PID, property?.propertyPid),
    owner: ownerPrefill,
    primaryContactSameAsOwner: null,
    primaryContact: normalizeContact({}, ownerPrefill),
    moreThanFiveBuildings: null,
    buildings: [buildDefaultBuilding(property)],
    propertyDescription: null,
  };

  const savedBuildings = Array.isArray(persistedFieldValues.buildings) ? persistedFieldValues.buildings : [];
  const mergedBuildingsSource = savedBuildings.length > 0 ? savedBuildings : baseFieldValues.buildings;
  const mergedBuildings = mergedBuildingsSource
    .slice(0, 5)
    .map((entry, index) =>
      normalizeBuilding(entry, baseFieldValues.buildings[index] || buildDefaultBuilding(property))
    );

  const fieldValues = {
    siteAddress: normalizeAddress(persistedFieldValues.siteAddress, baseFieldValues.siteAddress),
    propertyIdentifierPid:
      asString(persistedFieldValues.propertyIdentifierPid) || baseFieldValues.propertyIdentifierPid || null,
    owner: normalizeContact(persistedFieldValues.owner, baseFieldValues.owner),
    primaryContactSameAsOwner:
      asBooleanOrNull(persistedFieldValues.primaryContactSameAsOwner) ?? baseFieldValues.primaryContactSameAsOwner,
    primaryContact: normalizeContact(persistedFieldValues.primaryContact, baseFieldValues.primaryContact),
    moreThanFiveBuildings:
      asBooleanOrNull(persistedFieldValues.moreThanFiveBuildings) ?? baseFieldValues.moreThanFiveBuildings,
    buildings: mergedBuildings.length > 0 ? mergedBuildings : [buildDefaultBuilding(property)],
    propertyDescription:
      asString(persistedFieldValues.propertyDescription) || baseFieldValues.propertyDescription || null,
  };
  const declarations = normalizeDeclarations(persistedDeclarations, {
    acknowledged: false,
    maintenancePlanConfirmed: false,
    ownerDeclarationConfirmed: false,
    informationAccurateConfirmed: false,
  });

  return {
    fieldValues,
    fieldMeta: deriveFieldMeta(fieldValues, declarations, persisted),
    consent: buildInitialConsent(persisted),
    declarations,
  };
}

export function pushMissing(
  target: RegistryValidationItem[],
  path: string,
  label: string,
  section: string,
  condition: boolean
) {
  if (condition) target.push({ path, label, section });
}

export function addressMissing(address: RegistryAddress, requireProvince = false) {
  return !address.line1 || !address.city || !address.postalCode || (requireProvince && !address.province);
}

export function determineStatus(input: {
  validation: RegistrySubmissionDraft["review"]["validation"];
  fieldValues: RegistrySubmissionFieldValues;
  declarations: RegistrySubmissionDeclarations;
  consent: RegistrySubmissionConsent;
  previousStatus?: RegistrySubmissionDraft["status"] | null;
}): RegistrySubmissionDraft["status"] {
  const { validation, fieldValues, declarations, consent, previousStatus } = input;
  if (previousStatus === "submitted_external") return "submitted_external";
  if (previousStatus === "exported" && validation.exportReady) return "exported";
  const hasAnyData =
    Boolean(fieldValues.siteAddress.line1) ||
    Boolean(fieldValues.owner.email) ||
    Boolean(fieldValues.propertyIdentifierPid) ||
    fieldValues.buildings.some((building) => building.rentalUnitTypes.length > 0 || building.buildingType) ||
    declarations.acknowledged ||
    declarations.maintenancePlanConfirmed ||
    declarations.ownerDeclarationConfirmed ||
    declarations.informationAccurateConfirmed ||
    consent.preparationAuthorized;
  if (!hasAnyData) return "not_started";
  if (validation.exportReady) return "ready";
  return validation.warnings.length > 3 ? "needs_review" : "draft";
}

export function provenanceBadgeForField(
  current: RegistrySubmissionFieldMeta,
  path: string
): RegistryFieldMetaEntry | undefined {
  return current[path];
}
