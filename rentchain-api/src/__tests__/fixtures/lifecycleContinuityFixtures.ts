import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  RECOVERY_TIMELINE_COLLECTION,
} from "../../services/recovery/recoveryStore";
import { workflowKey } from "../../services/recovery/recoveryShared";
import { buildEvidenceReference, captureTransitionEvidence } from "../../services/stateMachines/evidenceProvenance";
import { PROVENANCE_EVENTS_COLLECTION } from "../../services/stateMachines/provenanceStorage";
import type { EvidenceReference, ReviewWorkflowType, TransitionProvenanceEvent, WorkflowEvent, WorkflowState } from "../../services/stateMachines/types";

export type LifecycleContinuityRecord = Record<string, unknown>;

export type LifecycleContinuityLeaseKind = "active" | "upcoming" | "archived";

export type LifecycleContinuityTenantKind =
  | "applicant"
  | "active"
  | "upcoming"
  | "archived";

export type LifecycleContinuityDocumentKind = "signed" | "generated";

export const lifecycleContinuityIds = {
  landlordId: "lc_landlord_001",
  propertyId: "lc_property_north_towers",
  unit101Id: "lc_unit_101",
  unit102Id: "lc_unit_102",
  unit103Id: "lc_unit_103",
  applicantId: "lc_applicant_001",
  activeTenantId: "lc_tenant_active_001",
  upcomingTenantId: "lc_tenant_upcoming_001",
  archivedTenantId: "lc_tenant_archived_001",
  activeLeaseId: "lc_lease_active_001",
  upcomingLeaseId: "lc_lease_upcoming_001",
  archivedLeaseId: "lc_lease_archived_001",
  paymentId: "lc_payment_import_001",
  ledgerEntryId: "lc_ledger_payment_001",
  obligationId: "lc_obligation_2026_06",
  decisionId: "lc_decision_manual_review_001",
  maintenanceId: "lc_maintenance_cost_review_001",
  recoveryLeaseId: "lc_recovery_lease_divergence_001",
  recoveryPaymentId: "lc_recovery_payment_divergence_001",
  recoveryDecisionId: "lc_recovery_decision_divergence_001",
  recoveryMaintenanceId: "lc_recovery_maintenance_divergence_001",
  signedDocumentId: "lc_doc_signed_lease_001",
  generatedDocumentId: "lc_doc_generated_lease_001",
  importBatchId: "lc_import_batch_001",
} as const;

export const lifecycleContinuityDates = {
  now: "2026-05-18T12:00:00.000Z",
  applicationSubmittedAt: "2026-04-10T14:00:00.000Z",
  approvedAt: "2026-04-15T14:00:00.000Z",
  activeLeaseStart: "2026-06-01",
  activeLeaseEnd: "2027-05-31",
  upcomingLeaseStart: "2026-07-01",
  upcomingLeaseEnd: "2027-06-30",
  archivedLeaseStart: "2025-06-01",
  archivedLeaseEnd: "2026-05-31",
  paymentDate: "2026-06-01",
  obligationDueDate: "2026-06-01T00:00:00.000Z",
  decisionCreatedAt: "2026-06-02T10:00:00.000Z",
  recoveryTimelineAt: "2026-06-02T12:00:00.000Z",
  recoverySnapshotAt: "2026-06-02T12:05:00.000Z",
  recoveryEvidenceAt: "2026-06-02T12:10:00.000Z",
} as const;

export const lifecycleContinuityLabels = {
  propertyName: "North Towers",
  propertyAddress: "10 Harbour Road, Halifax, NS",
  unit101: "Unit 101",
  unit102: "Unit 102",
  unit103: "Unit 103",
  applicantName: "Avery Applicant",
  activeTenantName: "John Smith",
  upcomingTenantName: "Bailey Blinkers",
  archivedTenantName: "Casey Past",
  activeLeaseLabel: "North Towers - Unit 101 Lease",
  upcomingLeaseLabel: "North Towers - Unit 103 Lease",
  recoveryWorkspaceLabel: "Lifecycle continuity recovery workspace",
} as const;

