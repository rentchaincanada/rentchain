import { db, FieldValue } from "../../config/firebase";

export const HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY = "halifax_rental_registry_form" as const;
export const HALIFAX_REGISTRY_SUBMISSION_COLLECTION = "propertyRegistrySubmissions";

export type HalifaxSubmissionStatus =
  | "not_started"
  | "draft"
  | "ready"
  | "exported"
  | "submitted_external"
  | "needs_review";

export type HalifaxFieldSource =
  | "property"
  | "landlord_profile"
  | "user_account"
  | "derived"
  | "user_input_required"
  | "unsupported";

export type HalifaxMappingConfidence = "high" | "medium" | "low";

export type HalifaxAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
};

export type HalifaxContact = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: HalifaxAddress;
};

export type HalifaxBuildingDraft = {
  id: string;
  primaryAddress: HalifaxAddress;
  hasAlternateContact: boolean | null;
  alternateContact: HalifaxContact;
  hasAdditionalCivicAddress: boolean | null;
  additionalCivicAddress: string | null;
  rentalUnitTypes: string[];
  otherRentalUnitType: string | null;
  residentialUnitsRented: number | null;
  shortTermRentalUnits: number | null;
  buildingType: string | null;
  otherBuildingType: string | null;
  totalResidentialUnits: number | null;
  hasCommercialUnits: boolean | null;
  amenities: string[];
  fireLifeSafetySystems: string[];
  accessibilityFeatures: string[];
  yearConstructed: number | null;
  notes: string | null;
};

export type HalifaxSubmissionFieldValues = {
  siteAddress: HalifaxAddress;
  propertyIdentifierPid: string | null;
  owner: HalifaxContact;
  primaryContactSameAsOwner: boolean | null;
  primaryContact: HalifaxContact;
  moreThanFiveBuildings: boolean | null;
  buildings: HalifaxBuildingDraft[];
  propertyDescription: string | null;
};

export type HalifaxSubmissionDeclarations = {
  acknowledged: boolean;
  maintenancePlanConfirmed: boolean;
  ownerDeclarationConfirmed: boolean;
  informationAccurateConfirmed: boolean;
};

export type HalifaxSubmissionConsent = {
  preparationAuthorized: boolean;
  preparationAuthorizedAt: string | null;
  preparationAuthorizedBy: string | null;
  declarationsConfirmed: boolean;
  declarationsConfirmedAt: string | null;
  declarationsConfirmedBy: string | null;
  finalReviewConfirmed: boolean;
  finalReviewConfirmedAt: string | null;
};

export type HalifaxFieldProvenanceStatus =
  | "prefilled_from_rentchain"
  | "provided_by_user"
  | "needs_confirmation"
  | "missing";

export type HalifaxFieldMetaEntry = {
  source:
    | "rentchain_property"
    | "rentchain_profile"
    | "rentchain_account"
    | "derived"
    | "manual"
    | "unknown";
  status: HalifaxFieldProvenanceStatus;
  confirmed: boolean;
};

export type HalifaxSubmissionFieldMeta = Record<string, HalifaxFieldMetaEntry>;

export type HalifaxValidationItem = {
  path: string;
  label: string;
  section: string;
};

export type HalifaxSubmissionValidation = {
  missingRequiredFields: HalifaxValidationItem[];
  missingConsentItems: HalifaxValidationItem[];
  warnings: string[];
  readinessScore: number;
  completionPercent: number;
  exportReady: boolean;
};

