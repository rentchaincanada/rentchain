import { describe, expect, it } from "vitest";
import { CANONICAL_EVENTS_COLLECTION } from "../../../lib/events/buildEvent";
import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  OPERATOR_RECOVERY_INTENTS_COLLECTION,
} from "../recoveryStore";
import { captureRecoveryActionIntent, validateRecoveryActionGate } from "../recoveryIntentService";
import { workflowKey } from "../recoveryShared";
import { createRecoveryTestStore } from "./recoveryTestStore";

const adminAuthority = {
  role: "admin" as const,
  operatorRef: "operator:admin-safe",
  landlordRef: null,
  supportAllowed: false,
};

const supportAuthority = {
  role: "support" as const,
  operatorRef: "operator:support-safe",
  landlordRef: null,
  supportAllowed: true,
};

const tenantAuthority = {
  role: "tenant" as const,
  operatorRef: "operator:tenant-safe",
  landlordRef: null,
  supportAllowed: false,
};

describe("recoveryIntentService", () => {
  it("captures append-only recovery action intent for authorized operators", async () => {
    const store = createRecoveryTestStore();
    const recoveryId = workflowKey("decision", "decision-raw-intent-1");
    store.seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, recoveryId, {
      workflowType: "decision",
      workflowId: "decision-raw-intent-1",
      state: "Reviewed",
    });

    const intent = await captureRecoveryActionIntent({
      recoveryId,
      authority: adminAuthority,
      firestore: store,
      now: "2026-06-01T12:00:00.000Z",
      request: {
        actionType: "ACCEPT_CANONICAL",
        reason: "Operator reviewed continuity evidence and intends canonical recovery.",
        authorizationConfirmed: true,
      },
    });

    expect(intent).toMatchObject({
      recoveryId,
      workflowInstanceKey: recoveryId,
      actionType: "ACCEPT_CANONICAL",
      status: "captured",
      authorizationConfirmed: true,
      appendOnly: true,
      metadataOnly: true,
      rawIdsIncluded: false,
    });
    expect(intent.intentId).toMatch(/^recovery_intent:/);
    expect(intent.workflowInstanceKey).not.toContain("decision-raw-intent-1");
    expect(store.read(OPERATOR_RECOVERY_INTENTS_COLLECTION, intent.intentId)).toBeTruthy();
    const auditEvents = await store.collection(CANONICAL_EVENTS_COLLECTION).get();
    expect(auditEvents.docs.map((doc) => doc.data())).toEqual([
      expect.objectContaining({
        eventType: "recovery_intent_captured",
        sourceCollection: "canonicalEvents",
        appendOnly: true,
        rawIdsIncluded: false,
        metadata: expect.objectContaining({
          intentId: expect.stringMatching(/^recovery_intent:/),
          actionType: "ACCEPT_CANONICAL",
          reasonSummary: "Operator reviewed continuity evidence and intends canonical recovery.",
          metadataOnly: true,
          rawIdsIncluded: false,
        }),
      }),
    ]);
  });

  it("rejects unauthorized and invalid recovery intent capture", async () => {
    const store = createRecoveryTestStore();
    const recoveryId = workflowKey("payment", "payment-raw-intent-1");

    await expect(
      captureRecoveryActionIntent({
        recoveryId,
        authority: tenantAuthority,
        firestore: store,
        request: {
          actionType: "ACCEPT_CANONICAL",
          reason: "Invalid tenant attempt.",
          authorizationConfirmed: true,
        },
      })
    ).rejects.toThrow("recovery_intent_forbidden");

    await expect(
      captureRecoveryActionIntent({
        recoveryId,
        authority: supportAuthority,
        firestore: store,
        request: {
          actionType: "ACCEPT_CANONICAL",
          reason: "Missing candidate.",
          authorizationConfirmed: true,
        },
      })
    ).rejects.toThrow("recovery_workflow_not_found");
  });

  it("rejects duplicate intent for the same recovery action", async () => {
    const store = createRecoveryTestStore();
    const recoveryId = workflowKey("lease", "lease-raw-intent-1");
    store.seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, recoveryId, {
      workflowType: "lease",
      workflowId: "lease-raw-intent-1",
      state: "Draft",
    });
    const request = {
      actionType: "ACCEPT_CANONICAL" as const,
      reason: "Lease continuity evidence reviewed.",
      authorizationConfirmed: true,
    };

    await captureRecoveryActionIntent({ recoveryId, authority: supportAuthority, firestore: store, request });

    await expect(
      captureRecoveryActionIntent({ recoveryId, authority: supportAuthority, firestore: store, request })
    ).rejects.toThrow("recovery_intent_already_captured");
  });

  it("validates enforcement gates for fresh, missing, stale, and mismatched intents", async () => {
    const store = createRecoveryTestStore();
    const recoveryId = workflowKey("maintenance", "maintenance-raw-intent-1");
    store.seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, recoveryId, {
      workflowType: "maintenance",
      workflowId: "maintenance-raw-intent-1",
      state: "Escalated",
    });
    const intent = await captureRecoveryActionIntent({
      recoveryId,
      authority: adminAuthority,
      firestore: store,
      now: "2026-06-01T12:00:00.000Z",
      request: {
        actionType: "EVIDENCE_REVIEW_REQUIRED",
        reason: "Evidence needs manual review before correction.",
        authorizationConfirmed: true,
      },
    });

    await expect(
      validateRecoveryActionGate({
        recoveryId,
        intentId: intent.intentId,
        authority: tenantAuthority,
        firestore: store,
      })
    ).rejects.toThrow("recovery_gate_forbidden");

    await expect(
      validateRecoveryActionGate({
        recoveryId,
        intentId: "",
        authority: adminAuthority,
        firestore: store,
      })
    ).rejects.toThrow("recovery_intent_required");

    await expect(
      validateRecoveryActionGate({
        recoveryId,
        intentId: "recovery_intent:missing",
        authority: adminAuthority,
        firestore: store,
      })
    ).resolves.toMatchObject({
      gateStatus: "denied",
      reason: "intent_missing",
      authorizationValid: false,
      intentFresh: false,
    });

    await expect(
      validateRecoveryActionGate({
        recoveryId,
        intentId: intent.intentId,
        authority: supportAuthority,
        firestore: store,
        now: "2026-06-01T13:00:00.000Z",
      })
    ).resolves.toMatchObject({
      gateStatus: "denied",
      reason: "authorization_invalid",
      authorizationValid: false,
      intentFresh: true,
    });

    await expect(
      validateRecoveryActionGate({
        recoveryId,
        intentId: intent.intentId,
        authority: adminAuthority,
        firestore: store,
        now: "2026-06-03T12:00:00.000Z",
      })
    ).resolves.toMatchObject({
      gateStatus: "denied",
      reason: "intent_stale",
      authorizationValid: true,
      intentFresh: false,
    });

    await expect(
      validateRecoveryActionGate({
        recoveryId,
        intentId: intent.intentId,
        authority: adminAuthority,
        firestore: store,
        now: "2026-06-01T13:00:00.000Z",
      })
    ).resolves.toMatchObject({
      gateStatus: "satisfied",
      authorizationValid: true,
      intentFresh: true,
    });

    const auditEvents = (await store.collection(CANONICAL_EVENTS_COLLECTION).get()).docs.map((doc) => doc.data());
    expect(auditEvents.filter((event) => event.eventType === "recovery_gate_validated")).toHaveLength(4);
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "recovery_gate_validated",
          metadata: expect.objectContaining({
            validationOutcome: "passed",
            authorizationValid: true,
            intentFresh: true,
          }),
        }),
        expect.objectContaining({
          eventType: "recovery_gate_validated",
          metadata: expect.objectContaining({
            validationOutcome: "failed",
            denialReason: "intent_stale",
          }),
        }),
      ])
    );
  });
});