type LifecycleRecoveryTransition = {
  from: WorkflowState;
  to: WorkflowState;
  event: WorkflowEvent;
};

export type LifecycleRecoveryCandidate = {
  workflowType: ReviewWorkflowType;
  workflowId: string;
  workflowInstanceKey: string;
  snapshotId: string;
  timelineEntryId: string;
  expectedDivergenceType: "METADATA_DIVERGENCE" | "EVIDENCE_MISMATCH" | "MISSING_TRANSITION" | "ORPHANED_DECISION";
  expectedDecision: "ACCEPT_CANONICAL" | "EVIDENCE_REVIEW_REQUIRED";
  snapshot: LifecycleContinuityRecord;
  timelineEntry: LifecycleContinuityRecord;
  provenanceEvent: TransitionProvenanceEvent;
  evidenceLabel: string;
};

type LifecycleRecoveryCandidateInput = {
  workflowType: ReviewWorkflowType;
  workflowId: string;
  derivedState?: WorkflowState | null;
  canonicalState?: WorkflowState | null;
  evidenceState?: WorkflowState | null;
  transition: LifecycleRecoveryTransition;
  expectedDivergenceType: LifecycleRecoveryCandidate["expectedDivergenceType"];
  expectedDecision: LifecycleRecoveryCandidate["expectedDecision"];
  evidenceReferenceType: EvidenceReference["referenceType"];
  evidenceLabel: string;
  reasonSummary: string;
};

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withOverrides<T extends LifecycleContinuityRecord>(
  base: T,
  overrides?: Partial<T>,
): T {
  return {
    ...cloneRecord(base),
    ...(overrides ?? {}),
  };
}

export function buildLifecycleContinuityProperty(
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  return withOverrides(
    {
      id: lifecycleContinuityIds.propertyId,
      landlordId: lifecycleContinuityIds.landlordId,
      name: lifecycleContinuityLabels.propertyName,
      address: lifecycleContinuityLabels.propertyAddress,
      province: "NS",
      jurisdictionProvince: "NS",
      status: "active",
      createdAt: lifecycleContinuityDates.now,
      updatedAt: lifecycleContinuityDates.now,
    },
    overrides,
  );
}

export function buildLifecycleContinuityUnits(): LifecycleContinuityRecord[] {
  return [
    {
      id: lifecycleContinuityIds.unit101Id,
      landlordId: lifecycleContinuityIds.landlordId,
      propertyId: lifecycleContinuityIds.propertyId,
      label: lifecycleContinuityLabels.unit101,
      unitNumber: "101",
      configuredRentCents: 164000,
      occupancyDisplayStatus: "occupied",
      activeLeaseId: lifecycleContinuityIds.activeLeaseId,
      tenantId: lifecycleContinuityIds.activeTenantId,
    },
    {
      id: lifecycleContinuityIds.unit102Id,
      landlordId: lifecycleContinuityIds.landlordId,
      propertyId: lifecycleContinuityIds.propertyId,
      label: lifecycleContinuityLabels.unit102,
      unitNumber: "102",
      configuredRentCents: 154000,
      occupancyDisplayStatus: "vacant",
    },
    {
      id: lifecycleContinuityIds.unit103Id,
      landlordId: lifecycleContinuityIds.landlordId,
      propertyId: lifecycleContinuityIds.propertyId,
      label: lifecycleContinuityLabels.unit103,
      unitNumber: "103",
      configuredRentCents: 198000,
      occupancyDisplayStatus: "upcoming",
      activeLeaseId: lifecycleContinuityIds.upcomingLeaseId,
      tenantId: lifecycleContinuityIds.upcomingTenantId,
    },
  ];
}

export function buildLifecycleContinuityApplication(
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  return withOverrides(
    {
      id: lifecycleContinuityIds.applicantId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.applicantId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit102Id,
      fullName: lifecycleContinuityLabels.applicantName,
      email: "avery.applicant@example.test",
      status: "approved",
      screeningStatus: "screening_completed",
      submittedAt: lifecycleContinuityDates.applicationSubmittedAt,
      approvedAt: lifecycleContinuityDates.approvedAt,
    },
    overrides,
  );
}

