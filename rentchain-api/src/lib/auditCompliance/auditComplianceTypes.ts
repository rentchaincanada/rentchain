import type { InstitutionExportPackage, InstitutionExportRedaction } from "../institutionExports/institutionExportTypes";
import type { DecisionInboxItem } from "../decisions/decisionInboxTypes";

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

export type AuditComplianceCheckStatus = "passed" | "needs_attention" | "blocked" | "unavailable";

export type AuditComplianceSeverity = "critical" | "high" | "medium" | "low" | "info";

export type AuditComplianceCheckKey =
  | "property_identity_present"
  | "lease_traceability"
  | "occupancy_summary_available"
  | "payment_summary_available"
  | "decision_workflow_reviewable"
  | "delinquency_actions_manual_only"
  | "institution_export_preview_only"
  | "audit_event_coverage"
  | "policy_evaluation_available"
  | "sensitive_data_redacted"
  | "external_submission_disabled"
  | "automated_reporting_disabled";

export type AuditComplianceCheck = {
  checkKey: AuditComplianceCheckKey;
  label: string;
  status: AuditComplianceCheckStatus;
  severity: AuditComplianceSeverity;
  evidence: string[];
  missingEvidence: string[];
  blockedReasons: string[];
  manualReviewRequired: true;
};

export type AuditComplianceSummary = {
  totalChecks: number;
  passed: number;
  needsAttention: number;
  blocked: number;
  unavailable: number;
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
  summary: AuditComplianceSummary;
  checks: AuditComplianceCheck[];
  redactions: InstitutionExportRedaction[];
  disclaimers: string[];
};

export type AuditCompliancePropertyInput = {
  id?: unknown;
  propertyId?: unknown;
  address?: unknown;
  status?: unknown;
};

export type AuditComplianceLeaseInput = {
  id?: unknown;
  leaseId?: unknown;
  propertyId?: unknown;
  unitId?: unknown;
  tenantId?: unknown;
  primaryTenantId?: unknown;
  status?: unknown;
};

export type AuditCompliancePaymentInput = {
  id?: unknown;
  paymentId?: unknown;
  rentPaymentId?: unknown;
  leaseId?: unknown;
  status?: unknown;
};

export type AuditComplianceEventInput = {
  id?: unknown;
  type?: unknown;
  domain?: unknown;
  action?: unknown;
};

export type DeriveAuditComplianceReadinessInput = {
  scope?: AuditComplianceScope;
  landlordId?: unknown;
  propertyId?: unknown;
  leaseId?: unknown;
  generatedAt?: unknown;
  properties?: AuditCompliancePropertyInput[] | null;
  leases?: AuditComplianceLeaseInput[] | null;
  rentPayments?: AuditCompliancePaymentInput[] | null;
  decisions?: DecisionInboxItem[] | null;
  auditEvents?: AuditComplianceEventInput[] | null;
  policyEvents?: AuditComplianceEventInput[] | null;
  institutionExportPackage?: InstitutionExportPackage | null;
};
