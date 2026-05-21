import type { OperationalReviewRoutingDecision } from "../operationalReviewRouting/operationalReviewRoutingTypes";
import type {
  ReviewWorkspace,
  ReviewWorkspacePriority,
  ReviewWorkspaceResourceRef,
  ReviewWorkspaceSensitivityClass,
  ReviewWorkspaceType,
} from "../reviewWorkspaces/reviewWorkspaceTypes";

export const OPERATIONAL_READ_MODEL_VERSION = "operational_read_model_foundation_v1";

export type OperationalReadModelType = "operational_coordination";

export type OperationalReadModelSummaryType =
  | "operational_signal"
  | "review_queue"
  | "review_workspace"
  | "work_order"
  | "evidence_linkage"
  | "consent_routing";

export type OperationalReadModelPriority = ReviewWorkspacePriority;

export type OperationalReadModelStatus = "open" | "needs_review" | "in_review" | "blocked" | "resolved" | "closed" | "informational";

export type OperationalReadModelSourceRef = {
  sourceCollection: string;
  sourceId: string;
  resourceType: string | null;
  landlordId: string | null;
  tenantId: string | null;
  internalReference: true;
};

export type OperationalReadModelResourceRef = Pick<
  ReviewWorkspaceResourceRef,
  "resourceType" | "resourceId" | "label" | "landlordId" | "tenantId" | "propertyId" | "unitId" | "leaseId"
> & {
  internalReference: true;
};

export type OperationalReadModelEvidenceLinkageSummary = {
  evidenceRefCount: number;
  sourceRefCount: number;
  sensitivityClasses: ReviewWorkspaceSensitivityClass[];
  projectionProfiles: string[];
  referenceOnly: true;
};

export type OperationalReadModelRoutingSummary = {
  reviewEligible: boolean;
  reviewReasonLabel: string | null;
  reviewPriority: OperationalReadModelPriority;
  workspaceType: ReviewWorkspaceType | null;
  manualOnly: true;
  autoCreateWorkspace: false;
  autonomousActionsEnabled: false;
};

export type OperationalReadModelSummary = {
  summaryId: string;
  summaryType: OperationalReadModelSummaryType;
  title: string;
  operationalSummary: string;
  status: OperationalReadModelStatus;
  priority: OperationalReadModelPriority;
  landlordId: string;
  tenantId: string | null;
  generatedAt: string;
  sourceRefs: OperationalReadModelSourceRef[];
  relatedResourceRefs: OperationalReadModelResourceRef[];
  routingSummary: OperationalReadModelRoutingSummary | null;
  evidenceLinkageSummary: OperationalReadModelEvidenceLinkageSummary;
  sensitivityClass: ReviewWorkspaceSensitivityClass;
  visibilityClass: "landlord_operational" | "admin_support";
  canonicalSourceOfTruth: false;
  projectionOnly: true;
  autonomousActionsEnabled: false;
};

export type OperationalReadModelCounts = {
  total: number;
  critical: number;
  warnings: number;
  needsReview: number;
  upcoming: number;
  informational: number;
  reviewEligible: number;
  workOrders: number;
  reviewWorkspaces: number;
  evidenceLinked: number;
};

export type OperationalReadModel = {
  readModelVersion: typeof OPERATIONAL_READ_MODEL_VERSION;
  readModelType: OperationalReadModelType;
  landlordId: string;
  generatedAt: string;
  staleAt: string | null;
  sourceCollections: string[];
  sourceRefs: OperationalReadModelSourceRef[];
  operationalCounts: OperationalReadModelCounts;
  summaries: OperationalReadModelSummary[];
  consistencyExpectation: "projection_rebuildable_from_source";
  canonicalSourceOfTruth: false;
  projectionOnly: true;
  autonomousActionsEnabled: false;
  permissionWideningRequired: false;
};

export type BuildOperationalReadModelInput = {
  landlordId: string;
  generatedAt?: string | Date | null;
  staleAt?: string | Date | null;
  summaries?: Array<BuildOperationalReadModelSummaryInput | OperationalReadModelSummary | null | undefined> | null;
};

export type BuildOperationalReadModelSummaryInput = {
  summaryType: OperationalReadModelSummaryType;
  itemId: string;
  title?: string | null;
  operationalSummary?: string | null;
  status?: string | null;
  priority?: string | null;
  landlordId: string;
  tenantId?: string | null;
  generatedAt?: string | Date | null;
  sourceRefs?: Array<Record<string, unknown>> | null;
  relatedResourceRefs?: Array<Record<string, unknown>> | null;
  routingSummary?: Partial<OperationalReadModelRoutingSummary> | null;
  evidenceLinkageSummary?: Partial<OperationalReadModelEvidenceLinkageSummary> | null;
  sensitivityClass?: string | null;
  visibilityClass?: string | null;
};

export type OperationalReadModelRoutingInput = {
  routing: OperationalReviewRoutingDecision;
  title?: string | null;
  operationalSummary?: string | null;
  status?: string | null;
  tenantId?: string | null;
  generatedAt?: string | Date | null;
};

export type OperationalReadModelWorkspaceInput = {
  workspace: ReviewWorkspace;
  generatedAt?: string | Date | null;
};
