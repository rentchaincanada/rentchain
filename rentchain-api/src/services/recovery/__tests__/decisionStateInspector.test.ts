import { describe, expect, it } from "vitest";
import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  RECOVERY_TIMELINE_COLLECTION,
} from "../recoveryStore";
import { inspectWorkflowState, buildDecisionReconciliation } from "../decisionStateInspector";
import { workflowKey } from "../recoveryShared";
import { createRecoveryTestStore } from "./recoveryTestStore";

const adminAuthority = {
  role: "admin" as const,
  operatorRef: "operator:reviewer",
  landlordRef: null,
  supportAllowed: false,
};

describe("decisionStateInspector", () => {
  it("detects metadata divergence without exposing raw workflow identifiers", async () => {
    const store = createRecoveryTestStore();
    const key = workflowKey("decision", "decision-raw-1");
    store.seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, key, {
      workflowType: "decision",
      workflowId: "decision-raw-1",
      state: "Reviewed",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    store.seed(RECOVERY_TIMELINE_COLLECTION, "timeline-1", {
      workflowInstanceKey: key,
      state: "Appeared",
      timestamp: "2026-01-01T00:01:00.000Z",
    });

    const inspection = await inspectWorkflowState({
      workflowType: "decision",
      workflowId: "decision-raw-1",
      authority: adminAuthority,
      firestore: store,
    });

    expect(inspection.workflowInstanceKey).toMatch(/^decision:instance:/);
    expect(inspection.workflowInstanceKey).not.toContain("decision-raw-1");
    expect(inspection.divergenceType).toBe("METADATA_DIVERGENCE");
    expect(buildDecisionReconciliation(inspection)).toMatchObject({
      proposedDecision: "ACCEPT_CANONICAL",
      manualReviewRequired: true,
    });
  });

  it("fails closed for non-operator authorities", async () => {
    const store = createRecoveryTestStore();
    await expect(
      inspectWorkflowState({
        workflowType: "decision",
        workflowId: "decision-raw-1",
        authority: {
          role: "tenant",
          operatorRef: null,
          landlordRef: null,
          supportAllowed: false,
        },
        firestore: store,
      })
    ).rejects.toThrow("recovery_inspection_forbidden");
  });

  it("returns a degraded inspection for unsafe workflow reference formats", async () => {
    const store = createRecoveryTestStore();
    const inspection = await inspectWorkflowState({
      workflowType: "lease",
      workflowId: "leases/raw-lease-1",
      authority: adminAuthority,
      firestore: store,
    });

    expect(inspection).toMatchObject({
      workflowType: "lease",
      divergenceType: "NONE",
      found: false,
      degraded: true,
      degradedReason: "invalid_workflow_reference",
      evidence: {
        evidenceRefCount: 0,
        latestEvidenceAt: null,
        evidenceState: null,
        metadataOnly: true,
      },
    });
    expect(inspection.workflowInstanceKey).toMatch(/^lease:instance:/);
    expect(inspection.workflowInstanceKey).not.toContain("raw-lease-1");
    expect(buildDecisionReconciliation(inspection)).toMatchObject({
      proposedDecision: "NO_ACTION",
      manualReviewRequired: false,
      reasonCode: "NO_RECOVERY_REQUIRED",
    });
  });
});
