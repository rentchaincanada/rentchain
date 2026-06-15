import { apiFetch } from "./apiFetch";

export type TrustComplianceSectionKey =
  | "evidence_exports"
  | "consent"
  | "privacy"
  | "retention"
  | "screening"
  | "audit_trail"
  | "incident_readiness";

export type TrustComplianceStatus = "ready" | "needs_attention" | "unavailable";
export type TrustComplianceSourceAvailability = "available" | "empty" | "unavailable" | "access_unavailable";

export type TrustComplianceSafeMetadata = {
  evidencePackageId?: string;
  manifestHash?: string;
  manifestVersion?: string;
  packageVersion?: string;
  exportFormat?: string;
  exportReason?: string;
  exportScope?: string;
  sensitivity?: string;
  retentionCategory?: string;
  consentState?: string;
  consentType?: string;
  screeningStatus?: string;
};

export type TrustComplianceSummaryItem = {
  label: string;
  description: string;
  eventType?: string | null;
  action?: string | null;
  status?: string | null;
  occurredAt: string | null;
  safeMetadata?: TrustComplianceSafeMetadata;
};

export type TrustComplianceSectionSummary = {
  key: TrustComplianceSectionKey;
  label: string;
  status: TrustComplianceStatus;
  count: number;
  lastActivityAt: string | null;
  sourceAvailability: TrustComplianceSourceAvailability;
  items: TrustComplianceSummaryItem[];
  emptyState: string;
};

export type TrustComplianceCenterSummary = {
  version: "trust_compliance_center_v1";
  generatedAt: string;
  landlordId: string;
  overallStatus: TrustComplianceStatus;
  sections: TrustComplianceSectionSummary[];
  recentAuditTrail: TrustComplianceSummaryItem[];
  redactions: string[];
};

export async function fetchTrustComplianceSummary(): Promise<TrustComplianceCenterSummary> {
  const response = await apiFetch<{ ok: true; summary: TrustComplianceCenterSummary }>("/landlord/trust-compliance/summary");
  return response.summary;
}
