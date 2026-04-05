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

export type HalifaxSubmissionStatus =
  | "not_started"
  | "draft"
  | "ready"
  | "exported"
  | "submitted_external"
  | "needs_review";

export interface HalifaxAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface HalifaxContact {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: HalifaxAddress;
}

export interface HalifaxBuildingDraft {
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
}

export interface HalifaxSubmissionFieldValues {
  siteAddress: HalifaxAddress;
  propertyIdentifierPid: string | null;
  owner: HalifaxContact;
  primaryContactSameAsOwner: boolean | null;
  primaryContact: HalifaxContact;
  moreThanFiveBuildings: boolean | null;
  buildings: HalifaxBuildingDraft[];
  propertyDescription: string | null;
}

export interface HalifaxSubmissionDeclarations {
  acknowledged: boolean;
  maintenancePlanConfirmed: boolean;
  ownerDeclarationConfirmed: boolean;
  informationAccurateConfirmed: boolean;
}

export interface HalifaxValidationItem {
  path: string;
  label: string;
  section: string;
}

export interface HalifaxSubmissionValidation {
  missingRequiredFields: HalifaxValidationItem[];
  warnings: string[];
  readinessScore: number;
  completionPercent: number;
}

export interface HalifaxFieldMapEntry {
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

export interface HalifaxSubmissionDraft {
  id: string;
  propertyId: string;
  landlordId: string | null;
  sourceKey: "halifax_rental_registry_form";
  jurisdiction: {
    country: "CA";
    province: "NS";
    municipality: "Halifax";
  };
  status: HalifaxSubmissionStatus;
  fieldValues: HalifaxSubmissionFieldValues;
  declarations: HalifaxSubmissionDeclarations;
  validation: HalifaxSubmissionValidation;
  exportedAt: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
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
}> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/registry-status`);
  return res.data;
}

export async function fetchHalifaxRegistrySubmission(propertyId: string): Promise<{
  submission: HalifaxSubmissionDraft;
  fieldMap: HalifaxFieldMapEntry[];
}> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/registry-submission/halifax`);
  return res.data;
}

export async function saveHalifaxRegistrySubmission(
  propertyId: string,
  payload: {
    fieldValues?: Partial<HalifaxSubmissionFieldValues>;
    declarations?: Partial<HalifaxSubmissionDeclarations>;
    status?: HalifaxSubmissionStatus | null;
  }
): Promise<{
  submission: HalifaxSubmissionDraft;
  fieldMap: HalifaxFieldMapEntry[];
}> {
  const res = await api.put(`/properties/${encodeURIComponent(propertyId)}/registry-submission/halifax`, payload);
  return res.data;
}

export async function exportHalifaxRegistrySubmission(propertyId: string): Promise<{
  submission: HalifaxSubmissionDraft;
  exportPayload: Record<string, unknown>;
}> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/registry-submission/halifax/export`);
  return res.data;
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
