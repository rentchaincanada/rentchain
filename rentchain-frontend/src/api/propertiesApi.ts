import api from "./client";
import type { PropertyLedgerEntry } from "../types/ledger";

export interface UnitInput {
  unitNumber: string;
  rent: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  utilitiesIncluded?: string[];
}

export interface PropertyInput {
  name?: string;
  pid?: string | null;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country?: string;
  totalUnits: number;
  amenities?: string[];
  units?: UnitInput[];
}

export interface PropertyUnit extends UnitInput {
  id: string;
  status?: "vacant" | "occupied";
  occupantName?: string | null;
  leaseEndDate?: string | null;
}

export interface Property extends PropertyInput {
  id: string;
  createdAt: string;
  landlordId?: string;
  status?: "DRAFT" | "PUBLISHED" | "draft" | "published" | "active";
  portfolioStatus?: "active" | "archived";
  archivedAt?: string | null;
  archivedByUserId?: string | null;
  publishedAt?: number | null;
  screeningRequiredBeforeApproval?: boolean;
  units: PropertyUnit[];
  unitCount?: number;
  occupiedCount?: number;
  occupancyRate?: number;
}

export interface PropertyRegistryStatus {
  id: string;
  propertyId: string;
  sourceKey: "halifax_r400";
  jurisdictionProvince: string;
  jurisdictionMunicipality: string;
  registryStatus:
    | "verified"
    | "pending_review"
    | "not_found"
    | "possible_mismatch"
    | "manual_review";
  registryRecordId: string | null;
  registrationNumber: string | null;
  pid: string | null;
  matchedAt: string | null;
  matchConfidence: number | null;
  summary: string;
  recommendedAction: string;
  lastSourceRefreshAt: string | null;
  lastEvaluatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type RegistrySchemaMode =
  | "official_registry"
  | "municipal_registry"
  | "registry_ready_fallback";

export interface RegistrySchemaSummary {
  schemaKey: string;
  sourceKey: string;
  label: string;
  mode: RegistrySchemaMode;
  jurisdiction: {
    country: string;
    province: string | null;
    municipality: string | null;
  };
}

export type RegistrySubmissionStatus =
  | "not_started"
  | "draft"
  | "ready"
  | "exported"
  | "submitted_external"
  | "needs_review";

export type HalifaxSubmissionStatus = RegistrySubmissionStatus;

export interface RegistrySubmissionAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
}

export type HalifaxAddress = RegistrySubmissionAddress;

export interface RegistrySubmissionContact {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: RegistrySubmissionAddress;
}

export type HalifaxContact = RegistrySubmissionContact;

export interface RegistrySubmissionBuildingDraft {
  id: string;
  primaryAddress: RegistrySubmissionAddress;
  hasAlternateContact: boolean | null;
  alternateContact: RegistrySubmissionContact;
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
}

export type HalifaxBuildingDraft = RegistrySubmissionBuildingDraft;

export interface RegistrySubmissionFieldValues {
  siteAddress: RegistrySubmissionAddress;
  propertyIdentifierPid: string | null;
  owner: RegistrySubmissionContact;
  primaryContactSameAsOwner: boolean | null;
  primaryContact: RegistrySubmissionContact;
  moreThanFiveBuildings: boolean | null;
  buildings: RegistrySubmissionBuildingDraft[];
  propertyDescription: string | null;
}

export type HalifaxSubmissionFieldValues = RegistrySubmissionFieldValues;

export interface RegistrySubmissionDeclarations {
  acknowledged: boolean;
  maintenancePlanConfirmed: boolean;
  ownerDeclarationConfirmed: boolean;
  informationAccurateConfirmed: boolean;
}

export type RegistrySubmissionDeclarationId =
  | "acknowledged"
  | "maintenancePlanConfirmed"
  | "ownerDeclarationConfirmed"
  | "informationAccurateConfirmed";

export interface RegistrySubmissionDeclarationItem {
  id: RegistrySubmissionDeclarationId;
  label: string;
  required: boolean;
  checked: boolean;
  checkedAt: string | null;
}

export interface RegistrySubmissionDeclarationState {
  items: RegistrySubmissionDeclarationItem[];
  acceptedIds: RegistrySubmissionDeclarationId[];
}