export function buildLifecycleContinuityTenant(
  kind: LifecycleContinuityTenantKind = "active",
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  const baseByKind: Record<LifecycleContinuityTenantKind, LifecycleContinuityRecord> = {
    applicant: {
      id: lifecycleContinuityIds.applicantId,
      landlordId: lifecycleContinuityIds.landlordId,
      fullName: lifecycleContinuityLabels.applicantName,
      email: "avery.applicant@example.test",
      status: "approved",
      lifecycleState: "approved",
      applicationId: lifecycleContinuityIds.applicantId,
    },
    active: {
      id: lifecycleContinuityIds.activeTenantId,
      landlordId: lifecycleContinuityIds.landlordId,
      fullName: lifecycleContinuityLabels.activeTenantName,
      email: "john.smith@example.test",
      status: "active",
      lifecycleState: "active",
      currentLeaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
    },
    upcoming: {
      id: lifecycleContinuityIds.upcomingTenantId,
      landlordId: lifecycleContinuityIds.landlordId,
      fullName: lifecycleContinuityLabels.upcomingTenantName,
      email: "bailey.blinkers@example.test",
      status: "lease_signed",
      lifecycleState: "lease_signed",
      currentLeaseId: lifecycleContinuityIds.upcomingLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit103Id,
    },
    archived: {
      id: lifecycleContinuityIds.archivedTenantId,
      landlordId: lifecycleContinuityIds.landlordId,
      fullName: lifecycleContinuityLabels.archivedTenantName,
      email: "casey.past@example.test",
      status: "archived",
      lifecycleState: "past",
      archived: true,
      previousLeaseId: lifecycleContinuityIds.archivedLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
    },
  };

  return withOverrides(baseByKind[kind], overrides);
}

export function buildLifecycleContinuityLease(
  kind: LifecycleContinuityLeaseKind = "active",
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  const baseByKind: Record<LifecycleContinuityLeaseKind, LifecycleContinuityRecord> = {
    active: {
      id: lifecycleContinuityIds.activeLeaseId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      status: "active",
      signingStatus: "signed",
      startDate: lifecycleContinuityDates.activeLeaseStart,
      endDate: lifecycleContinuityDates.activeLeaseEnd,
      rentCents: 164000,
      rentDueDay: 1,
      paymentFrequency: "monthly",
      label: lifecycleContinuityLabels.activeLeaseLabel,
    },
    upcoming: {
      id: lifecycleContinuityIds.upcomingLeaseId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.upcomingTenantId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit103Id,
      status: "signed",
      signingStatus: "signed",
      startDate: lifecycleContinuityDates.upcomingLeaseStart,
      endDate: lifecycleContinuityDates.upcomingLeaseEnd,
      rentCents: 198000,
      rentDueDay: 1,
      paymentFrequency: "monthly",
      label: lifecycleContinuityLabels.upcomingLeaseLabel,
    },
    archived: {
      id: lifecycleContinuityIds.archivedLeaseId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.archivedTenantId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      status: "archived",
      signingStatus: "signed",
      startDate: lifecycleContinuityDates.archivedLeaseStart,
      endDate: lifecycleContinuityDates.archivedLeaseEnd,
      rentCents: 150000,
      rentDueDay: 1,
      paymentFrequency: "monthly",
      label: "North Towers - Unit 101 Archived Lease",
      archived: true,
    },
  };

  return withOverrides(baseByKind[kind], overrides);
}

export function buildLifecycleContinuityPayment(
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  return withOverrides(
    {
      id: lifecycleContinuityIds.paymentId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      amountCents: 164000,
      paidAt: lifecycleContinuityDates.paymentDate,
      effectiveDate: lifecycleContinuityDates.paymentDate,
      method: "etransfer",
      reference: "LC-CSV-1001",
      status: "recorded",
      source: "payment_csv_import",
      importBatchId: lifecycleContinuityIds.importBatchId,
      ledgerEntryId: lifecycleContinuityIds.ledgerEntryId,
      createdBy: lifecycleContinuityIds.landlordId,
      createdAt: lifecycleContinuityDates.now,
      updatedAt: lifecycleContinuityDates.now,
    },
    overrides,
  );
}

