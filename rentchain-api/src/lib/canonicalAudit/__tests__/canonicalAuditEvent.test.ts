import { describe, expect, it } from "vitest";
import { CANONICAL_EVENTS_COLLECTION } from "../../events/buildEvent";
import { appendCanonicalAuditEvent, safeAuditReference } from "../appendCanonicalAuditEvent";
import { createRecoveryTestStore } from "../../../services/recovery/__tests__/recoveryTestStore";

describe("canonical audit events", () => {
  it("appends immutable typed audit events to the existing canonical events collection", async () => {
    const store = createRecoveryTestStore();
    const event = await appendCanonicalAuditEvent(
      {
        eventType: "recovery_gate_validated",
        actor: { role: "admin", operatorRef: "operator-raw-1", rawIdsIncluded: false },
        authority: { role: "admin", landlordRef: "landlord-raw-1", supportAllowed: false, rawIdsIncluded: false },
        sourceReferenceId: "workflow-raw-1",
        timestamp: "2026-06-02T10:00:00.000Z",
        metadata: {
          intentId: "intent-safe-1",
          recoveryId: "recovery-safe-1",
          gateType: "recovery_action_intent",
          validationOutcome: "passed",
          intentStatus: "captured",
          authorizationValid: true,
          intentFresh: true,
          denialReason: null,
          metadataOnly: true,
          rawIdsIncluded: false,
        },
      },
      { firestore: store }
    );

    expect(event).toEqual(
      expect.objectContaining({
        eventType: "recovery_gate_validated",
        timestamp: "2026-06-02T10:00:00.000Z",
        sourceCollection: "canonicalEvents",
        metadataOnly: true,
        appendOnly: true,
        immutable: true,
        rawIdsIncluded: false,
      })
    );
    expect(event.actor.operatorRef).not.toContain("operator-raw-1");
    expect(event.authority.landlordRef).not.toContain("landlord-raw-1");
    expect(event.sourceReferenceId).not.toContain("workflow-raw-1");
    expect(store.read(CANONICAL_EVENTS_COLLECTION, event.eventId)).toEqual(event);
  });

  it("fails closed when the same immutable event id is appended twice", async () => {
    const store = createRecoveryTestStore();
    const input = {
      eventType: "operator_review_opened" as const,
      actor: { role: "landlord" as const, operatorRef: "landlord-user-1", rawIdsIncluded: false as const },
      authority: { role: "landlord" as const, landlordRef: "landlord-1", supportAllowed: false, rawIdsIncluded: false as const },
      sourceReferenceId: "review-session-1",
      timestamp: "2026-06-02T10:05:00.000Z",
      visibility: "landlord_operator_internal" as const,
      metadata: {
        reviewSessionId: safeAuditReference("review_session", "review-session-1"),
        scope: "decision",
        scopeId: safeAuditReference("review_scope", "decision-1"),
        reviewStatus: "open",
        noteSummary: "Operator review opened.",
        manualOnly: true,
        metadataOnly: true,
        rawIdsIncluded: false,
      },
    };

    await appendCanonicalAuditEvent(input, { firestore: store });
    await expect(appendCanonicalAuditEvent(input, { firestore: store })).rejects.toThrow("already");
  });
});