export type HalifaxSubmissionDraft = {
  id: string;
  propertyId: string;
  landlordId: string | null;
  sourceKey: typeof HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY;
  jurisdiction: {
    country: "CA";
    province: "NS";
    municipality: "Halifax";
  };
  status: HalifaxSubmissionStatus;
  fieldValues: HalifaxSubmissionFieldValues;
  fieldMeta: HalifaxSubmissionFieldMeta;
  declarations: HalifaxSubmissionDeclarations;
  consent: HalifaxSubmissionConsent;
  validation: HalifaxSubmissionValidation;
  exportedAt: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type HalifaxFieldMapEntry = {
  path: string;
  label: string;
  section: string;
  required: boolean;
  source: HalifaxFieldSource;
  confidence: HalifaxMappingConfidence;
  notes?: string;
};

export const HALIFAX_FIELD_MAP: HalifaxFieldMapEntry[] = [
  {
    path: "fieldValues.siteAddress.line1",
    label: "Civic address",
    section: "Property / Site",
    required: true,
    source: "property",
    confidence: "high",
  },
  {
    path: "fieldValues.siteAddress.city",
    label: "City / Town",
    section: "Property / Site",
    required: true,
    source: "property",
    confidence: "high",
  },
  {
    path: "fieldValues.siteAddress.postalCode",
    label: "Postal code",
    section: "Property / Site",
    required: true,
    source: "property",
    confidence: "high",
  },
  {
    path: "fieldValues.propertyIdentifierPid",
    label: "Property PID",
    section: "Property / Site",
    required: false,
    source: "property",
    confidence: "high",
    notes: "Helpful for registry matching but not required for Halifax submission.",
  },
  {
    path: "fieldValues.owner.name",
    label: "Owner contact name",
    section: "Property Owner",
    required: true,
    source: "landlord_profile",
    confidence: "medium",
  },
  {
    path: "fieldValues.owner.company",
    label: "Owner company",
    section: "Property Owner",
    required: false,
    source: "landlord_profile",
    confidence: "medium",
  },
  {
    path: "fieldValues.owner.email",
    label: "Owner email",
    section: "Property Owner",
    required: true,
    source: "landlord_profile",
    confidence: "high",
  },
  {
    path: "fieldValues.owner.phone",
    label: "Owner phone",
    section: "Property Owner",
    required: true,
    source: "landlord_profile",
    confidence: "low",
  },
  {
    path: "fieldValues.owner.address",
    label: "Owner mailing address",
    section: "Property Owner",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.primaryContactSameAsOwner",
    label: "Primary contact same as owner",
    section: "Primary Contact",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.primaryContact",
    label: "Primary contact details",
    section: "Primary Contact",
    required: true,
    source: "user_input_required",
    confidence: "low",
    notes: "Required when the primary contact is different from the owner.",
  },
  {
    path: "fieldValues.moreThanFiveBuildings",
    label: "More than 5 buildings on same property",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].primaryAddress",
    label: "Building civic address",
    section: "Buildings",
    required: true,
    source: "derived",
    confidence: "medium",
  },
  {
    path: "fieldValues.buildings[].rentalUnitTypes",
    label: "Rental unit types",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].residentialUnitsRented",
    label: "Residential units rented",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].shortTermRentalUnits",
    label: "Short-term rental units",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].buildingType",
    label: "Building type",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].totalResidentialUnits",
    label: "Total residential units in building",
    section: "Buildings",
    required: true,
    source: "derived",
    confidence: "medium",
  },
  {
    path: "fieldValues.buildings[].hasCommercialUnits",
    label: "Commercial units present",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].amenities",
    label: "Amenities / shared spaces",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].fireLifeSafetySystems",
    label: "Fire / life-safety systems",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].yearConstructed",
    label: "Year constructed",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.propertyDescription",
    label: "Notes / property description",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.acknowledged",
    label: "Declaration acknowledged",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.maintenancePlanConfirmed",
    label: "Maintenance plan confirmed",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.ownerDeclarationConfirmed",
    label: "Owner declaration confirmed",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.informationAccurateConfirmed",
    label: "Information accuracy confirmed",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
];

type SubmissionContext = {
  property: Record<string, any>;
  landlordProfile?: Record<string, any> | null;
  userAccount?: Record<string, any> | null;
  persisted?: Partial<HalifaxSubmissionDraft> | null;
};

type SaveInput = {
  property: Record<string, any>;
  landlordId: string | null;
  actorUserId: string | null;
  actorEmail?: string | null;
  fieldValues?: Partial<HalifaxSubmissionFieldValues>;
  fieldMeta?: Partial<HalifaxSubmissionFieldMeta>;
  declarations?: Partial<HalifaxSubmissionDeclarations>;
  consent?: Partial<HalifaxSubmissionConsent>;
  status?: HalifaxSubmissionStatus | null;
};