export function buildLifecycleContinuityLedgerEntry(
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  return withOverrides(
    {
      id: lifecycleContinuityIds.ledgerEntryId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      entryType: "payment",
      category: "payment",
      amountCents: 164000,
      signedAmountCents: -164000,
      effectiveDate: lifecycleContinuityDates.paymentDate,
      method: "etransfer",
      reference: "LC-CSV-1001",
      paymentDocumentId: lifecycleContinuityIds.paymentId,
      immutable: true,
      createdBy: lifecycleContinuityIds.landlordId,
      createdAt: lifecycleContinuityDates.now,
    },
    overrides,
  );
}

export function buildLifecycleContinuityObligation(
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  return withOverrides(
    {
      id: lifecycleContinuityIds.obligationId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      periodStart: lifecycleContinuityDates.activeLeaseStart,
      periodEnd: "2026-06-30",
      dueDate: lifecycleContinuityDates.obligationDueDate,
      expectedAmountCents: 164000,
      paidAmountCents: 164000,
      outstandingAmountCents: 0,
      status: "current",
      evidence: [
        {
          paymentDocumentId: lifecycleContinuityIds.paymentId,
          ledgerEntryId: lifecycleContinuityIds.ledgerEntryId,
          amountCents: 164000,
          paymentDate: lifecycleContinuityDates.paymentDate,
        },
      ],
    },
    overrides,
  );
}

export function buildLifecycleContinuityDecision(
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  return withOverrides(
    {
      id: lifecycleContinuityIds.decisionId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      type: "manual_review_required",
      severity: "warning",
      financialSignal: "Manual review required",
      workflowStatus: "unreviewed",
      metadata: {
        obligationId: lifecycleContinuityIds.obligationId,
        dueDate: lifecycleContinuityDates.obligationDueDate,
        paymentDocumentId: lifecycleContinuityIds.paymentId,
        ledgerEntryId: lifecycleContinuityIds.ledgerEntryId,
      },
      reviewTrail: [
        {
          action: "created",
          actorId: "system",
          createdAt: lifecycleContinuityDates.decisionCreatedAt,
        },
      ],
      createdAt: lifecycleContinuityDates.decisionCreatedAt,
      updatedAt: lifecycleContinuityDates.decisionCreatedAt,
    },
    overrides,
  );
}

export function buildLifecycleContinuityLeaseDocument(
  kind: LifecycleContinuityDocumentKind = "signed",
  overrides?: Partial<LifecycleContinuityRecord>,
): LifecycleContinuityRecord {
  const baseByKind: Record<LifecycleContinuityDocumentKind, LifecycleContinuityRecord> = {
    signed: {
      id: lifecycleContinuityIds.signedDocumentId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      documentStatus: "signed",
      signingStatus: "signed",
      displayLabel: "Signed lease package - North Towers Unit 101",
      documentUrl: "https://example.test/docs/lc_doc_signed_lease_001.pdf",
      source: "leaseDocuments",
      createdAt: lifecycleContinuityDates.now,
    },
    generated: {
      id: lifecycleContinuityIds.generatedDocumentId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.upcomingTenantId,
      leaseId: lifecycleContinuityIds.upcomingLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit103Id,
      documentStatus: "generated",
      signingStatus: "pending",
      displayLabel: "Generated lease package - North Towers Unit 103",
      documentUrl: "https://example.test/docs/lc_doc_generated_lease_001.pdf",
      source: "leaseDocuments",
      createdAt: lifecycleContinuityDates.now,
    },
  };

  return withOverrides(baseByKind[kind], overrides);
}

