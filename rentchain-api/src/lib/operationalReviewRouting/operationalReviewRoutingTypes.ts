import type { ReviewWorkspacePriority, ReviewWorkspaceType } from "../reviewWorkspaces/reviewWorkspaceTypes";

export const OPERATIONAL_REVIEW_ROUTING_VERSION = "operational_review_routing_v1";

export type OperationalReviewReasonKey =
  | "delinquency_review"
  | "payment_evidence_review"
  | "screening_review"
  | "lease_execution_review"
  | "document_review"
  | "occupancy_review"
  | "evidence_review"
  | "operational_anomaly_review"
  | "informational_not_reviewable";

export type OperationalReviewRoutingCategory =
  | "payments"
  | "screening"
  | "lease_lifecycle"
  | "documents"
  | "occupancy"
  | "evidence"
  | "review_workflow"
  | "operations";

export type OperationalReviewRoutingSeverity = "critical" | "high" | "medium" | "low" | "info" | "unknown";

export type OperationalReviewRoutingStatus =
  | "open"
  | "pending"
  | "blocked"
  | "resolved"
  | "dismissed"
  | "informational"
  | "unknown";

export type OperationalReviewResourceRefInput = {
  resourceType: string;
  resourceId: string;
  label?: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  leaseId?: string | null;
};

export type OperationalReviewRoutingInput = {
  itemId: string;
  landlordId: string;
  tenantId?: string | null;
  title?: string | null;
  description?: string | null;
  category?: OperationalReviewRoutingCategory | null;
  severity?: OperationalReviewRoutingSeverity | null;
  status?: OperationalReviewRoutingStatus | null;
  workflowQueue?: string | null;
  workflowState?: string | null;
  escalationLevel?: string | null;
  reviewStatus?: string | null;
  financialStatus?: string | null;
  destination?: string | null;
  relatedResourceRefs?: OperationalReviewResourceRefInput[] | null;
};

export type OperationalReviewRoutingDecision = {
  routingId: string;
  routingVersion: typeof OPERATIONAL_REVIEW_ROUTING_VERSION;
  itemId: string;
  landlordId: string;
  reviewEligible: boolean;
  reviewReasonKey: OperationalReviewReasonKey;
  reviewReasonLabel: string;
  reviewPriority: ReviewWorkspacePriority;
  priorityLabel: string;
  workspaceType: ReviewWorkspaceType;
  workspaceScopeId: string;
  manualOnly: true;
  autoCreateWorkspace: false;
  autonomousActionsEnabled: false;
  permissionWideningRequired: false;
  sourceDestination: string | null;
  relatedResourceRefs: OperationalReviewResourceRefInput[];
};
