import { apiFetch } from "./apiFetch";

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
export type NetworkRelationshipStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type NetworkRelationshipType =
  | "review_relationship"
  | "sharing_relationship"
  | "operational_relationship"
  | "verification_relationship"
  | "evidence_relationship";

export type NetworkParticipantReference = {
  referenceId: string;
  referenceType: "identity" | "relationship" | "review" | "evidence" | "permission" | "sharing_room" | "settlement" | "regulatory" | "canonical_event";
  label: string;
  status: "available" | "missing" | "blocked" | "redacted";
  destination: string | null;
  occurredAt: string | null;
  redacted: boolean;
  blockedReason: string | null;
};

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
  canonicalEvents: Array<{ eventType: string; action: string; status: NetworkParticipantStatus; resourceId: string; summary: string }>;
};

export async function fetchNetworkParticipants(params?: {
  participantType?: NetworkParticipantType | "";
  participantId?: string;
  status?: NetworkParticipantStatus | "";
}): Promise<NetworkParticipantProfile[]> {
  const search = new URLSearchParams();
  if (params?.participantType) search.set("participantType", params.participantType);
  if (params?.participantId) search.set("participantId", params.participantId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; participants: NetworkParticipantProfile[] }>(`/landlord/network-participants${suffix}`);
  return response.participants;
}

export async function fetchNetworkParticipant(participantId: string): Promise<NetworkParticipantProfile> {
  const response = await apiFetch<{ ok: true; participant: NetworkParticipantProfile }>(
    `/landlord/network-participants/${encodeURIComponent(participantId)}`
  );
  return response.participant;
}
