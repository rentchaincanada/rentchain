import { apiFetch } from "./apiFetch";
import type { InstitutionExportRedaction } from "./institutionExportsApi";

export type AuditComplianceScope =
  | "landlord_portfolio"
  | "property"
  | "lease"
  | "export_package"
  | "admin_review";

export type AuditComplianceReadinessStatus =
  | "ready_for_review"
  | "needs_attention"
  | "blocked"
  | "unavailable";

export type AuditComplianceCheck = {
  checkKey: string;
  label: string;
  status: "passed" | "needs_attention" | "blocked" | "unavailable";
  severity: "critical" | "high" | "medium" | "low" | "info";
  evidence: string[];
  missingEvidence: string[];
  blockedReasons: string[];
  manualReviewRequired: true;
};

export type AuditComplianceReadiness = {
  readinessId: string;
  scope: AuditComplianceScope;
  status: AuditComplianceReadinessStatus;
  manualOnly: true;
  certificationIssued: false;
  externalFilingEnabled: false;
  automatedReportingEnabled: false;
  generatedAt: string;
  summary: {
    totalChecks: number;
    passed: number;
    needsAttention: number;
    blocked: number;
    unavailable: number;
  };
  checks: AuditComplianceCheck[];
  redactions: InstitutionExportRedaction[];
  disclaimers: string[];
};

export type AuditComplianceReadinessQuery = {
  scope?: AuditComplianceScope;
  propertyId?: string;
  leaseId?: string;
  packageType?:
    | "lender_due_diligence"
    | "insurance_review"
    | "government_program_review"
    | "auditor_review"
    | "internal_admin_review";
};

export async function fetchAuditComplianceReadiness(
  params?: AuditComplianceReadinessQuery
): Promise<AuditComplianceReadiness> {
  const search = new URLSearchParams();
  if (params?.scope) search.set("scope", params.scope);
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  if (params?.leaseId) search.set("leaseId", params.leaseId);
  if (params?.packageType) search.set("packageType", params.packageType);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; readiness: AuditComplianceReadiness }>(
    `/landlord/audit-compliance/readiness${suffix}`
  );
  return response.readiness;
}
