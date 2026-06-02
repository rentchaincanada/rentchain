import { describe, expect, it } from "vitest";

import {
  buildLifecycleRecoveryCandidates,
  buildLifecycleContinuityLease,
  buildLifecycleContinuityScenario,
  buildLifecycleContinuityTenant,
  lifecycleContinuityDates,
  lifecycleContinuityIds,
  seedLifecycleRecoveryCandidates,
} from "./lifecycleContinuityFixtures";
import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  RECOVERY_TIMELINE_COLLECTION,
} from "../../services/recovery/recoveryStore";
import { PROVENANCE_EVENTS_COLLECTION } from "../../services/stateMachines/provenanceStorage";
import { createRecoveryTestStore } from "../../services/recovery/__tests__/recoveryTestStore";

describe("lifecycle continuity fixtures", () => {
  it("builds deterministic cross-system records for the canonical lifecycle scenario", () => {
    const scenario = buildLifecycleContinuityScenario();

    expect(scenario.property.id).toBe(lifecycleContinuityIds.propertyId);
    expect(scenario.activeLease.id).toBe(lifecycleContinuityIds.activeLeaseId);
    expect(scenario.activeLease.tenantId).toBe(scenario.activeTenant.id);
    expect(scenario.activeLease.propertyId).toBe(scenario.property.id);
    expect(scenario.payment.ledgerEntryId).toBe(scenario.ledgerEntry.id);
    expect(scenario.ledgerEntry.paymentDocumentId).toBe(scenario.payment.id);
    expect(scenario.obligation.dueDate).toBe(lifecycleContinuityDates.obligationDueDate);
    expect(scenario.obligation.evidence).toEqual([
      {
        paymentDocumentId: scenario.payment.id,
        ledgerEntryId: scenario.ledgerEntry.id,
        amountCents: 164000,
        paymentDate: lifecycleContinuityDates.paymentDate,
      },
    ]);
    expect(scenario.decision.metadata).toMatchObject({
      obligationId: scenario.obligation.id,
      dueDate: lifecycleContinuityDates.obligationDueDate,
      paymentDocumentId: scenario.payment.id,
      ledgerEntryId: scenario.ledgerEntry.id,
    });
    expect(scenario.signedDocument.leaseId).toBe(scenario.activeLease.id);
    expect(scenario.generatedDocument.leaseId).toBe(scenario.upcomingLease.id);
  });

  it("keeps builder overrides isolated from later fixture calls", () => {
    const changedTenant = buildLifecycleContinuityTenant("active", {
      fullName: "Changed Tenant",
    });
    const unchangedTenant = buildLifecycleContinuityTenant("active");
    const changedLease = buildLifecycleContinuityLease("active", {
      rentCents: 175000,
    });
    const unchangedLease = buildLifecycleContinuityLease("active");

    expect(changedTenant.fullName).toBe("Changed Tenant");
    expect(unchangedTenant.fullName).toBe("John Smith");
    expect(changedLease.rentCents).toBe(175000);
    expect(unchangedLease.rentCents).toBe(164000);
  });

  it("builds deterministic metadata-only recovery candidates for lifecycle divergence QA", () => {
    const candidates = buildLifecycleRecoveryCandidates();
    const repeatedCandidates = buildLifecycleRecoveryCandidates();

    expect(candidates).toEqual(repeatedCandidates);
    expect(candidates.map((candidate) => candidate.workflowType)).toEqual([
      "lease",
      "payment",
      "maintenance",
      "decision",
    ]);
    expect(candidates.map((candidate) => candidate.expectedDivergenceType)).toEqual([
      "METADATA_DIVERGENCE",
      "EVIDENCE_MISMATCH",
      "ORPHANED_DECISION",
      "MISSING_TRANSITION",
    ]);
    expect(candidates.every((candidate) => candidate.workflowInstanceKey.includes(":instance:"))).toBe(true);
    expect(candidates.every((candidate) => candidate.provenanceEvent.metadata.metadataOnly === true)).toBe(true);
    expect(candidates.every((candidate) => candidate.provenanceEvent.metadata.appendOnly === true)).toBe(true);
    expect(candidates.every((candidate) => candidate.provenanceEvent.access.rawIdsIncluded === false)).toBe(true);
    expect(candidates.every((candidate) => candidate.provenanceEvent.contextSummary.rawPayloadIncluded === false)).toBe(true);
    expect(candidates.every((candidate) => candidate.provenanceEvent.evidenceRefs.every((ref) => ref.metadataOnly === true && ref.rawIdsIncluded === false && ref.payloadIncluded === false))).toBe(true);
    expect(JSON.stringify(candidates)).not.toMatch(/secret-token|bearer-secret|gs:\/\/|storage\.googleapis\.com|raw-provider-payload/i);
  });

  it("seeds recovery candidates into existing recovery collections only", () => {
    const store = createRecoveryTestStore();
    const candidates = seedLifecycleRecoveryCandidates(store);
    const leaseCandidate = candidates.find((candidate) => candidate.workflowType === "lease")!;
    const decisionCandidate = candidates.find((candidate) => candidate.workflowType === "decision")!;

    expect(store.read(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, leaseCandidate.snapshotId)).toMatchObject({
      workflowType: "lease",
      metadataOnly: true,
      rawIdsIncluded: false,
      fixtureOnly: true,
    });
    expect(store.read(RECOVERY_TIMELINE_COLLECTION, leaseCandidate.timelineEntryId)).toMatchObject({
      workflowType: "lease",
      metadataOnly: true,
      appendOnly: true,
      rawIdsIncluded: false,
      fixtureOnly: true,
    });
    expect(store.read(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, decisionCandidate.snapshotId)).toBeNull();
    expect(store.read(RECOVERY_TIMELINE_COLLECTION, decisionCandidate.timelineEntryId)).toMatchObject({
      workflowType: "decision",
      state: "Reviewed",
      fixtureOnly: true,
    });
    expect(store.read(PROVENANCE_EVENTS_COLLECTION, leaseCandidate.provenanceEvent.eventId)).toMatchObject({
      workflowType: "lease",
      immutable: true,
    });
  });
});
