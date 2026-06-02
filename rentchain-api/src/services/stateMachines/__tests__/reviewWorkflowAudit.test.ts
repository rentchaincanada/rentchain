import { describe, expect, it } from "vitest";
import { CANONICAL_EVENTS_COLLECTION } from "../../../lib/events/buildEvent";
import { appendReviewStateTransitionAuditEvent } from "../../../lib/canonicalAudit/reviewStateTransitionAudit";
import { createRecoveryTestStore } from "../../recovery/__tests__/recoveryTestStore";
import { validateDecisionTransition } from "../transitionValidation";

describe("review workflow audit events", () => {
  it("appends canonical audit events from state-machine provenance without changing validation", async () => {
    const store = createRecoveryTestStore();
    const validation = validateDecisionTransition(
      { state: "reviewed" },
      {
        to: "Executed",
        event: "execute",
        captureEvidence: true,
        occurredAt: "2026-06-02T11:00:00.000Z",
        context: {
          actorRole: "landlord",
          actorId: "landlord-user-raw",
          authorized: true,
          decisionId: "decision-raw-1",
          landlordId: "landlord-raw-1",
          actionRecordExists: true,
          sourceValid: true,
        },
      }
    );

    expect(validation.valid).toBe(true);
    expect(validation.provenanceEvent).toBeTruthy();
    const event = await appendReviewStateTransitionAuditEvent({
      provenanceEvent: validation.provenanceEvent!,
      authority: { actorRole: "landlord", landlordRef: "landlord-raw-1" },
      firestore: store,
    });

    expect(event).not.toBeNull();
    expect(event).toEqual(
      expect.objectContaining({
        eventType: "review_state_transitioned",
        appendOnly: true,
        rawIdsIncluded: false,
        metadata: expect.objectContaining({
          workflowType: "decision",
          fromState: "Reviewed",
          toState: "Executed",
          transitionEvent: "execute",
          validationOutcome: "valid",
          metadataOnly: true,
          rawIdsIncluded: false,
        }),
      })
    );
    expect(JSON.stringify(event)).not.toContain("decision-raw-1");
    expect(JSON.stringify(event)).not.toContain("landlord-raw-1");
    expect(store.read(CANONICAL_EVENTS_COLLECTION, event!.eventId)).toBeTruthy();
  });
});