export type HalifaxSubmissionDeclarations = RegistrySubmissionDeclarationState;

export interface RegistrySubmissionConsent {
  preparationAuthorized: boolean;
  preparationAuthorizedAt: string | null;
  preparationAuthorizedBy: string | null;
  declarationsConfirmed: boolean;
  declarationsConfirmedAt: string | null;
  declarationsConfirmedBy: string | null;
  finalReviewConfirmed: boolean;
  finalReviewConfirmedAt: string | null;
}

export type HalifaxSubmissionConsent = RegistrySubmissionConsent;

export type RegistryFieldProvenanceStatus =
  | "prefilled_from_rentchain"
  | "provided_by_user"
  | "needs_confirmation"
  | "missing";

export type HalifaxFieldProvenanceStatus = RegistryFieldProvenanceStatus;

export interface RegistryFieldMetaEntry {
  source:
    | "rentchain_property"
    | "rentchain_profile"
    | "rentchain_account"
    | "derived"
    | "manual"
    | "unknown";
  status: RegistryFieldProvenanceStatus;
  confirmed: boolean;
}

export type HalifaxFieldMetaEntry = RegistryFieldMetaEntry;
export type RegistrySubmissionFieldMeta = Record<string, RegistryFieldMetaEntry>;
export type HalifaxSubmissionFieldMeta = RegistrySubmissionFieldMeta;

export interface RegistryValidationItem {
  path: string;
  label: string;
  section: string;
}

export type HalifaxValidationItem = RegistryValidationItem;

export interface RegistrySubmissionValidation {
  missingRequiredFields: RegistryValidationItem[];
  missingConsentItems: RegistryValidationItem[];
  warnings: string[];
  readinessScore: number;
  completionPercent: number;
  exportReady: boolean;
  errors?: RegistryValidationItem[];
}

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

export interface RegistryReadinessSummaryItem {
  category:
    | "owner_contact"
    | "property_identity"
    | "building_details"
    | "safety_compliance"
    | "declarations_consent";
  headline: string;
  count: number;
}

export interface PropertyRegistryReadiness {
  schemaKey: string;
  schemaLabel: string;
  jurisdiction: RegistrySchemaSummary["jurisdiction"];
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
}

export type RegistrySubmissionLifecycleStatus =
  | "in_review"
  | "ready_to_file"
  | "filed_pending_confirmation"
  | "filed_confirmed"
  | "rejected"
  | "failed"
  | "cancelled";

export type RegistryFilingChannel = "manual_portal" | "assisted_filing" | "api_upload";

export interface RegistrySubmissionAuditEventV3 {
  at: string;
  actorId: string | null;
  type: string;
  status: RegistrySubmissionLifecycleStatus | null;
  note: string | null;
}

export interface RegistrySubmissionReferenceNumberV3 {
  type: "submission_id" | "receipt" | "registry_number" | "external_reference";
  value: string;
  label: string | null;
  recordedAt: string;
  recordedBy: string | null;
}

export interface RegistrySubmissionEvidenceV3 {
  id: string;
  type: "pdf" | "html_snapshot" | "email" | "screenshot" | "other";
  label: string;
  url: string | null;
  note: string | null;
  recordedAt: string;
  recordedBy: string | null;
}

export interface RegistrySubmissionNormalizedFieldV3 {
  id: string;
  label: string;
  value: string | number | boolean | null;
  required: boolean;
}

export interface RegistrySubmissionNormalizedSectionV3 {
  id: string;
  label: string;
  fields: RegistrySubmissionNormalizedFieldV3[];
}

export interface RegistrySubmissionReadyV3 {
  schemaVersion: 3;
  readyId: string;
  sourceDraftId: string;
  sourceDraftVersion: 2;
  propertyId: string;
  sourceKey: string;
  schemaKey: string;
  schemaLabel: string;
  assistantType: RegistrySubmissionDraftV2["assistantType"];
  filingChannel: RegistryFilingChannel;
  status: "in_review" | "ready_to_file";
  createdAt: string;
  updatedAt: string;
  actor: {
    landlordId: string | null;
    updatedBy: string | null;
  };
  jurisdiction: RegistrySchemaSummary["jurisdiction"];
  validation: RegistrySubmissionValidation;
  consentLock: RegistrySubmissionConsent;
  declarationsLock: RegistrySubmissionDeclarationState;
  normalizedSubmission: {
    sections: RegistrySubmissionNormalizedSectionV3[];
    attachments: RegistrySubmissionDraftV2["attachments"];
    disclaimer: string | null;
  };
  audit: {
    sourceDraftUpdatedAt: string;
    events: RegistrySubmissionAuditEventV3[];
  };
}

