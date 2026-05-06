import { apiFetch } from "./apiFetch";

export type SharingRoomType =
  | "lender_review"
  | "insurer_review"
  | "auditor_review"
  | "regulator_review"
  | "operational_partner_review";

export type SharingRoomStatus = "draft" | "review_required" | "active" | "expired" | "blocked";
export type SharingInstitutionType = "lender" | "insurer" | "auditor" | "regulator" | "partner";
export type SharingAccessStatus = "pending_review" | "active" | "expired" | "revoked";
export type SharingScopeKind =
  | "evidence_pack"
  | "institution_export"
  | "review_timeline"
  | "audit_compliance"
  | "identity_lineage"
  | "operator_review"
  | "workflow";

export type SharingScopeReference = {
  scopeKey: SharingScopeKind;
  scopeId: string;
  label: string;
  status: "available" | "blocked" | "missing";
  destination: string | null;
  blockedReason: string | null;
};

export type InstitutionalSharingRoom = {
  sharingRoomId: string;
  roomType: SharingRoomType;
  status: SharingRoomStatus;
  manualReviewRequired: true;
  publiclyAccessible: false;
  externalExecutionEnabled: false;
  tokenizationEnabled: false;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  accessControls: {
    accessControlId: string;
    accessType: "view_only";
    institutionType: SharingInstitutionType;
    status: SharingAccessStatus;
    manualApprovalRequired: true;
    publicAccess: false;
    downloadEnabled: false;
    externalSubmissionEnabled: false;
    allowedScopes: SharingScopeKind[];
    redactionLevel: "strict" | "standard";
    expiresAt: string | null;
  };
  sharedScopes: SharingScopeReference[];
  redactions: Array<{ fieldCategory: string; state: string; reason: string }>;
  auditReferences: Array<{ eventType: string; summary: string; occurredAt: string }>;
  timelineReferences: SharingScopeReference[];
  evidenceReferences: SharingScopeReference[];
};

export type SharingRoomCreateInput = {
  roomType: SharingRoomType;
  institutionType: SharingInstitutionType;
  redactionLevel?: "strict" | "standard";
  expiresAt?: string | null;
  sharedScopes: Array<{ scopeKey: SharingScopeKind; scopeId: string; label?: string | null }>;
};

export async function fetchSharingRooms(): Promise<InstitutionalSharingRoom[]> {
  const response = await apiFetch<{ ok: true; rooms: InstitutionalSharingRoom[] }>("/landlord/sharing-rooms");
  return response.rooms;
}

export async function createSharingRoom(input: SharingRoomCreateInput): Promise<InstitutionalSharingRoom> {
  const response = await apiFetch<{ ok: true; room: InstitutionalSharingRoom }>("/landlord/sharing-rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.room;
}

export async function revokeSharingRoom(sharingRoomId: string): Promise<InstitutionalSharingRoom> {
  const response = await apiFetch<{ ok: true; room: InstitutionalSharingRoom }>(
    `/landlord/sharing-rooms/${encodeURIComponent(sharingRoomId)}/revoke`,
    { method: "POST" }
  );
  return response.room;
}
