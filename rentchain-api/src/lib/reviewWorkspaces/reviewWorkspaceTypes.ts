export const REVIEW_WORKSPACE_CONTRACT_VERSION = "review_workspace_foundation_v1";

export type ReviewWorkspaceType =
  | "evidence_review"
  | "payment_ledger_review"
  | "screening_review"
  | "operational_anomaly_review"
  | "document_review"
  | "delinquency_review";

export type ReviewWorkspaceStatus = "open" | "under_review" | "blocked" | "completed" | "escalated";

export type ReviewWorkspacePriority = "critical" | "warning" | "needs_review" | "upcoming" | "info";

export type ReviewWorkspaceSensitivityClass = "sensitive" | "restricted";

export type ReviewWorkspaceVisibilityClass = "landlord_operational" | "admin_support";

export type ReviewWorkspaceReviewer = {
  userId: string | null;
  role: "landlord" | "admin" | "operator";
  email?: string | null;
};

export type ReviewWorkspaceEvidenceRef = {
  evidenceRefId: string;
  evidencePackId: string;
  evidenceItemId: string | null;
  evidenceType: "evidence_pack" | "evidence_item" | "source_reference";
  label: string;
  sourceCollection: string | null;
  sourceId: string | null;
  sourceRef: {
    sourceCollection: string;
    sourceId: string;
  } | null;
  scopeType: string | null;
  scopeId: string | null;
  landlordId: string | null;
  tenantId: string | null;
  sensitivityClass: ReviewWorkspaceSensitivityClass;
  projectionProfile: string | null;
  projectionVersion: string | null;
  redactionSummary: string | null;
  lineageSummary: string | null;
};

export type ReviewWorkspaceResourceType =
  | "lease"
  | "tenant"
  | "property"
  | "unit"
  | "payment"
  | "ledger_entry"
  | "screening_order"
  | "document"
  | "decision"
  | "canonical_event"
  | "evidence_pack";

export type ReviewWorkspaceResourceRef = {
  resourceType: ReviewWorkspaceResourceType;
  resourceId: string;
  label: string;
  landlordId: string | null;
  tenantId: string | null;
  propertyId: string | null;
  unitId: string | null;
  leaseId: string | null;
};

export type ReviewWorkspaceEventRef = {
  eventId: string;
  eventType: string;
  sourceSystem: string | null;
};

export type ReviewWorkspaceAuditRef = {
  auditId: string;
  eventType: string;
  sourceCollection: string | null;
};

export type ReviewWorkspace = {
  workspaceId: string;
  workspaceContractVersion: typeof REVIEW_WORKSPACE_CONTRACT_VERSION;
  workspaceType: ReviewWorkspaceType;
  workspaceScope: ReviewWorkspaceType;
  workspaceScopeId: string;
  landlordId: string;
  assignedReviewer: ReviewWorkspaceReviewer | null;
  reviewStatus: ReviewWorkspaceStatus;
  reviewPriority: ReviewWorkspacePriority;
  evidenceRefs: ReviewWorkspaceEvidenceRef[];
  relatedResourceRefs: ReviewWorkspaceResourceRef[];
  createdFromEvent: ReviewWorkspaceEventRef | null;
  createdBy: ReviewWorkspaceReviewer;
  createdAt: string;
  updatedAt: string;
  reviewSummary: string;
  reviewNotes: string[];
  reviewTags: string[];
  auditRefs: ReviewWorkspaceAuditRef[];
  sensitivityClass: ReviewWorkspaceSensitivityClass;
  visibilityClass: ReviewWorkspaceVisibilityClass;
  manualOnly: true;
  autonomousActionsEnabled: false;
  externalSharingEnabled: false;
  institutionalSharingEnabled: false;
  financialMutationEnabled: false;
};

export type BuildReviewWorkspaceInput = {
  workspaceType: ReviewWorkspaceType;
  workspaceScopeId: string;
  landlordId: string;
  createdBy: ReviewWorkspaceReviewer;
  createdAt?: string | Date | null;
  assignedReviewer?: ReviewWorkspaceReviewer | null;
  reviewStatus?: ReviewWorkspaceStatus | null;
  reviewPriority?: ReviewWorkspacePriority | null;
  evidenceRefs?: Array<Record<string, unknown>> | null;
  relatedResourceRefs?: Array<Record<string, unknown>> | null;
  createdFromEvent?: Record<string, unknown> | null;
  reviewSummary?: string | null;
  reviewNotes?: unknown[] | null;
  reviewTags?: unknown[] | null;
  auditRefs?: Array<Record<string, unknown>> | null;
  sensitivityClass?: ReviewWorkspaceSensitivityClass | null;
  visibilityClass?: ReviewWorkspaceVisibilityClass | null;
  tenantId?: string | null;
};
