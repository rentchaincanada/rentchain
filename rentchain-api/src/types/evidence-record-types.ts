export const EVIDENCE_RECORD_COLLECTION = "evidenceRecords" as const;

export const EVIDENCE_RECORD_SCHEMA_VERSION = "evidence_record_v1" as const;

export const EVIDENCE_CLASSES = [
  "ApplicationEvidence",
  "ScreeningEvidence",
  "DecisionEvidence",
  "PaymentEvidence",
  "MaintenanceEvidence",
  "AuditEvidence",
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const EVIDENCE_RECORD_STATUSES = ["active", "superseded", "archived", "redacted"] as const;

export type EvidenceRecordStatus = (typeof EVIDENCE_RECORD_STATUSES)[number];

export type EvidenceSensitivityClass = "Operational" | "Sensitive" | "Restricted" | "Critical";

export type EvidenceProjectionCategory =
  | "landlord_operational"
  | "tenant_safe"
  | "admin_support"
  | "audit_only"
  | "institutional_export";

export type EvidenceResourceType =
  | "rentalApplication"
  | "screeningOrder"
  | "decisionWorkflow"
  | "ledgerEntry"
  | "payment"
  | "workOrder"
  | "maintenanceRequest"
  | "canonicalEvent";

export type EvidenceActorRole = "tenant" | "landlord" | "admin" | "support" | "system";

export type EvidenceAuthorityRole = "tenant" | "landlord" | "admin" | "support" | "system";

export type EvidenceSourceCollection =
  | "rentalApplications"
  | "screeningOrders"
  | "screeningResults"
  | "landlordDecisionStates"
  | "decisionActions"
  | "payments"
  | "ledgerEntries"
  | "rentPayments"
  | "paymentReconciliationRecords"
  | "workOrders"
  | "maintenanceRequests"
  | "workOrderUpdates"
  | "canonicalEvents"
  | "events"
  | "tenantEvents"
  | "leaseWorkflowEvents";

export type EvidenceReference = {
  evidenceId: string;
  evidenceClass: EvidenceClass;
  resourceType: EvidenceResourceType;
  safeReferenceKey: string;
  label: string;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type EvidenceProvenanceMetadata = {
  createdAt: string;
  createdBy: {
    actorRole: EvidenceActorRole;
    actorRef: string | null;
    rawActorIdsIncluded: false;
  };
  authority: {
    authorityRole: EvidenceAuthorityRole;
    landlordRef: string | null;
    tenantRef: string | null;
    supportAllowed: boolean;
    rawIdsIncluded: false;
  };
  source: {
    sourceCollection: EvidenceSourceCollection;
    sourceReferenceKey: string;
    sourceObservedAt: string | null;
    sourceVersion: string | null;
    rawSourceIdsIncluded: false;
    rawPayloadIncluded: false;
  };
  reason: string;
  provenanceChain: EvidenceReference[];
  metadataOnly: true;
};

export type EvidenceSensitivityMetadata = {
  sensitivityClass: EvidenceSensitivityClass;
  projectionCategories: EvidenceProjectionCategory[];
  redactionPolicy: "excluded_by_default" | "allowlist_required" | "metadata_only";
  excludedFieldGroups: string[];
  allowedFieldGroups: string[];
  containsRestrictedProviderData: false;
  containsRawPaymentData: false;
  containsMessageBody: false;
  containsIdentityDocument: false;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type EvidenceRetentionMetadata = {
  retentionPolicy: "deferred_phase_4" | "retain_while_source_exists" | "manual_review_required";
  retentionReviewRequired: boolean;
  archiveAfter: string | null;
  deleteAfter: null;
};

export type EvidenceRecord = {
  evidenceId: string;
  evidenceClass: EvidenceClass;
  evidenceType: string;
  schemaVersion: typeof EVIDENCE_RECORD_SCHEMA_VERSION;
  landlordId: string;
  resourceType: EvidenceResourceType;
  resourceId: string;
  safeReference: EvidenceReference;
  provenanceMetadata: EvidenceProvenanceMetadata;
  sensitivityMetadata: EvidenceSensitivityMetadata;
  retentionMetadata: EvidenceRetentionMetadata;
  status: EvidenceRecordStatus;
  createdAt: string;
  supersedesEvidenceId: string | null;
  supersededByEvidenceId: string | null;
  immutable: true;
  appendOnly: true;
  metadataOnly: true;
  rawIdsIncluded: false;
  redactionSummary: string;
};

export type EvidenceCreationAuthorityContext = {
  actorRole: EvidenceActorRole;
  actorId?: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  supportAllowed?: boolean;
  purpose?: string | null;
};

export type CreateEvidenceRecordInput = {
  evidenceClass: EvidenceClass;
  evidenceType: string;
  landlordId: string;
  resourceType: EvidenceResourceType;
  resourceId: string;
  label?: string;
  creationAuthority?: EvidenceCreationAuthorityContext;
  provenanceMetadata: EvidenceProvenanceMetadata;
  sensitivityMetadata: EvidenceSensitivityMetadata;
  retentionMetadata?: EvidenceRetentionMetadata;
  createdAt?: string;
  supersedesEvidenceId?: string | null;
};

export type EvidenceProjectionAudience = EvidenceProjectionCategory;

export type EvidenceRecordQuery = {
  landlordId: string;
  resourceType?: EvidenceResourceType;
  resourceId?: string;
  status?: EvidenceRecordStatus;
  createdAfter?: string;
  createdBefore?: string;
};

export type EvidenceRecordProjection = {
  audience: EvidenceProjectionAudience;
  evidenceId: string;
  evidenceClass: EvidenceClass;
  evidenceType: string;
  resourceType: EvidenceResourceType;
  safeReference: EvidenceReference;
  status: EvidenceRecordStatus;
  createdAt: string;
  sensitivityClass: EvidenceSensitivityClass;
  redactionSummary: string;
  rawIdsIncluded: false;
};
