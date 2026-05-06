export const INSTITUTIONAL_SHARING_ROOMS_COLLECTION = "institutionalSharingRooms";

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

export type SharingRedactionState = "excluded" | "partially_redacted" | "fully_redacted" | "blocked";

export type SharingRoomEventType =
  | "institutional_sharing_room_created"
  | "institutional_sharing_room_review_required"
  | "institutional_sharing_room_access_granted"
  | "institutional_sharing_room_access_expired"
  | "institutional_sharing_room_access_revoked"
  | "institutional_sharing_room_redaction_applied";

export type SharingAccessControl = {
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

export type SharingScopeReference = {
  scopeKey: SharingScopeKind;
  scopeId: string;
  label: string;
  status: "available" | "blocked" | "missing";
  destination: string | null;
  blockedReason: string | null;
};

export type SharingRoomRedaction = {
  fieldCategory: string;
  state: SharingRedactionState;
  reason: string;
};

export type SharingRoomAuditReference = {
  eventType: SharingRoomEventType;
  summary: string;
  occurredAt: string;
};

export type InstitutionalSharingRoom = {
  sharingRoomId: string;
  landlordId: string;
  roomType: SharingRoomType;
  status: SharingRoomStatus;
  manualReviewRequired: true;
  publiclyAccessible: false;
  externalExecutionEnabled: false;
  tokenizationEnabled: false;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  createdBy: {
    userId: string | null;
    role: "landlord" | "admin" | "operator";
    email?: string | null;
  };
  accessControls: SharingAccessControl;
  sharedScopes: SharingScopeReference[];
  redactions: SharingRoomRedaction[];
  auditReferences: SharingRoomAuditReference[];
  timelineReferences: SharingScopeReference[];
  evidenceReferences: SharingScopeReference[];
};

export type SharingRoomCreateRequest = {
  roomType: SharingRoomType;
  institutionType: SharingInstitutionType;
  redactionLevel: "strict" | "standard";
  expiresAt?: string | null;
  sharedScopes: Array<{
    scopeKey: SharingScopeKind;
    scopeId: string;
    label?: string | null;
  }>;
};
