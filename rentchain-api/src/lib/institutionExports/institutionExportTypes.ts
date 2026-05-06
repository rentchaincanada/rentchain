export type InstitutionExportPackageType =
  | "lender_due_diligence"
  | "insurance_review"
  | "government_program_review"
  | "auditor_review"
  | "internal_admin_review";

export type InstitutionExportAudience = "lender" | "insurer" | "government" | "auditor" | "internal";

export type InstitutionExportStatus = "preview_ready" | "blocked" | "unavailable";

export type InstitutionExportSectionStatus = "included" | "blocked" | "unavailable";

export type InstitutionExportSectionKey =
  | "property_summary"
  | "lease_summary"
  | "occupancy_summary"
  | "decision_summary"
  | "delinquency_summary"
  | "maintenance_summary"
  | "audit_event_summary";

export type InstitutionExportSection = {
  sectionKey: InstitutionExportSectionKey;
  label: string;
  status: InstitutionExportSectionStatus;
  recordsCount: number;
  blockedReasons: string[];
};

export type InstitutionExportRedaction = {
  fieldCategory: string;
  reason: string;
};

export type InstitutionExportPackage = {
  packageId: string;
  packageType: InstitutionExportPackageType;
  audience: InstitutionExportAudience;
  status: InstitutionExportStatus;
  generatedAt: string;
  manualOnly: true;
  externalSubmissionEnabled: false;
  sections: InstitutionExportSection[];
  blockedReasons: string[];
  redactions: InstitutionExportRedaction[];
  payloadPreview: Record<string, unknown>;
};

export type InstitutionExportPropertyInput = {
  id?: unknown;
  propertyId?: unknown;
  status?: unknown;
  unitsCount?: unknown;
  unitCount?: unknown;
};

export type InstitutionExportLeaseInput = {
  id?: unknown;
  leaseId?: unknown;
  status?: unknown;
  lifecycleState?: unknown;
  derivedLifecycleState?: unknown;
  unitId?: unknown;
  tenantId?: unknown;
  primaryTenantId?: unknown;
};

export type InstitutionExportUnitInput = {
  id?: unknown;
  unitId?: unknown;
  status?: unknown;
  occupancyStatus?: unknown;
  leaseId?: unknown;
};

export type InstitutionExportMaintenanceInput = {
  id?: unknown;
  status?: unknown;
  state?: unknown;
};

export type InstitutionExportDecisionInput = {
  id?: unknown;
  severity?: unknown;
  type?: unknown;
  status?: unknown;
  workflow?: {
    queue?: unknown;
  } | null;
};

export type DeriveInstitutionExportPackageInput = {
  packageType: InstitutionExportPackageType;
  landlordId?: unknown;
  generatedAt?: unknown;
  properties?: InstitutionExportPropertyInput[] | null;
  leases?: InstitutionExportLeaseInput[] | null;
  units?: InstitutionExportUnitInput[] | null;
  maintenanceRequests?: InstitutionExportMaintenanceInput[] | null;
  decisionItems?: InstitutionExportDecisionInput[] | null;
  auditEvents?: unknown[] | null;
};