export function buildLifecycleContinuityScenario(): {
  property: LifecycleContinuityRecord;
  units: LifecycleContinuityRecord[];
  application: LifecycleContinuityRecord;
  applicant: LifecycleContinuityRecord;
  activeTenant: LifecycleContinuityRecord;
  upcomingTenant: LifecycleContinuityRecord;
  archivedTenant: LifecycleContinuityRecord;
  activeLease: LifecycleContinuityRecord;
  upcomingLease: LifecycleContinuityRecord;
  archivedLease: LifecycleContinuityRecord;
  payment: LifecycleContinuityRecord;
  ledgerEntry: LifecycleContinuityRecord;
  obligation: LifecycleContinuityRecord;
  decision: LifecycleContinuityRecord;
  signedDocument: LifecycleContinuityRecord;
  generatedDocument: LifecycleContinuityRecord;
} {
  return {
    property: buildLifecycleContinuityProperty(),
    units: buildLifecycleContinuityUnits(),
    application: buildLifecycleContinuityApplication(),
    applicant: buildLifecycleContinuityTenant("applicant"),
    activeTenant: buildLifecycleContinuityTenant("active"),
    upcomingTenant: buildLifecycleContinuityTenant("upcoming"),
    archivedTenant: buildLifecycleContinuityTenant("archived"),
    activeLease: buildLifecycleContinuityLease("active"),
    upcomingLease: buildLifecycleContinuityLease("upcoming"),
    archivedLease: buildLifecycleContinuityLease("archived"),
    payment: buildLifecycleContinuityPayment(),
    ledgerEntry: buildLifecycleContinuityLedgerEntry(),
    obligation: buildLifecycleContinuityObligation(),
    decision: buildLifecycleContinuityDecision(),
    signedDocument: buildLifecycleContinuityLeaseDocument("signed"),
    generatedDocument: buildLifecycleContinuityLeaseDocument("generated"),
  };
}

function recoveryEvidenceReference(input: LifecycleRecoveryCandidateInput): EvidenceReference {
  const reference = buildEvidenceReference({
    workflowType: input.workflowType,
    referenceType: input.evidenceReferenceType,
    referenceId: input.workflowId,
    label: input.evidenceLabel,
  });
  if (!reference) throw new Error("lifecycle_recovery_fixture_evidence_missing");
  return reference;
}

function buildLifecycleRecoveryCandidate(input: LifecycleRecoveryCandidateInput): LifecycleRecoveryCandidate {
  const workflowInstanceKey = workflowKey(input.workflowType, input.workflowId);
  const snapshotId = workflowInstanceKey;
  const timelineEntryId = `lc_recovery_timeline:${input.workflowType}:${workflowInstanceKey.split(":").pop()}`;
  const snapshot =
    input.derivedState == null
      ? null
      : {
          workflowType: input.workflowType,
          workflowId: input.workflowId,
          workflowInstanceKey,
          state: input.derivedState,
          status: input.derivedState,
          lifecycleContinuityFixture: true,
          fixtureOnly: true,
          metadataOnly: true,
          rawIdsIncluded: false,
          createdAt: lifecycleContinuityDates.recoverySnapshotAt,
          updatedAt: lifecycleContinuityDates.recoverySnapshotAt,
        };
  const timelineEntry =
    input.canonicalState == null
      ? null
      : {
          timelineEntryId,
          workflowType: input.workflowType,
          workflowInstanceKey,
          state: input.canonicalState,
          status: input.canonicalState,
          timestamp: lifecycleContinuityDates.recoveryTimelineAt,
          occurredAt: lifecycleContinuityDates.recoveryTimelineAt,
          entryType: "LIFECYCLE_DIVERGENCE_FIXTURE",
          reasonSummary: input.reasonSummary,
          lifecycleContinuityFixture: true,
          fixtureOnly: true,
          metadataOnly: true,
          appendOnly: true,
          rawIdsIncluded: false,
        };
  const evidenceState = input.evidenceState || input.transition.to;
  const provenanceEvent = captureTransitionEvidence({
    workflowType: input.workflowType,
    workflowInstanceId: input.workflowId,
    currentState: input.transition.from,
    proposedState: evidenceState,
    event: input.transition.event,
    context: {
      actorRole: "landlord",
      actorId: lifecycleContinuityIds.landlordId,
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      authorized: true,
    },
    validation: {
      valid: true,
      currentState: input.transition.from,
      proposedState: evidenceState,
      allowedTransitions: [evidenceState],
    },
    evidenceRefs: [recoveryEvidenceReference(input)],
    occurredAt: lifecycleContinuityDates.recoveryEvidenceAt,
  });

  return {
    workflowType: input.workflowType,
    workflowId: input.workflowId,
    workflowInstanceKey,
    snapshotId,
    timelineEntryId,
    expectedDivergenceType: input.expectedDivergenceType,
    expectedDecision: input.expectedDecision,
    snapshot: snapshot || {},
    timelineEntry: timelineEntry || {},
    provenanceEvent,
    evidenceLabel: input.evidenceLabel,
  };
}

