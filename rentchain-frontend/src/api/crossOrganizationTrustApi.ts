import { apiFetch } from "./apiFetch";

export type CrossOrganizationTrustRelationshipType =
  | "operational_trust"
  | "evidence_trust"
  | "review_trust"
  | "settlement_trust"
  | "regulatory_trust"
  | "sharing_trust";

export type CrossOrganizationTrustStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";
export type CrossOrganizationTrustReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type CrossOrganizationTrustReferenceType = "evidence" | "review" | "settlement" | "regulatory" | "sharing" | "audit" | "operational";

export type CrossOrganizationTrustReference = {
  trustReferenceId: string;
  referenceType: CrossOrganizationTrustReferenceType;
  status: CrossOrganizationTrustReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type CrossOrganizationTrustRestriction = {
  restrictionId: string;
  restrictionType: "consent" | "settlement" | "regulatory" | "sharing" | "audit" | "evidence" | "review";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type CrossOrganizationTrustRelationship = {
  trustRelationshipId: string;
  relationshipType: CrossOrganizationTrustRelationshipType;
  status: CrossOrganizationTrustStatus;
  manualReviewRequired: true;
  publicTrustExposureEnabled: false;
  autonomousTrustApprovalEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  participantReferences: string[];
  reviewReferences: CrossOrganizationTrustReference[];
  evidenceReferences: CrossOrganizationTrustReference[];
  settlementReferences: CrossOrganizationTrustReference[];
  regulatoryReferences: CrossOrganizationTrustReference[];
  sharingReferences: CrossOrganizationTrustReference[];
  auditReferences: CrossOrganizationTrustReference[];
  operationalReferences: CrossOrganizationTrustReference[];
  trustRestrictions: CrossOrganizationTrustRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: CrossOrganizationTrustStatus; resourceId: string; summary: string }>;
};

export async function fetchCrossOrganizationTrustRelationships(params?: {
  relationshipType?: CrossOrganizationTrustRelationshipType | "";
  status?: CrossOrganizationTrustStatus | "";
}): Promise<CrossOrganizationTrustRelationship[]> {
  const search = new URLSearchParams();
  if (params?.relationshipType) search.set("relationshipType", params.relationshipType);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; trustRelationships: CrossOrganizationTrustRelationship[] }>(`/landlord/cross-organization-trust${suffix}`);
  return response.trustRelationships;
}

export async function fetchCrossOrganizationTrustRelationship(trustRelationshipId: string): Promise<CrossOrganizationTrustRelationship> {
  const response = await apiFetch<{ ok: true; trustRelationship: CrossOrganizationTrustRelationship }>(
    `/landlord/cross-organization-trust/${encodeURIComponent(trustRelationshipId)}`
  );
  return response.trustRelationship;
}