export interface RegistrySubmissionRequestV3 {
  schemaVersion: 3;
  requestId: string;
  readyId: string;
  sourceDraftId: string;
  propertyId: string;
  sourceKey: string;
  schemaKey: string;
  schemaLabel: string;
  filingChannel: RegistryFilingChannel;
  adapterKey: string;
  status: RegistrySubmissionLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  actor: {
    requestedBy: string | null;
    updatedBy: string | null;
  };
  checklist: {
    portalUrl: string | null;
    steps: string[];
    notes: string[];
  };
  payload: {
    sections: RegistrySubmissionNormalizedSectionV3[];
    disclaimer: string | null;
  };
  referenceNumbers: RegistrySubmissionReferenceNumberV3[];
  operatorNotes: string | null;
  evidence: RegistrySubmissionEvidenceV3[];
  audit: {
    events: RegistrySubmissionAuditEventV3[];
  };
}

export interface RegistrySubmissionResultV3 {
  schemaVersion: 3;
  resultId: string;
  requestId: string;
  readyId: string;
  sourceDraftId: string;
  propertyId: string;
  sourceKey: string;
  schemaKey: string;
  filingChannel: RegistryFilingChannel;
  adapterKey: string;
  status: Extract<
    RegistrySubmissionLifecycleStatus,
    "filed_pending_confirmation" | "filed_confirmed" | "rejected" | "failed" | "cancelled"
  >;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  actor: {
    updatedBy: string | null;
  };
  referenceNumbers: RegistrySubmissionReferenceNumberV3[];
  operatorNotes: string | null;
  evidence: RegistrySubmissionEvidenceV3[];
  outcome: {
    message: string | null;
  };
  audit: {
    events: RegistrySubmissionAuditEventV3[];
  };
}

export interface RegistrySubmissionFilingSummaryV3 {
  ready: RegistrySubmissionReadyV3 | null;
  request: RegistrySubmissionRequestV3 | null;
  result: RegistrySubmissionResultV3 | null;
  currentStatus: RegistrySubmissionLifecycleStatus | null;
}

export type HalifaxSubmissionValidation = RegistrySubmissionValidation;

export interface RegistryFieldMapEntry {
  path: string;
  label: string;
  section: string;
  required: boolean;
  source:
    | "property"
    | "landlord_profile"
    | "user_account"
    | "derived"
    | "user_input_required"
    | "unsupported";
  confidence: "high" | "medium" | "low";
  notes?: string;
}

export type HalifaxFieldMapEntry = RegistryFieldMapEntry;

export interface RegistrySubmissionDraftV2 {
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
    jurisdiction: RegistrySchemaSummary["jurisdiction"];
  };
  entity: {
    siteAddress: RegistrySubmissionAddress;
    propertyIdentifierPid: string | null;
    moreThanFiveBuildings: boolean | null;
    propertyDescription: string | null;
    buildings: RegistrySubmissionBuildingDraft[];
  };
  contact: {
    owner: RegistrySubmissionContact;
    primaryContactSameAsOwner: boolean | null;
    primaryContact: RegistrySubmissionContact;
  };
  people: {
    owner: RegistrySubmissionContact;
    primaryContact: RegistrySubmissionContact;
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
}

export type RegistrySubmissionDraft = RegistrySubmissionDraftV2;
export type HalifaxSubmissionDraft = RegistrySubmissionDraftV2;

