export type NetworkParticipantType =
  | "landlord"
  | "operator"
  | "lender"
  | "insurer"
  | "auditor"
  | "regulator"
  | "contractor"
  | "institutional_partner"
  | "review_actor";

export type NetworkParticipantStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

export type NetworkRelationshipType =
  | "review_relationship"
  | "sharing_relationship"
  | "operational_relationship"
  | "verification_relationship"
  | "evidence_relationship";

export type NetworkRelationshipStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type NetworkParticipantCanonicalEventType =
  | "network_participant_profile_derived"
  | "network_relationship_verified"
  | "network_relationship_review_required"
  | "network_relationship_blocked"
  | "network_relationship_redaction_applied";

export type NetworkRelationshipReference = {
  relationshipId: string;
  relationshipType: NetworkRelationshipType;
  status: NetworkRelationshipStatus;
  label: string;
  description: string;
  reviewRequired: true;
  participantReferences: string[];
  evidenceLineage: string[];
  reviewLineage: string[];
  permissionReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type NetworkParticipantReference = {
  referenceId: string;
  referenceType:
    | "identity"
    | "relationship"
    | "review"
    | "evidence"
    | "permission"
    | "sharing_room"
    | "settlement"
    | "regulatory"
    | "canonical_event";
  label: string;
  status: "available" | "missing" | "blocked" | "redacted";
  destination: string | null;
  occurredAt: string | null;
  redacted: boolean;
  blockedReason: string | null;
};

export type NetworkParticipantCanonicalEvent = {
  eventType: NetworkParticipantCanonicalEventType;
  action: string;
  status: NetworkParticipantStatus;
  resourceType: "network_participant";
  resourceId: string;
  summary: string;
};

export type NetworkParticipantProfile = {
  participantId: string;
  participantType: NetworkParticipantType;
  status: NetworkParticipantStatus;
  manualReviewRequired: true;
  publiclyDiscoverable: false;
  externalRelationshipExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalRelationships: number;
    verifiedRelationships: number;
    partiallyVerifiedRelationships: number;
    blockedRelationships: number;
    unavailableRelationships: number;
    evidenceReferences: number;
    reviewReferences: number;
    permissionReferences: number;
  };
  identityReferences: NetworkParticipantReference[];
  relationshipReferences: NetworkRelationshipReference[];
  reviewReferences: NetworkParticipantReference[];
  evidenceReferences: NetworkParticipantReference[];
  permissionReferences: NetworkParticipantReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: NetworkParticipantCanonicalEvent[];
};

export type DeriveNetworkParticipantProfileInput = {
  landlordId?: unknown;
  participantType?: unknown;
  participantId?: unknown;
  generatedAt?: unknown;
  identityProfiles?: Array<Record<string, any>> | null;
  sharingRooms?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  settlementReadiness?: Record<string, any> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  canonicalEvents?: Array<Record<string, any>> | null;
  contractorProfiles?: Array<Record<string, any>> | null;
};
