export type CrossOrganizationTrustRelationshipType =
  | "operational_trust"
  | "evidence_trust"
  | "review_trust"
  | "settlement_trust"
  | "regulatory_trust"
  | "sharing_trust";

export type CrossOrganizationTrustStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

export type CrossOrganizationTrustReferenceType = "evidence" | "review" | "settlement" | "regulatory" | "sharing" | "audit" | "operational";

export type CrossOrganizationTrustReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type CrossOrganizationTrustCanonicalEventType =
  | "cross_organization_trust_derived"
  | "cross_organization_trust_verified"
  | "cross_organization_trust_review_required"
  | "cross_organization_trust_blocked"
  | "cross_organization_trust_redaction_applied";

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

export type CrossOrganizationTrustCanonicalEvent = {
  eventType: CrossOrganizationTrustCanonicalEventType;
  action: string;
  status: CrossOrganizationTrustStatus;
  resourceType: "cross_organization_trust";
  resourceId: string;
  summary: string;
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
  canonicalEvents: CrossOrganizationTrustCanonicalEvent[];
};

export type DeriveCrossOrganizationTrustInput = {
  landlordId?: unknown;
  relationshipType?: unknown;
  generatedAt?: unknown;
  networkParticipants?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  settlementReadiness?: Record<string, any> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  sharingRooms?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
  consentRecords?: Array<Record<string, any>> | null;
};
