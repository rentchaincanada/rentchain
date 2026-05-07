import { apiFetch } from "./apiFetch";

export type CourtDisputeLineageStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";
export type CourtDisputeReferenceType =
  | "dispute"
  | "court_record"
  | "filing_readiness"
  | "judgment_order"
  | "rental_debt"
  | "consent"
  | "review"
  | "evidence"
  | "audit";
export type CourtDisputeReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type CourtDisputeReference = {
  referenceId: string;
  referenceType: CourtDisputeReferenceType;
  status: CourtDisputeReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type CourtDisputeRestriction = {
  restrictionId: string;
  restrictionType:
    | CourtDisputeReferenceType
    | "legal_filing_execution"
    | "collections_execution"
    | "bureau_reporting"
    | "public_court_record_exposure";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type CourtDisputeLineageProfile = {
  courtDisputeLineageId: string;
  status: CourtDisputeLineageStatus;
  landlordId: string;
  tenantId: string;
  manualReviewRequired: true;
  legalFilingExecutionEnabled: false;
  collectionsExecutionEnabled: false;
  bureauReportingEnabled: false;
  publicCourtRecordExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  disputeReferences: CourtDisputeReference[];
  courtRecordReferences: CourtDisputeReference[];
  filingReadinessReferences: CourtDisputeReference[];
  judgmentOrderReferences: CourtDisputeReference[];
  rentalDebtReferences: CourtDisputeReference[];
  consentReferences: CourtDisputeReference[];
  reviewReferences: CourtDisputeReference[];
  evidenceReferences: CourtDisputeReference[];
  auditReferences: CourtDisputeReference[];
  courtDisputeRestrictions: CourtDisputeRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: CourtDisputeLineageStatus; resourceId: string; summary: string }>;
};

export async function fetchCourtDisputeLineageProfiles(params?: {
  tenantId?: string;
  disputeId?: string;
  status?: CourtDisputeLineageStatus | "";
}): Promise<CourtDisputeLineageProfile[]> {
  const search = new URLSearchParams();
  if (params?.tenantId) search.set("tenantId", params.tenantId);
  if (params?.disputeId) search.set("disputeId", params.disputeId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: CourtDisputeLineageProfile[] }>(`/landlord/court-dispute-lineage${suffix}`);
  return response.profiles;
}

export async function fetchCourtDisputeLineageProfile(courtDisputeLineageId: string): Promise<CourtDisputeLineageProfile> {
  const response = await apiFetch<{ ok: true; profile: CourtDisputeLineageProfile }>(
    `/landlord/court-dispute-lineage/${encodeURIComponent(courtDisputeLineageId)}`
  );
  return response.profile;
}