export function buildRegistrySubmissionDraftV2(
  draft: RegistrySubmissionDraftV2
): RegistrySubmissionDraftV2 {
  const items = (draft.declarations.items || []).map((item) => ({
    ...item,
    checkedAt: item.checked ? item.checkedAt || new Date().toISOString() : null,
  }));
  return {
    ...draft,
    declarations: {
      items,
      acceptedIds: items.filter((item) => item.checked).map((item) => item.id),
    },
    review: {
      ...draft.review,
      validation: {
        ...draft.review.validation,
        errors:
          draft.review.validation.errors ||
          [...draft.review.validation.missingRequiredFields, ...draft.review.validation.missingConsentItems],
      },
    },
  };
}

export function hydrateRegistryAssistantUiState(
  draft: RegistrySubmissionDraftV2
): RegistrySubmissionDraftV2 {
  return buildRegistrySubmissionDraftV2(draft);
}

export function exportRegistrySubmissionDraftV2(
  draft: RegistrySubmissionDraftV2
): RegistrySubmissionDraftV2 {
  return {
    ...buildRegistrySubmissionDraftV2(draft),
    meta: {
      ...draft.meta,
      exportPreparedAt: new Date().toISOString(),
    },
  };
}

export async function createProperty(
  payload: PropertyInput
): Promise<{ property: Property }> {
  const res = await api.post("/properties", payload);
  const data = res.data;
  const property = (data as any)?.property ?? (data as any);
  return { property } as { property: Property };
}

export async function fetchProperties(filters?: {
  status?: "active" | "archived";
  includeArchived?: boolean;
}): Promise<{ properties: Property[]; items?: Property[] }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.includeArchived) params.set("includeArchived", "1");
  const path = params.toString() ? `/properties?${params.toString()}` : "/properties";
  const res = await api.get(path);
  return res.data;
}

export async function fetchPropertyLedger(
  propertyId: string
): Promise<PropertyLedgerEntry[]> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/ledger`);
  return res.data as PropertyLedgerEntry[];
}

export async function fetchPropertyRegistryStatus(propertyId: string): Promise<{
  status: PropertyRegistryStatus | null;
  source: {
    sourceKey: "halifax_r400";
    sourceLabel: string;
    jurisdictionProvince: string;
    jurisdictionMunicipality: string;
  };
  coverage: {
    available: boolean;
    message: string | null;
  };
  pidPrompt: {
    propertyPid: string | null;
    propertyPidMissing: boolean;
    registryPid: string | null;
    registryPidAvailable: boolean;
    pidPromptEligible: boolean;
    pidPromptMessage: string | null;
    sourceLabel: string;
    actionable: boolean;
  };
  readiness: PropertyRegistryReadiness;
  filing: RegistrySubmissionFilingSummaryV3;
}> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/registry-status`);
  return res.data;
}

export async function fetchPropertyRegistrySubmission(propertyId: string): Promise<{
  submission: RegistrySubmissionDraft;
  fieldMap: RegistryFieldMapEntry[];
  schema: RegistrySchemaSummary;
  filing: RegistrySubmissionFilingSummaryV3;
}> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/registry-submission`);
  return res.data;
}

export async function fetchHalifaxRegistrySubmission(propertyId: string) {
  return fetchPropertyRegistrySubmission(propertyId);
}

export async function savePropertyRegistrySubmission(
  propertyId: string,
  payload: {
    draft?: RegistrySubmissionDraft;
    fieldValues?: Partial<RegistrySubmissionFieldValues>;
    fieldMeta?: Partial<RegistrySubmissionFieldMeta>;
    declarations?: Partial<RegistrySubmissionDeclarations>;
    consent?: Partial<RegistrySubmissionConsent>;
    status?: RegistrySubmissionStatus | null;
  }
): Promise<{
  submission: RegistrySubmissionDraft;
  fieldMap: RegistryFieldMapEntry[];
  schema: RegistrySchemaSummary;
  filing: RegistrySubmissionFilingSummaryV3;
}> {
  const res = await api.put(`/properties/${encodeURIComponent(propertyId)}/registry-submission`, payload);
  return res.data;
}

export async function saveHalifaxRegistrySubmission(propertyId: string, payload: Parameters<typeof savePropertyRegistrySubmission>[1]) {
  return savePropertyRegistrySubmission(propertyId, payload);
}

export async function exportPropertyRegistrySubmission(propertyId: string): Promise<{
  submission: RegistrySubmissionDraft;
  exportPayload: RegistrySubmissionDraft;
  schema: RegistrySchemaSummary;
}> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/registry-submission/export`);
  return res.data;
}

