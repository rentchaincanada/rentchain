import { describe, expect, it } from "vitest";
import {
  OPERATOR_RECOVERY_LOGS_COLLECTION,
  RECOVERY_TIMELINE_COLLECTION,
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
} from "../recoveryStore";
import { applyReconciliationDecision } from "../decisionReconciliationService";
import { workflowKey } from "../recoveryShared";
import { createRecoveryTestStore } from "./recoveryTestStore";

const supportAuthority = {
  role: "support" as const,
  operatorRef: "operator:support",
  landlordRef: null,
  supportAllowed: true,
};

describe("decisionReconciliationService", () => {
  it("appends recovery logs and timeline entries without mutating the source snapshot", async () => {
    const store = createRecoveryTestStore();
    const key = workflowKey("payment", "payment-raw-1");
    store.seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, key, {
      workflowType: "payment",
      workflowId: "payment-raw-1",
      state: "Failed",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    store.seed(RECOVERY_TIMELINE_COLLECTION, "timeline-existing", {
      workflowInstanceKey: key,
      state: "Confirmed",
      timestamp: "2026-01-01T00:02:00.000Z",
    });

    const result = await applyReconciliationDecision({
      workflowType: "payment",
      workflowId: "payment-raw-1",
      authority: supportAuthority,
      firestore: store,
      request: {
        decisionType: "ACCEPT_CANONICAL",
        reasonCode: "OPERATOR_REVIEWED_PAYMENT_DIVERGENCE",
        reason: "Canonical payment state confirmed from review timeline.",
      },
    });

    expect(result.recoveryLog).toMatchObject({
      workflowType: "payment",
      workflowInstanceKey: key,
      divergenceType: "METADATA_DIVERGENCE",
      reconciliationDecision: "ACCEPT_CANONICAL",
      metadataOnly: true,
      appendOnly: true,
      rawIdsIncluded: false,
    });
    expect(result.recoveryLog.workflowInstanceKey).not.toContain("payment-raw-1");
    expect(store.read(OPERATOR_RECOVERY_LOGS_COLLECTION, result.recoveryLog.logId)).toBeTruthy();
    expect(store.read(RECOVERY_TIMELINE_COLLECTION, result.recoveryLog.timelineEntryId)).toMatchObject({
      entryType: "RECOVERY_ACTION",
      rawIdsIncluded: false,
    });
    expect(store.read(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, key)).toMatchObject({ state: "Failed" });
  });

  it("rejects duplicate reconciliation appends", async () => {
    const store = createRecoveryTestStore();
    const key = workflowKey("lease", "lease-raw-1");
    store.seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, key, {
      workflowType: "lease",
      workflowId: "lease-raw-1",
      state: "Draft",
    });
    store.seed(RECOVERY_TIMELINE_COLLECTION, "timeline-existing", {
      workflowInstanceKey: key,
      state: "Active",
      timestamp: "2026-01-01T00:02:00.000Z",
    });
    const request = {
      decisionType: "ACCEPT_CANONICAL" as const,
      reasonCode: "LEASE_STATE_CONFIRMED",
      reason: "Canonical lease state confirmed.",
    };
    await applyReconciliationDecision({ workflowType: "lease", workflowId: "lease-raw-1", authority: supportAuthority, firestore: store, request });
    await expect(
      applyReconciliationDecision({ workflowType: "lease", workflowId: "lease-raw-1", authority: supportAuthority, firestore: store, request })
    ).rejects.toThrow("recovery_already_logged");
  });
});
