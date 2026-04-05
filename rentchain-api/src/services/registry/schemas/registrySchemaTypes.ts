export type RegistrySchemaMode =
  | "official_registry"
  | "municipal_registry"
  | "registry_ready_fallback";

export type RegistrySubmissionStatus =
  | "not_started"
  | "draft"
  | "ready"
  | "exported"
  | "submitted_external"
  | "needs_review";

export type RegistryFieldSource =
  | "property"
  | "landlord_profile"
  | "user_account"
  | "derived"
  | "user_input_required"
  | "unsupported";

export type RegistryMappingConfidence = "high" | "medium" | "low";

export type RegistryAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
};

export type RegistryContact = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: RegistryAddress;
};

export type RegistryBuildingDraft = {
  id: string;
  primaryAddress: RegistryAddress;
  hasAlternateContact: boolean | null;
  alternateContact: RegistryContact;
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

export type RegistrySubmissionFieldValues = {
  siteAddress: RegistryAddress;
  propertyIdentifierPid: string | null;
  owner: RegistryContact;
  primaryContactSameAsOwner: boolean | null;
  primaryContact: RegistryContact;
  moreThanFiveBuildings: boolean | null;
  buildings: RegistryBuildingDraft[];
  propertyDescription: string | null;
};

export type RegistrySubmissionDeclarations = {
  acknowledged: boolean;
  maintenancePlanConfirmed: boolean;
  ownerDeclarationConfirmed: boolean;
  informationAccurateConfirmed: boolean;
};

export type RegistrySubmissionConsent = {
  preparationAuthorized: boolean;
  preparationAuthorizedAt: string | null;
  preparationAuthorizedBy: string | null;
  declarationsConfirmed: boolean;
  declarationsConfirmedAt: string | null;
  declarationsConfirmedBy: string | null;
  finalReviewConfirmed: boolean;
  finalReviewConfirmedAt: string | null;
};

export type RegistryFieldProvenanceStatus =
  | "prefilled_from_rentchain"
  | "provided_by_user"
  | "needs_confirmation"
  | "missing";

export type RegistryFieldMetaEntry = {
  source:
    | "rentchain_property"
    | "rentchain_profile"
    | "rentchain_account"
    | "derived"
    | "manual"
    | "unknown";
  status: RegistryFieldProvenanceStatus;
  confirmed: boolean;
};

export type RegistrySubmissionFieldMeta = Record<string, RegistryFieldMetaEntry>;

export type RegistryValidationItem = {
  path: string;
  label: string;
  section: string;
};

export type RegistrySubmissionValidation = {
  missingRequiredFields: RegistryValidationItem[];
  missingConsentItems: RegistryValidationItem[];
  warnings: string[];
  readinessScore: number;
  completionPercent: number;
  exportReady: boolean;
};

export type RegistryJurisdiction = {
  country: string;
  province: string | null;
  municipality: string | null;
};

export type RegistryFieldMapEntry = {
  path: string;
  label: string;
  section: string;
  required: boolean;
  source: RegistryFieldSource;
  confidence: RegistryMappingConfidence;
  notes?: string;
};

export type RegistrySchemaSummary = {
  schemaKey: string;
  sourceKey: string;
  label: string;
  mode: RegistrySchemaMode;
  jurisdiction: RegistryJurisdiction;
};

export type RegistrySubmissionDraft = {
  id: string;
  propertyId: string;
  landlordId: string | null;
  sourceKey: string;
  schemaKey: string;
  schemaLabel: string;
  mode: RegistrySchemaMode;
  jurisdiction: RegistryJurisdiction;
  status: RegistrySubmissionStatus;
  fieldValues: RegistrySubmissionFieldValues;
  fieldMeta: RegistrySubmissionFieldMeta;
  declarations: RegistrySubmissionDeclarations;
  consent: RegistrySubmissionConsent;
  validation: RegistrySubmissionValidation;
  exportedAt: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type RegistrySubmissionBuildContext = {
  property: Record<string, any>;
  landlordProfile?: Record<string, any> | null;
  userAccount?: Record<string, any> | null;
  persisted?: Partial<RegistrySubmissionDraft> | null;
};

export type RegistrySubmissionSaveInput = {
  property: Record<string, any>;
  landlordId: string | null;
  actorUserId: string | null;
  actorEmail?: string | null;
  fieldValues?: Partial<RegistrySubmissionFieldValues>;
  fieldMeta?: Partial<RegistrySubmissionFieldMeta>;
  declarations?: Partial<RegistrySubmissionDeclarations>;
  consent?: Partial<RegistrySubmissionConsent>;
  status?: RegistrySubmissionStatus | null;
};

export type RegistrySchemaDefinition = RegistrySchemaSummary & {
  fieldMap: RegistryFieldMapEntry[];
  buildPrefill: (
    context: RegistrySubmissionBuildContext
  ) => Pick<RegistrySubmissionDraft, "fieldValues" | "fieldMeta" | "declarations" | "consent">;
  validate: (input: {
    fieldValues: RegistrySubmissionFieldValues;
    declarations: RegistrySubmissionDeclarations;
    consent: RegistrySubmissionConsent;
  }) => RegistrySubmissionValidation;
  buildExportPayload: (input: {
    property: Record<string, any>;
    submission: RegistrySubmissionDraft;
  }) => Record<string, unknown>;
};