function nowIso() {
  return new Date().toISOString();
}

function asString(value: any): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function asBooleanOrNull(value: any): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function asNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .filter((entry, index, items) => items.indexOf(entry) === index) as string[];
}

function firstString(...values: any[]): string | null {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeAddress(value?: Partial<HalifaxAddress> | null, fallback?: Partial<HalifaxAddress> | null): HalifaxAddress {
  return {
    line1: asString(value?.line1) || asString(fallback?.line1) || null,
    line2: asString(value?.line2) || asString(fallback?.line2) || null,
    city: asString(value?.city) || asString(fallback?.city) || null,
    province: asString(value?.province) || asString(fallback?.province) || null,
    postalCode: asString(value?.postalCode) || asString(fallback?.postalCode) || null,
    country: asString(value?.country) || asString(fallback?.country) || null,
  };
}

function blankAddress(): HalifaxAddress {
  return {
    line1: null,
    line2: null,
    city: null,
    province: null,
    postalCode: null,
    country: "Canada",
  };
}

function normalizeContact(value?: Partial<HalifaxContact> | null, fallback?: Partial<HalifaxContact> | null): HalifaxContact {
  return {
    name: asString(value?.name) || asString(fallback?.name) || null,
    company: asString(value?.company) || asString(fallback?.company) || null,
    email: asString(value?.email) || asString(fallback?.email) || null,
    phone: asString(value?.phone) || asString(fallback?.phone) || null,
    address: normalizeAddress(value?.address, fallback?.address || blankAddress()),
  };
}

function buildDefaultBuilding(property: Record<string, any>): HalifaxBuildingDraft {
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

function normalizeBuilding(
  value: Partial<HalifaxBuildingDraft> | null | undefined,
  fallback: HalifaxBuildingDraft
): HalifaxBuildingDraft {
  return {
    id: asString(value?.id) || fallback.id,
    primaryAddress: normalizeAddress(value?.primaryAddress, fallback.primaryAddress),
    hasAlternateContact: asBooleanOrNull(value?.hasAlternateContact) ?? fallback.hasAlternateContact,
    alternateContact: normalizeContact(value?.alternateContact, fallback.alternateContact),
    hasAdditionalCivicAddress: asBooleanOrNull(value?.hasAdditionalCivicAddress) ?? fallback.hasAdditionalCivicAddress,
    additionalCivicAddress: asString(value?.additionalCivicAddress) || fallback.additionalCivicAddress || null,
    rentalUnitTypes: asStringArray(value?.rentalUnitTypes?.length ? value?.rentalUnitTypes : fallback.rentalUnitTypes),
    otherRentalUnitType: asString(value?.otherRentalUnitType) || fallback.otherRentalUnitType || null,
    residentialUnitsRented:
      asNumberOrNull(value?.residentialUnitsRented) ?? fallback.residentialUnitsRented ?? null,
    shortTermRentalUnits:
      asNumberOrNull(value?.shortTermRentalUnits) ?? fallback.shortTermRentalUnits ?? null,
    buildingType: asString(value?.buildingType) || fallback.buildingType || null,
    otherBuildingType: asString(value?.otherBuildingType) || fallback.otherBuildingType || null,
    totalResidentialUnits:
      asNumberOrNull(value?.totalResidentialUnits) ?? fallback.totalResidentialUnits ?? null,
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

function normalizeDeclarations(
  value?: Partial<HalifaxSubmissionDeclarations> | null,
  fallback?: Partial<HalifaxSubmissionDeclarations> | null
): HalifaxSubmissionDeclarations {
  return {
    acknowledged: value?.acknowledged ?? fallback?.acknowledged ?? false,
    maintenancePlanConfirmed:
      value?.maintenancePlanConfirmed ?? fallback?.maintenancePlanConfirmed ?? false,
    ownerDeclarationConfirmed:
      value?.ownerDeclarationConfirmed ?? fallback?.ownerDeclarationConfirmed ?? false,
    informationAccurateConfirmed:
      value?.informationAccurateConfirmed ?? fallback?.informationAccurateConfirmed ?? false,
  };
}

function buildOwnerPrefill(
  landlordProfile?: Record<string, any> | null,
  userAccount?: Record<string, any> | null
): HalifaxContact {
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

function buildInitialConsent(persisted?: Partial<HalifaxSubmissionDraft> | null): HalifaxSubmissionConsent {
  const consent = (persisted?.consent || {}) as Partial<HalifaxSubmissionConsent>;
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

function deriveFieldMeta(
  fieldValues: HalifaxSubmissionFieldValues,
  declarations: HalifaxSubmissionDeclarations,
  persisted?: Partial<HalifaxSubmissionDraft> | null
): HalifaxSubmissionFieldMeta {
  const previous = ((persisted?.fieldMeta as HalifaxSubmissionFieldMeta | undefined) || {}) as HalifaxSubmissionFieldMeta;
  const next: HalifaxSubmissionFieldMeta = {
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
      confirmed: Boolean(previous["fieldValues.buildings[0].buildingType"]?.confirmed) || Boolean(fieldValues.buildings[0]?.buildingType),
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

function applyFieldMetaOverrides(
  current: HalifaxSubmissionFieldMeta,
  overrides?: Partial<HalifaxSubmissionFieldMeta>
): HalifaxSubmissionFieldMeta {
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

function declarationsAllConfirmed(declarations: HalifaxSubmissionDeclarations) {
  return Boolean(
    declarations.acknowledged &&
      declarations.maintenancePlanConfirmed &&
      declarations.ownerDeclarationConfirmed &&
      declarations.informationAccurateConfirmed
  );
}

function evolveConsent(input: {
  current: HalifaxSubmissionConsent;
  incoming?: Partial<HalifaxSubmissionConsent>;
  declarations: HalifaxSubmissionDeclarations;
  actor: string | null;
}): HalifaxSubmissionConsent {
  const { current, incoming, declarations, actor } = input;
  const now = nowIso();
  const nextPreparationAuthorized =
    incoming?.preparationAuthorized ?? current.preparationAuthorized;
  const nextDeclarationsConfirmed =
    declarationsAllConfirmed(declarations) &&
    (incoming?.declarationsConfirmed ?? current.declarationsConfirmed ?? true);

  return {
    preparationAuthorized: Boolean(nextPreparationAuthorized),
    preparationAuthorizedAt:
      nextPreparationAuthorized
        ? current.preparationAuthorizedAt || asString(incoming?.preparationAuthorizedAt) || now
        : null,
    preparationAuthorizedBy:
      nextPreparationAuthorized
        ? current.preparationAuthorizedBy || asString(incoming?.preparationAuthorizedBy) || actor
        : null,
    declarationsConfirmed: Boolean(nextDeclarationsConfirmed),
    declarationsConfirmedAt:
      nextDeclarationsConfirmed
        ? current.declarationsConfirmedAt || asString(incoming?.declarationsConfirmedAt) || now
        : null,
    declarationsConfirmedBy:
      nextDeclarationsConfirmed
        ? current.declarationsConfirmedBy || asString(incoming?.declarationsConfirmedBy) || actor
        : null,
    finalReviewConfirmed: Boolean(incoming?.finalReviewConfirmed ?? current.finalReviewConfirmed),
    finalReviewConfirmedAt:
      incoming?.finalReviewConfirmed || current.finalReviewConfirmed
        ? current.finalReviewConfirmedAt || asString(incoming?.finalReviewConfirmedAt) || now
        : null,
  };
}

export function buildHalifaxRegistrySubmissionPrefill(
  context: SubmissionContext
): Pick<HalifaxSubmissionDraft, "fieldValues" | "declarations" | "fieldMeta" | "consent"> {
  const property = context.property || {};
  const persistedFieldValues = (context.persisted?.fieldValues || {}) as Partial<HalifaxSubmissionFieldValues>;
  const persistedDeclarations = (context.persisted?.declarations || {}) as Partial<HalifaxSubmissionDeclarations>;

  const ownerPrefill = buildOwnerPrefill(context.landlordProfile, context.userAccount);
  const baseFieldValues: HalifaxSubmissionFieldValues = {
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
    fieldValues: {
      ...fieldValues,
    },
    fieldMeta: deriveFieldMeta(fieldValues, declarations, context.persisted),
    consent: buildInitialConsent(context.persisted),
    declarations,
  };
}

function pushMissing(
  target: HalifaxValidationItem[],
  path: string,
  label: string,
  section: string,
  condition: boolean
) {
  if (condition) target.push({ path, label, section });
}

function addressMissing(address: HalifaxAddress, requireProvince = false) {
  return !address.line1 || !address.city || !address.postalCode || (requireProvince && !address.province);
}

export function validateHalifaxRegistrySubmissionDraft(input: {
  fieldValues: HalifaxSubmissionFieldValues;
  consent: HalifaxSubmissionConsent;
  declarations: HalifaxSubmissionDeclarations;
}): HalifaxSubmissionValidation {
  const { fieldValues, declarations, consent } = input;
  const missingRequiredFields: HalifaxValidationItem[] = [];
  const missingConsentItems: HalifaxValidationItem[] = [];

  pushMissing(
    missingRequiredFields,
    "fieldValues.siteAddress.line1",
    "Property civic address",
    "Property / Site",
    addressMissing(fieldValues.siteAddress)
  );
  pushMissing(
    missingRequiredFields,
    "fieldValues.owner.name",
    "Owner contact name",
    "Property Owner",
    !fieldValues.owner.name
  );
  pushMissing(
    missingRequiredFields,
    "fieldValues.owner.email",
    "Owner email",
    "Property Owner",
    !fieldValues.owner.email
  );
  pushMissing(
    missingRequiredFields,
    "fieldValues.owner.phone",
    "Owner phone",
    "Property Owner",
    !fieldValues.owner.phone
  );
  pushMissing(
    missingRequiredFields,
    "fieldValues.owner.address",
    "Owner mailing address",
    "Property Owner",
    addressMissing(fieldValues.owner.address, true)
  );
  pushMissing(
    missingRequiredFields,
    "fieldValues.primaryContactSameAsOwner",
    "Primary contact same as owner",
    "Primary Contact",
    fieldValues.primaryContactSameAsOwner === null
  );

  if (fieldValues.primaryContactSameAsOwner === false) {
    pushMissing(
      missingRequiredFields,
      "fieldValues.primaryContact.name",
      "Primary contact name",
      "Primary Contact",
      !fieldValues.primaryContact.name
    );
    pushMissing(
      missingRequiredFields,
      "fieldValues.primaryContact.email",
      "Primary contact email",
      "Primary Contact",
      !fieldValues.primaryContact.email
    );
    pushMissing(
      missingRequiredFields,
      "fieldValues.primaryContact.phone",
      "Primary contact phone",
      "Primary Contact",
      !fieldValues.primaryContact.phone
    );
    pushMissing(
      missingRequiredFields,
      "fieldValues.primaryContact.address",
      "Primary contact mailing address",
      "Primary Contact",
      addressMissing(fieldValues.primaryContact.address, true)
    );
  }

  pushMissing(
    missingRequiredFields,
    "fieldValues.moreThanFiveBuildings",
    "More than five buildings confirmation",
    "Buildings",
    fieldValues.moreThanFiveBuildings === null
  );
  pushMissing(
    missingRequiredFields,
    "fieldValues.buildings",
    "At least one building",
    "Buildings",
    !Array.isArray(fieldValues.buildings) || fieldValues.buildings.length === 0
  );

  (fieldValues.buildings || []).forEach((building, index) => {
    const prefix = `fieldValues.buildings[${index}]`;
    pushMissing(
      missingRequiredFields,
      `${prefix}.primaryAddress`,
      `Building ${index + 1} civic address`,
      "Buildings",
      addressMissing(building.primaryAddress)
    );
    pushMissing(
      missingRequiredFields,
      `${prefix}.rentalUnitTypes`,
      `Building ${index + 1} rental unit types`,
      "Buildings",
      !Array.isArray(building.rentalUnitTypes) || building.rentalUnitTypes.length === 0
    );
    pushMissing(
      missingRequiredFields,
      `${prefix}.residentialUnitsRented`,
      `Building ${index + 1} residential units rented`,
      "Buildings",
      building.residentialUnitsRented == null
    );
    pushMissing(
      missingRequiredFields,
      `${prefix}.shortTermRentalUnits`,
      `Building ${index + 1} short-term rental units`,
      "Buildings",
      building.shortTermRentalUnits == null
    );
    pushMissing(
      missingRequiredFields,
      `${prefix}.buildingType`,
      `Building ${index + 1} building type`,
      "Buildings",
      !building.buildingType
    );
    pushMissing(
      missingRequiredFields,
      `${prefix}.totalResidentialUnits`,
      `Building ${index + 1} total residential units`,
      "Buildings",
      building.totalResidentialUnits == null
    );
    pushMissing(
      missingRequiredFields,
      `${prefix}.hasCommercialUnits`,
      `Building ${index + 1} commercial unit presence`,
      "Buildings",
      building.hasCommercialUnits === null
    );
  });

  pushMissing(
    missingConsentItems,
    "consent.preparationAuthorized",
    "Preparation consent authorization",
    "Consent & Use Notice",
    !consent.preparationAuthorized
  );
  pushMissing(
    missingRequiredFields,
    "declarations.acknowledged",
    "Declaration acknowledgement",
    "Declarations",
    !declarations.acknowledged
  );
  pushMissing(
    missingRequiredFields,
    "declarations.maintenancePlanConfirmed",
    "Maintenance plan acknowledgement",
    "Declarations",
    !declarations.maintenancePlanConfirmed
  );
  pushMissing(
    missingRequiredFields,
    "declarations.ownerDeclarationConfirmed",
    "Owner declaration confirmation",
    "Declarations",
    !declarations.ownerDeclarationConfirmed
  );
  pushMissing(
    missingRequiredFields,
    "declarations.informationAccurateConfirmed",
    "Information accuracy confirmation",
    "Declarations",
    !declarations.informationAccurateConfirmed
  );
  pushMissing(
    missingConsentItems,
    "consent.declarationsConfirmed",
    "Declaration confirmation",
    "Declarations",
    !consent.declarationsConfirmed
  );

  const warnings: string[] = [];
  if (fieldValues.moreThanFiveBuildings === true) {
    warnings.push("Halifax form v1 supports up to five buildings per property. Municipal follow-up may be required.");
  }

  (fieldValues.buildings || []).forEach((building, index) => {
    if (!building.fireLifeSafetySystems.length) {
      warnings.push(`Building ${index + 1} has no fire / life-safety systems recorded yet.`);
    }
    if (!building.yearConstructed) {
      warnings.push(`Building ${index + 1} is missing year constructed.`);
    }
    if (!building.amenities.length) {
      warnings.push(`Building ${index + 1} has no amenity or shared-space details recorded.`);
    }
  });

  const trackedFields =
    8 + (fieldValues.primaryContactSameAsOwner === false ? 4 : 0) + (fieldValues.buildings || []).length * 6 + 6;
  const completedFields = Math.max(0, trackedFields - missingRequiredFields.length - missingConsentItems.length);
  const completionPercent = trackedFields > 0 ? Math.round((completedFields / trackedFields) * 100) : 0;
  const exportReady = missingRequiredFields.length === 0 && missingConsentItems.length === 0;
  const readinessScore = exportReady ? Math.max(85, completionPercent) : completionPercent;

  return {
    missingRequiredFields,
    missingConsentItems,
    warnings,
    readinessScore,
    completionPercent,
    exportReady,
  };
}

function determineStatus(
  validation: HalifaxSubmissionValidation,
  fieldValues: HalifaxSubmissionFieldValues,
  declarations: HalifaxSubmissionDeclarations,
  consent: HalifaxSubmissionConsent,
  previousStatus?: HalifaxSubmissionStatus | null
): HalifaxSubmissionStatus {
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

export function buildHalifaxRegistrySubmissionExportPayload(input: {
  property: Record<string, any>;
  submission: HalifaxSubmissionDraft;
}) {
  return {
    sourceKey: HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY,
    generatedAt: nowIso(),
    disclaimer:
      "This file is a preparation draft generated by RentChain from user-provided and stored property/account information. It is intended for review before municipal use and is not a direct Halifax filing.",
    exportMeta: {
      preparedBy: "RentChain",
      preparedAt: nowIso(),
      propertyId: input.property?.id || input.submission.propertyId,
      sourceKey: HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY,
      consentCapturedAt: input.submission.consent.preparationAuthorizedAt || null,
      declarationsConfirmedAt: input.submission.consent.declarationsConfirmedAt || null,
    },
    property: {
      propertyId: input.property?.id || input.submission.propertyId,
      propertyName: firstString(input.property?.name, input.property?.addressLine1) || "Property",
      propertyIdentifierPid: input.submission.fieldValues.propertyIdentifierPid,
    },
    jurisdiction: input.submission.jurisdiction,
    sections: {
      propertySite: {
        civicAddress: input.submission.fieldValues.siteAddress,
        moreThanFiveBuildings: input.submission.fieldValues.moreThanFiveBuildings,
      },
      propertyOwner: input.submission.fieldValues.owner,
      primaryContact:
        input.submission.fieldValues.primaryContactSameAsOwner === false
          ? input.submission.fieldValues.primaryContact
          : {
              sameAsOwner: true,
              contact: input.submission.fieldValues.owner,
            },
      buildings: input.submission.fieldValues.buildings.map((building) => ({
        primaryAddress: building.primaryAddress,
        alternateContact:
          building.hasAlternateContact === true ? building.alternateContact : { sameAsOwner: true },
        additionalCivicAddress:
          building.hasAdditionalCivicAddress === true ? building.additionalCivicAddress : null,
        rentalUnitTypes: building.rentalUnitTypes,
        otherRentalUnitType: building.otherRentalUnitType,
        residentialUnitsRented: building.residentialUnitsRented,
        shortTermRentalUnits: building.shortTermRentalUnits,
        buildingType: building.buildingType,
        otherBuildingType: building.otherBuildingType,
        totalResidentialUnits: building.totalResidentialUnits,
        hasCommercialUnits: building.hasCommercialUnits,
        amenities: building.amenities,
        fireLifeSafetySystems: building.fireLifeSafetySystems,
        accessibilityFeatures: building.accessibilityFeatures,
        yearConstructed: building.yearConstructed,
        notes: building.notes,
      })),
      buildingAttributes: {
        propertyDescription: input.submission.fieldValues.propertyDescription,
      },
      declarations: input.submission.declarations,
    },
    consent: input.submission.consent,
    fieldMeta: input.submission.fieldMeta,
    validation: input.submission.validation,
  };
}

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

export async function loadHalifaxRegistrySubmissionDraft(input: {
  property: Record<string, any>;
  landlordId: string | null;
}): Promise<HalifaxSubmissionDraft> {
  const propertyId = String(input.property?.id || "").trim();
  const landlordId = asString(input.landlordId);
  const docId = `${propertyId}__${HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY}`;
  const [draftSnap, landlordSnap, userSnap, accountSnap] = await Promise.all([
    db.collection(HALIFAX_REGISTRY_SUBMISSION_COLLECTION).doc(docId).get(),
    landlordId ? db.collection("landlords").doc(landlordId).get() : Promise.resolve(null as any),
    landlordId ? db.collection("users").doc(landlordId).get() : Promise.resolve(null as any),
    landlordId ? db.collection("accounts").doc(landlordId).get() : Promise.resolve(null as any),
  ]);

  const persisted = draftSnap?.exists ? ({ id: draftSnap.id, ...(draftSnap.data() as any) } as Partial<HalifaxSubmissionDraft>) : null;
  const landlordProfile = landlordSnap?.exists ? (landlordSnap.data() as any) : null;
  const userAccount = {
    ...(userSnap?.exists ? (userSnap.data() as any) : {}),
    ...(accountSnap?.exists ? (accountSnap.data() as any) : {}),
  };

  const prefilled = buildHalifaxRegistrySubmissionPrefill({
    property: input.property,
    landlordProfile,
    userAccount,
    persisted,
  });
  const validation = validateHalifaxRegistrySubmissionDraft(prefilled);
  const createdAt = asString(persisted?.createdAt) || nowIso();
  const updatedAt = asString(persisted?.updatedAt) || createdAt;

  return {
    id: docId,
    propertyId,
    landlordId,
    sourceKey: HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY,
    jurisdiction: {
      country: "CA",
      province: "NS",
      municipality: "Halifax",
    },
    status: determineStatus(
      validation,
      prefilled.fieldValues,
      prefilled.declarations,
      prefilled.consent,
      persisted?.status || null
    ),
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

export async function saveHalifaxRegistrySubmissionDraft(input: SaveInput): Promise<HalifaxSubmissionDraft> {
  const current = await loadHalifaxRegistrySubmissionDraft({
    property: input.property,
    landlordId: input.landlordId,
  });

  const mergedFieldValues: HalifaxSubmissionFieldValues = {
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
    propertyIdentifierPid:
      asString(input.fieldValues?.propertyIdentifierPid) ||
      current.fieldValues.propertyIdentifierPid ||
      null,
    primaryContactSameAsOwner:
      asBooleanOrNull(input.fieldValues?.primaryContactSameAsOwner) ?? current.fieldValues.primaryContactSameAsOwner,
    moreThanFiveBuildings:
      asBooleanOrNull(input.fieldValues?.moreThanFiveBuildings) ?? current.fieldValues.moreThanFiveBuildings,
    propertyDescription:
      asString(input.fieldValues?.propertyDescription) || current.fieldValues.propertyDescription || null,
  };
  const mergedDeclarations = normalizeDeclarations(input.declarations, current.declarations);
  const mergedFieldMeta = applyFieldMetaOverrides(
    deriveFieldMeta(
      mergedFieldValues,
      mergedDeclarations,
      { ...current, fieldMeta: current.fieldMeta } as Partial<HalifaxSubmissionDraft>
    ),
    input.fieldMeta
  );
  const mergedConsent = evolveConsent({
    current: current.consent,
    incoming: input.consent,
    declarations: mergedDeclarations,
    actor: asString(input.actorUserId || input.actorEmail),
  });
  const validation = validateHalifaxRegistrySubmissionDraft({
    fieldValues: mergedFieldValues,
    consent: mergedConsent,
    declarations: mergedDeclarations,
  });
  const updatedAt = nowIso();
  const next: HalifaxSubmissionDraft = {
    ...current,
    fieldValues: mergedFieldValues,
    fieldMeta: mergedFieldMeta,
    declarations: mergedDeclarations,
    consent: mergedConsent,
    validation,
    status:
      input.status ||
      determineStatus(validation, mergedFieldValues, mergedDeclarations, mergedConsent, current.status),
    updatedAt,
    updatedBy: asString(input.actorUserId || input.actorEmail) || null,
    lastReviewedAt: updatedAt,
  };

  await db.collection(HALIFAX_REGISTRY_SUBMISSION_COLLECTION).doc(current.id).set(
    {
      propertyId: current.propertyId,
      landlordId: current.landlordId,
      sourceKey: current.sourceKey,
      jurisdiction: current.jurisdiction,
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
      sourceKey: current.sourceKey,
      action: "registry_submission_preparation_authorized",
    });
  }
  if (!current.consent.declarationsConfirmed && next.consent.declarationsConfirmed) {
    await appendSubmissionAuditEvent({
      propertyId: current.propertyId,
      actorUserId: asString(input.actorUserId),
      sourceKey: current.sourceKey,
      action: "registry_submission_declarations_confirmed",
    });
  }
  await appendSubmissionAuditEvent({
    propertyId: current.propertyId,
    actorUserId: asString(input.actorUserId),
    sourceKey: current.sourceKey,
    action: "registry_submission_draft_saved",
  });

  return next;
}

export async function markHalifaxRegistrySubmissionExported(input: {
  property: Record<string, any>;
  landlordId: string | null;
  actorUserId: string | null;
  actorEmail?: string | null;
}) {
  const current = await loadHalifaxRegistrySubmissionDraft({
    property: input.property,
    landlordId: input.landlordId,
  });
  const exportedAt = nowIso();
  if (!current.validation.exportReady) {
    throw new Error("Halifax submission draft is not ready for export yet.");
  }
  const nextStatus: HalifaxSubmissionStatus = "exported";
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
