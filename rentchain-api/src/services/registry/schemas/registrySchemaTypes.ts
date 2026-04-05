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

export type RegistrySubmissionDeclarationId =
  | "acknowledged"
  | "maintenancePlanConfirmed"
  | "ownerDeclarationConfirmed"
  | "informationAccurateConfirmed";

export type RegistrySubmissionDeclarationItem = {
  id: RegistrySubmissionDeclarationId;
  label: string;
  required: boolean;
  checked: boolean;
  checkedAt: string | null;
};

export type RegistrySubmissionDeclarationState = {
  items: RegistrySubmissionDeclarationItem[];
  acceptedIds: RegistrySubmissionDeclarationId[];
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
  errors?: RegistryValidationItem[];
};

export type RegistryReadinessStatus =
  | "verified"
  | "registry_ready"
  | "manual_review_in_progress"
  | "possible_mismatch"
  | "no_public_match"
  | "incomplete"
  | "unsupported_jurisdiction";

export type RegistryReadinessAction =
  | "prepare_registry_submission"
  | "complete_missing_fields"
  | "review_possible_match"
  | "resolve_mismatch"
  | "export_ready_draft"
  | "add_pid"
  | "view_verified_details"
  | "no_action_needed";

export type RegistryReadinessSummaryItem = {
  category:
    | "owner_contact"
    | "property_identity"
    | "building_details"
    | "safety_compliance"
    | "declarations_consent";
  headline: string;
  count: number;
};

export type PropertyRegistryReadiness = {
  schemaKey: string;
  schemaLabel: string;
  jurisdiction: RegistryJurisdiction;
  mode: RegistrySchemaMode;
  readinessStatus: RegistryReadinessStatus;
  readinessScore: number;
  completionPercent: number;
  exportReady: boolean;
  missingRequiredFields: RegistryValidationItem[];
  missingConsentItems: RegistryValidationItem[];
  warnings: string[];
  topMissingItems: RegistryReadinessSummaryItem[];
  nextRecommendedAction: RegistryReadinessAction;
  currentRegistryState: {
    status:
      | "verified"
      | "pending_review"
      | "possible_mismatch"
      | "manual_review"
      | "not_found"
      | "not_applicable";
    summary: string;
    publicRegistryAvailable: boolean;
  };
  registryAvailabilityNote: string | null;
  assistant: {
    title: string;
    description: string;
    ctaLabel: string;
  };
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

export type RegistrySubmissionDraftV2 = {
  schemaVersion: 2;
  draftId: string;
  assistantType:
    | "halifax_registry_submission_assistant"
    | "registry_ready_compliance_assistant";
  status: RegistrySubmissionStatus;
  timestamps: {
    createdAt: string;
    updatedAt: string;
    exportedAt: string | null;
    lastReviewedAt: string | null;
  };
  actor: {
    landlordId: string | null;
    updatedBy: string | null;
  };
  context: {
    propertyId: string;
    sourceKey: string;
    schemaKey: string;
    schemaLabel: string;
    mode: RegistrySchemaMode;
    jurisdiction: RegistryJurisdiction;
  };
  entity: {
    siteAddress: RegistryAddress;
    propertyIdentifierPid: string | null;
    moreThanFiveBuildings: boolean | null;
    propertyDescription: string | null;
    buildings: RegistryBuildingDraft[];
  };
  contact: {
    owner: RegistryContact;
    primaryContactSameAsOwner: boolean | null;
    primaryContact: RegistryContact;
  };
  people: {
    owner: RegistryContact;
    primaryContact: RegistryContact;
  };
  declarations: RegistrySubmissionDeclarationState;
  attachments: Array<{
    id: string;
    name: string;
    type: string;
    url: string | null;
  }>;
  form: {
    fieldValues: RegistrySubmissionFieldValues;
    fieldMeta: RegistrySubmissionFieldMeta;
  };
  review: {
    validation: RegistrySubmissionValidation;
  };
  submission: {
    consent: RegistrySubmissionConsent;
  };
  audit: {
    migratedFromVersion: number | string | null;
  };
  meta: {
    disclaimer: string | null;
    exportPreparedAt: string | null;
  };
};

export type RegistrySubmissionDraft = RegistrySubmissionDraftV2;

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
  draft?: Partial<RegistrySubmissionDraft> | null;
  fieldValues?: Partial<RegistrySubmissionFieldValues>;
  fieldMeta?: Partial<RegistrySubmissionFieldMeta>;
  declarations?: Partial<RegistrySubmissionDeclarations>;
  consent?: Partial<RegistrySubmissionConsent>;
  status?: RegistrySubmissionStatus | null;
};

export type RegistrySchemaDefinition = RegistrySchemaSummary & {
  fieldMap: RegistryFieldMapEntry[];
  buildPrefill: (context: RegistrySubmissionBuildContext) => {
    fieldValues: RegistrySubmissionFieldValues;
    fieldMeta: RegistrySubmissionFieldMeta;
    declarations: RegistrySubmissionDeclarations;
    consent: RegistrySubmissionConsent;
  };
  validate: (input: {
    fieldValues: RegistrySubmissionFieldValues;
    declarations: RegistrySubmissionDeclarations;
    consent: RegistrySubmissionConsent;
  }) => RegistrySubmissionValidation;
};
