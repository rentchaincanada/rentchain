import {
  EVIDENCE_RECORD_SCHEMA_VERSION,
  type EvidenceClass,
  type EvidenceRecord,
  type EvidenceResourceType,
  type EvidenceSensitivityClass,
  type EvidenceSourceCollection,
} from "../../types/evidence-record-types";
import { generateEvidenceId } from "../../utils/evidence-identifier";

const createdAt = "2026-06-04T00:00:00.000Z";

type EvidenceFixtureInput = {
  evidenceClass: EvidenceClass;
  evidenceType: string;
  sourceCollection: EvidenceSourceCollection;
  resourceType: EvidenceResourceType;
  sourceId: string;
  sourceReferenceKey: string;
  label: string;
  sensitivityClass: EvidenceSensitivityClass;
  allowedFieldGroups: string[];
  excludedFieldGroups: string[];
};

function buildEvidenceRecord(input: EvidenceFixtureInput): EvidenceRecord {
  const evidenceId = generateEvidenceId(input.evidenceType, input.sourceId, {
    evidenceClass: input.evidenceClass,
    landlordRef: "landlord:fixture",
    projection: "metadata_only",
    schemaVersion: EVIDENCE_RECORD_SCHEMA_VERSION,
    sourceCollection: input.sourceCollection,
  });
  return {
    evidenceId,
    evidenceClass: input.evidenceClass,
    evidenceType: input.evidenceType,
    schemaVersion: EVIDENCE_RECORD_SCHEMA_VERSION,
    landlordId: "landlord-fixture-internal",
    resourceType: input.resourceType,
    resourceId: input.sourceId,
    safeReference: {
      evidenceId,
      evidenceClass: input.evidenceClass,
      resourceType: input.resourceType,
      safeReferenceKey: input.sourceReferenceKey,
      label: input.label,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    provenanceMetadata: {
      createdAt,
      createdBy: {
        actorRole: "system",
        actorRef: "actor:evidence-fixture",
        rawActorIdsIncluded: false,
      },
      authority: {
        authorityRole: "system",
        landlordRef: "landlord:fixture",
        tenantRef: null,
        supportAllowed: false,
        rawIdsIncluded: false,
      },
      source: {
        sourceCollection: input.sourceCollection,
        sourceReferenceKey: input.sourceReferenceKey,
        sourceObservedAt: createdAt,
        sourceVersion: "fixture_v1",
        rawSourceIdsIncluded: false,
        rawPayloadIncluded: false,
      },
      reason: "Phase 4A evidence record fixture.",
      provenanceChain: [],
      metadataOnly: true,
    },
    sensitivityMetadata: {
      sensitivityClass: input.sensitivityClass,
      projectionCategories: ["audit_only", "landlord_operational", "institutional_export"],
      redactionPolicy: "allowlist_required",
      excludedFieldGroups: input.excludedFieldGroups,
      allowedFieldGroups: input.allowedFieldGroups,
      containsRestrictedProviderData: false,
      containsRawPaymentData: false,
      containsMessageBody: false,
      containsIdentityDocument: false,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    retentionMetadata: {
      retentionPolicy: "deferred_phase_4",
      retentionReviewRequired: true,
      archiveAfter: null,
      deleteAfter: null,
    },
    status: "active",
    createdAt,
    supersedesEvidenceId: null,
    supersededByEvidenceId: null,
    immutable: true,
    appendOnly: true,
    metadataOnly: true,
    rawIdsIncluded: false,
    redactionSummary:
      "Fixture evidence is metadata-only. Raw Firestore IDs, storage paths, provider payloads, tokens, credentials, payment account data, and message bodies are excluded.",
  };
}

export const evidenceRecordFixtures = {
  applicationEvidence: buildEvidenceRecord({
    evidenceClass: "ApplicationEvidence",
    evidenceType: "ApplicationEvidence",
    sourceCollection: "rentalApplications",
    resourceType: "rentalApplication",
    sourceId: "rental-application-internal-fixture",
    sourceReferenceKey: "application:9f7c1a7ad3b2",
    label: "Application metadata evidence",
    sensitivityClass: "Sensitive",
    allowedFieldGroups: ["status", "submittedAt", "propertyLabel", "unitLabel"],
    excludedFieldGroups: ["applicantContact", "identityDocuments", "rawScreeningPayload"],
  }),
  screeningEvidence: buildEvidenceRecord({
    evidenceClass: "ScreeningEvidence",
    evidenceType: "ScreeningEvidence",
    sourceCollection: "screeningOrders",
    resourceType: "screeningOrder",
    sourceId: "screening-order-internal-fixture",
    sourceReferenceKey: "screening:42af9c7310e4",
    label: "Screening workflow status evidence",
    sensitivityClass: "Restricted",
    allowedFieldGroups: ["screeningStatus", "consentStatus", "completedAt"],
    excludedFieldGroups: ["rawReport", "providerPayload", "identityValues"],
  }),
  decisionEvidence: buildEvidenceRecord({
    evidenceClass: "DecisionEvidence",
    evidenceType: "DecisionEvidence",
    sourceCollection: "decisionActions",
    resourceType: "decisionWorkflow",
    sourceId: "decision-action-internal-fixture",
    sourceReferenceKey: "decision:bb12e8c924a0",
    label: "Decision workflow evidence",
    sensitivityClass: "Sensitive",
    allowedFieldGroups: ["decisionStatus", "reviewOutcome", "reviewedAt"],
    excludedFieldGroups: ["operatorInternalNotes", "rawWorkflowState"],
  }),
  paymentEvidence: buildEvidenceRecord({
    evidenceClass: "PaymentEvidence",
    evidenceType: "PaymentEvidence",
    sourceCollection: "ledgerEntries",
    resourceType: "ledgerEntry",
    sourceId: "ledger-entry-internal-fixture",
    sourceReferenceKey: "payment:f31b9f2a1188",
    label: "Ledger payment evidence",
    sensitivityClass: "Sensitive",
    allowedFieldGroups: ["amount", "currency", "paidAt", "ledgerStatus"],
    excludedFieldGroups: ["bankAccount", "cardDetails", "rawProcessorPayload"],
  }),
  maintenanceEvidence: buildEvidenceRecord({
    evidenceClass: "MaintenanceEvidence",
    evidenceType: "MaintenanceEvidence",
    sourceCollection: "workOrders",
    resourceType: "workOrder",
    sourceId: "work-order-internal-fixture",
    sourceReferenceKey: "maintenance:49ac7d3f0012",
    label: "Maintenance workflow evidence",
    sensitivityClass: "Sensitive",
    allowedFieldGroups: ["category", "status", "completedAt", "contractorStatus"],
    excludedFieldGroups: ["privateMessageBody", "tenantContact", "attachmentPayload"],
  }),
  auditEvidence: buildEvidenceRecord({
    evidenceClass: "AuditEvidence",
    evidenceType: "AuditEvidence",
    sourceCollection: "canonicalEvents",
    resourceType: "canonicalEvent",
    sourceId: "canonical-event-internal-fixture",
    sourceReferenceKey: "audit:2bcd8810de90",
    label: "Canonical audit evidence",
    sensitivityClass: "Sensitive",
    allowedFieldGroups: ["eventType", "timestamp", "actorRole", "redactionSummary"],
    excludedFieldGroups: ["rawPayload", "rawActorId", "debugContext"],
  }),
} as const;

export const evidenceRecordFixtureList = Object.values(evidenceRecordFixtures);