export async function exportHalifaxRegistrySubmission(propertyId: string) {
  return exportPropertyRegistrySubmission(propertyId);
}

export async function createRegistrySubmissionReady(
propertyId: string
): Promise<{ ready: RegistrySubmissionReadyV3 | null }> {
  const res = await api.post(`/properties/${encodeURIComponent(propertyId)}/registry-submission/ready`, {});
  return res.data;
}

export async function fetchRegistrySubmissionReady(
propertyId: string
): Promise<{ ready: RegistrySubmissionReadyV3 | null }> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/registry-submission/ready`);
  return res.data;
}

export async function createRegistrySubmissionFilingRequest(
  propertyId: string
): Promise<{ request: RegistrySubmissionRequestV3 }> {
  const res = await api.post(`/properties/${encodeURIComponent(propertyId)}/registry-submission/filing-request`, {});
  return res.data;
}

export async function updateRegistrySubmissionFilingStatus(
  propertyId: string,
  payload: {
    status: Extract<
      RegistrySubmissionLifecycleStatus,
      "filed_pending_confirmation" | "filed_confirmed" | "rejected" | "failed" | "cancelled"
    >;
    note?: string | null;
    referenceNumbers?: Array<Partial<RegistrySubmissionReferenceNumberV3>>;
    evidence?: Array<Partial<RegistrySubmissionEvidenceV3>>;
  }
): Promise<{ filing: RegistrySubmissionFilingSummaryV3 }> {
  const res = await api.patch(`/properties/${encodeURIComponent(propertyId)}/registry-submission/filing-request`, payload);
  return res.data;
}

export async function createReadyFromDraft(propertyId: string) {
  return createRegistrySubmissionReady(propertyId);
}

export async function getReady(propertyId: string) {
  return fetchRegistrySubmissionReady(propertyId);
}

export async function attachFilingReferenceAndNotes(
  propertyId: string,
  payload: {
    status?: "filed_pending_confirmation";
    note?: string | null;
    referenceNumber?: string | null;
    evidenceReference?: string | null;
  }
) {
  return updateRegistrySubmissionFilingStatus(propertyId, {
    status: payload.status || "filed_pending_confirmation",
    note: payload.note || null,
    referenceNumbers: payload.referenceNumber
      ? [
          {
            type: "external_reference",
            value: payload.referenceNumber,
            label: "Reference number",
          },
        ]
      : [],
    evidence: payload.evidenceReference
      ? [
          {
            id: `evidence-${Date.now()}`,
            type: "other",
            label: "Evidence reference",
            note: payload.evidenceReference,
          },
        ]
      : [],
  });
}

export async function updateProperty(
  propertyId: string,
  payload: Partial<Property>
): Promise<{ property: Property }> {
  const res = await api.patch(`/properties/${encodeURIComponent(propertyId)}`, payload);
  const data = res.data;
  const property = (data as any)?.property ?? (data as any);
  return { property } as { property: Property };
}

export async function publishProperty(
  propertyId: string
): Promise<{ property: Property }> {
  const res = await api.post(`/properties/${encodeURIComponent(propertyId)}/publish`, {});
  const data = res.data;
  const property = (data as any)?.property ?? (data as any);
  return { property } as { property: Property };
}

export async function archiveProperty(
  propertyId: string
): Promise<{ property: Property }> {
  const res = await api.post(`/properties/${encodeURIComponent(propertyId)}/archive`, {});
  const data = res.data;
  const property = (data as any)?.property ?? (data as any);
  return { property } as { property: Property };
}

export async function unarchiveProperty(
  propertyId: string
): Promise<{ property: Property }> {
  const res = await api.post(`/properties/${encodeURIComponent(propertyId)}/unarchive`, {});
  const data = res.data;
  const property = (data as any)?.property ?? (data as any);
  return { property } as { property: Property };
}

export async function importUnitsCsv(propertyId: string, csvText: string) {
  const res = await api.post(
    `/properties/${propertyId}/units/import`,
    { csvText },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}
