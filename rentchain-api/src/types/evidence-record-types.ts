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
  retentionPolicy:
    | "deferred_phase_4"
    | "retain_while_source_exists"
    | "manual_review_required"
    | "evidence_retention_policy_v1";
  retentionReviewRequired: boolean;
  archiveAfter: string | null;
  deleteAfter: string | null;
  appliedRetentionPolicyRule: RetentionPolicyRuleSummary | null;
  evaluatedAt: string | null;
  eligibleForArchivalAt: string | null;
  eligibleForDeletionAt: string | null;
  legalHoldStatus: EvidenceLegalHoldStatus;
  lifecycleEvents: LifecycleTransitionEvent[];
};

export type EvidenceRetentionPolicyVersion = "evidence_retention_policy_v1";

export type RetentionPeriodUnit = "days" | "months" | "years" | "indefinite";

export type EvidenceLegalHoldStatus = "none" | "active";

export type RetentionPolicyRule = {
  policyId: string;
  policyVersion: EvidenceRetentionPolicyVersion;
  evidenceClass: EvidenceClass;
  retentionPeriod: number | null;
  retentionUnit: RetentionPeriodUnit;
  archiveAfterPeriod: number | null;
  archiveAfterUnit: RetentionPeriodUnit;
  deletionAfterPeriod: number | null;
  deletionAfterUnit: RetentionPeriodUnit;
  legalHoldOverrideAllowed: boolean;
  auditEventCapture: "required";
  immutable: true;
  appliesRetroactively: false;
  description: string;
};

export type RetentionPolicyRuleSummary = Pick<
  RetentionPolicyRule,
  | "policyId"
  | "policyVersion"
  | "evidenceClass"
  | "retentionPeriod"
  | "retentionUnit"
  | "archiveAfterPeriod"
  | "archiveAfterUnit"
  | "deletionAfterPeriod"
  | "deletionAfterUnit"
  | "legalHoldOverrideAllowed"
  | "auditEventCapture"
  | "immutable"
  | "appliesRetroactively"
>;

export type RetentionEvaluatedBy = {
  actorRole: EvidenceActorRole;
  actorRef: string | null;
  purpose: string;
  rawIdsIncluded: false;
};

export type RetentionEvaluationContext = {
  currentTimestamp: string | Date;
  legalHoldStatus: EvidenceLegalHoldStatus | null;
  landlordOverride?: {
    retentionPeriod?: number;
    retentionUnit?: Exclude<RetentionPeriodUnit, "indefinite">;
    archiveAfterPeriod?: number;
    archiveAfterUnit?: Exclude<RetentionPeriodUnit, "indefinite">;
    deletionAfterPeriod?: number;
    deletionAfterUnit?: Exclude<RetentionPeriodUnit, "indefinite">;
    reason: string;
  } | null;
  policyVersion: EvidenceRetentionPolicyVersion;
  evaluationReason: string;
  evaluatedBy: RetentionEvaluatedBy;
};

export type RetentionEvaluationResult = {
  evidenceId: string;
  policyRule: RetentionPolicyRuleSummary;
  evaluatedAt: string;
  legalHoldStatus: EvidenceLegalHoldStatus;
  eligibleForArchivalAt: string | null;
  eligibleForDeletionAt: string | null;
  archivalEligible: boolean;
  deletionEligible: boolean;
  lifecycleStatus: EvidenceRecordStatus;
  evaluationReason: string;
  evaluatedBy: RetentionEvaluatedBy;
  rawIdsIncluded: false;
};

export type LifecycleTransitionEvent = {
  eventId: string;
  evidenceId: string;
  priorStatus: EvidenceRecordStatus;
  newStatus: EvidenceRecordStatus;
  transitionReason: string;
  evaluatedPolicyRule: RetentionPolicyRuleSummary;
  evaluatedBy: RetentionEvaluatedBy;
  timestamp: string;
  auditTrailReference: string;
  legalHoldStatus: EvidenceLegalHoldStatus;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type RetentionMetadataProjectionAudience = "landlord" | "tenant" | "admin" | "audit";

export type RetentionMetadataProjection =
  | {
      audience: "tenant";
      status: EvidenceRecordStatus;
      rawIdsIncluded: false;
    }
  | {
      audience: "landlord";
      retentionPolicy: EvidenceRetentionMetadata["retentionPolicy"];
      appliedRetentionPolicyRule: RetentionPolicyRuleSummary | null;
      eligibleForArchivalAt: string | null;
      lifecycleEvents: Array<Pick<LifecycleTransitionEvent, "eventId" | "priorStatus" | "newStatus" | "timestamp" | "transitionReason">>;
      rawIdsIncluded: false;
    }
  | {
      audience: "admin";
      retentionMetadata: EvidenceRetentionMetadata;
      rawIdsIncluded: false;
    }
  | {
      audience: "audit";
      appliedRetentionPolicyRule: RetentionPolicyRuleSummary | null;
      evaluatedAt: string | null;
      legalHoldStatus: EvidenceLegalHoldStatus;
      lifecycleEvents: Array<Pick<LifecycleTransitionEvent, "eventId" | "priorStatus" | "newStatus" | "timestamp" | "transitionReason" | "auditTrailReference">>;
      rawIdsIncluded: false;
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