export function buildLifecycleRecoveryCandidates(): LifecycleRecoveryCandidate[] {
  return [
    buildLifecycleRecoveryCandidate({
      workflowType: "lease",
      workflowId: lifecycleContinuityIds.recoveryLeaseId,
      derivedState: "Draft",
      canonicalState: "Active",
      evidenceState: "Draft",
      transition: { from: "Draft", to: "Active", event: "activate" },
      expectedDivergenceType: "METADATA_DIVERGENCE",
      expectedDecision: "ACCEPT_CANONICAL",
      evidenceReferenceType: "lease",
      evidenceLabel: "Synthetic lease activation evidence",
      reasonSummary: "Synthetic lease fixture diverges between draft snapshot and active timeline state.",
    }),
    buildLifecycleRecoveryCandidate({
      workflowType: "payment",
      workflowId: lifecycleContinuityIds.recoveryPaymentId,
      derivedState: "Processing",
      canonicalState: "Confirmed",
      evidenceState: "Failed",
      transition: { from: "Processing", to: "Failed", event: "fail" },
      expectedDivergenceType: "EVIDENCE_MISMATCH",
      expectedDecision: "EVIDENCE_REVIEW_REQUIRED",
      evidenceReferenceType: "payment",
      evidenceLabel: "Synthetic payment reconciliation evidence",
      reasonSummary: "Synthetic payment fixture has evidence that conflicts with the derived payment state.",
    }),
    buildLifecycleRecoveryCandidate({
      workflowType: "maintenance",
      workflowId: lifecycleContinuityIds.recoveryMaintenanceId,
      derivedState: "CostReview",
      canonicalState: null,
      transition: { from: "InProgress", to: "CostReview", event: "request_cost_review" },
      expectedDivergenceType: "ORPHANED_DECISION",
      expectedDecision: "EVIDENCE_REVIEW_REQUIRED",
      evidenceReferenceType: "work_order",
      evidenceLabel: "Synthetic maintenance cost review evidence",
      reasonSummary: "Synthetic maintenance fixture has a derived state without a canonical timeline state.",
    }),
    buildLifecycleRecoveryCandidate({
      workflowType: "decision",
      workflowId: lifecycleContinuityIds.recoveryDecisionId,
      derivedState: null,
      canonicalState: "Reviewed",
      transition: { from: "Appeared", to: "Reviewed", event: "review" },
      expectedDivergenceType: "MISSING_TRANSITION",
      expectedDecision: "ACCEPT_CANONICAL",
      evidenceReferenceType: "decision",
      evidenceLabel: "Synthetic decision review evidence",
      reasonSummary: "Synthetic decision fixture has canonical review timeline state without a derived snapshot.",
    }),
  ];
}

export function seedLifecycleRecoveryCandidates(
  store: {
    seed: (collection: string, id: string, data: LifecycleContinuityRecord) => void;
  },
  candidates: LifecycleRecoveryCandidate[] = buildLifecycleRecoveryCandidates(),
): LifecycleRecoveryCandidate[] {
  for (const candidate of candidates) {
    if (Object.keys(candidate.snapshot).length > 0) {
      store.seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, candidate.snapshotId, candidate.snapshot);
    }
    if (Object.keys(candidate.timelineEntry).length > 0) {
      store.seed(RECOVERY_TIMELINE_COLLECTION, candidate.timelineEntryId, candidate.timelineEntry);
    }
    store.seed(PROVENANCE_EVENTS_COLLECTION, candidate.provenanceEvent.eventId, candidate.provenanceEvent as unknown as LifecycleContinuityRecord);
  }
  return candidates;
}
