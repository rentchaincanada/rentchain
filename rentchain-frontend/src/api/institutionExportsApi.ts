import { apiFetch } from "./apiFetch";

export type InstitutionExportPackageType =
  | "lender_due_diligence"
  | "insurance_review"
  | "government_program_review"
  | "auditor_review"
  | "internal_admin_review";

export type InstitutionExportSection = {
  sectionKey:
    | "property_summary"
    | "lease_summary"
    | "occupancy_summary"
    | "decision_summary"
    | "delinquency_summary"
    | "maintenance_summary"
    | "audit_event_summary";
  label: string;
  status: "included" | "blocked" | "unavailable";
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
  audience: "lender" | "insurer" | "government" | "auditor" | "internal";
  status: "preview_ready" | "blocked" | "unavailable";
  generatedAt: string;
  manualOnly: true;
  externalSubmissionEnabled: false;
  sections: InstitutionExportSection[];
  blockedReasons: string[];
  redactions: InstitutionExportRedaction[];
  payloadPreview: Record<string, any>;
};

export async function fetchInstitutionExportPreview(
  packageType: InstitutionExportPackageType
): Promise<InstitutionExportPackage> {
  const search = new URLSearchParams({ packageType });
  const response = await apiFetch<{ ok: true; package: InstitutionExportPackage }>(
    `/landlord/institution-exports/preview?${search.toString()}`
  );
  return response.package;
}
