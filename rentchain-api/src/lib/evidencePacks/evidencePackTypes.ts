import type { AuditComplianceReadiness } from "../auditCompliance/auditComplianceTypes";
import type { DecisionInboxItem } from "../decisions/decisionInboxTypes";
import type { InstitutionExportPackage } from "../institutionExports/institutionExportTypes";
import type { OperatorReviewSession } from "../operatorReviews/operatorReviewTypes";

export type EvidencePackScope =
  | "decision"
  | "workflow"
  | "delinquency"
  | "institution_export"
  | "audit_compliance"
  | "lease"
  | "property"
  | "tenant"
  | "maintenance"
  | "admin_review";

export type EvidencePackStatus = "ready_for_review" | "incomplete" | "blocked" | "unavailable";

export type EvidenceSectionStatus = "included" | "incomplete" | "blocked" | "unavailable";

export type EvidenceItemStatus = "included" | "redacted" | "blocked" | "unavailable";

export type EvidenceItemType =
  | "decision"
  | "workflow"
  | "operator_review"
  | "canonical_event"
  | "export_section"
  | "readiness_check"
  | "lease_summary"
  | "property_summary"
  | "communication_record"
  | "ledger_summary"
  | "maintenance_summary"
  | "redaction_note";

export type EvidenceItemSource =
  | "decision_inbox"
  | "workflow_routing"
  | "operator_review"
  | "canonical_events"
  | "institution_exports"
  | "audit_compliance"
  | "renewal_notice_communications"
  | "lease_ledger"
  | "maintenance"
  | "registry"
  | "unknown";

export type EvidenceItem = {
  evidenceItemId: string;
  itemType: EvidenceItemType;
  label: string;
  description: string;
  status: EvidenceItemStatus;
  source: EvidenceItemSource;
  sourceId: string | null;
  destination: string | null;
  timestamp: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type EvidencePackSectionKey =
  | "decision_lineage"
  | "workflow_routing"
  | "operator_review_sessions"
  | "audit_events"
  | "export_readiness"
  | "audit_compliance_readiness"
  | "lease_context"
  | "property_context"
  | "delinquency_context"
  | "maintenance_context"
  | "redaction_summary";

export type EvidencePackSection = {
  sectionKey: EvidencePackSectionKey;
  label: string;
  status: EvidenceSectionStatus;
  itemsCount: number;
  items: EvidenceItem[];
  missingEvidence: string[];
  blockedReasons: string[];
};

export type EvidencePackRedaction = {
  fieldCategory: string;
  reason: string;
};

export type EvidencePackSensitivityClass = "sensitive" | "restricted";

export type EvidenceProjectionAudience = "landlord_operational_review";

export type EvidenceProjectionProfile = {
  profileName: "landlord_evidence_review";
  profileVersion: string;
  audience: EvidenceProjectionAudience;
  scopeType: EvidencePackScope;
  allowedSourceCollections: string[];
  sensitivityClass: EvidencePackSensitivityClass;
  allowedFieldGroups: string[];
  excludedFieldGroups: string[];
  redactionPolicy: string;
  internalReferencePolicy: string;
  sourceLineagePolicy: string;
};

export type EvidenceSourceReference = {
  sourceCollection: string;
  sourceId: string;
  itemType: EvidenceItem["itemType"];
  itemLabel: string;
};

export type EvidencePackRedactionSummary = {
  redactionPolicy: string;
  redactedFieldGroups: string[];
  redactionCount: number;
};

export type EvidencePack = {
  evidencePackId: string;
  scope: EvidencePackScope;
  scopeId: string;
  status: EvidencePackStatus;
  projectionProfile: EvidenceProjectionProfile;
  projectionVersion: string;
  sensitivityClass: EvidencePackSensitivityClass;
  sourceCollections: string[];
  sourceRefs: EvidenceSourceReference[];
  redactionSummary: EvidencePackRedactionSummary;
  manualReviewRequired: true;
  externalSharingEnabled: false;
  certificationIssued: false;
  generatedAt: string;
  summary: {
    totalItems: number;
    includedItems: number;
    redactedItems: number;
    blockedItems: number;
    missingItems: number;
  };
  sections: EvidencePackSection[];
  redactions: EvidencePackRedaction[];
  blockedReasons: string[];
  disclaimers: string[];
};

export type DeriveEvidencePackInput = {
  scope: EvidencePackScope;
  scopeId: string;
  landlordId?: string | null;
  generatedAt?: string | Date | null;
  decisions?: DecisionInboxItem[] | null;
  operatorReviewSessions?: OperatorReviewSession[] | null;
  institutionExportPackage?: InstitutionExportPackage | null;
  auditComplianceReadiness?: AuditComplianceReadiness | null;
  canonicalEvents?: Array<Record<string, any>> | null;
  renewalNoticeCommunications?: Array<Record<string, any>> | null;
  leases?: Array<Record<string, any>> | null;
  properties?: Array<Record<string, any>> | null;
  maintenanceRequests?: Array<Record<string, any>> | null;
};
