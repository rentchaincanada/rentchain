import { describe, expect, it } from "vitest";
import { captureTransitionEvidence, stableProvenanceHash } from "../../stateMachines/evidenceProvenance";
import { createProvenanceFirestore } from "../../stateMachines/__tests__/testProvenanceStore";
import type { TransitionValidationResult } from "../../stateMachines/types";
import { loadProvenanceReviewChain, queryProvenanceReviewEvents } from "../provenanceReviewService";

function leaseEvent() {
  const validation: TransitionValidationResult<"Draft" | "Active"> = {
    valid: true,
    currentState: "Draft",
    proposedState: "Active",
    allowedTransitions: ["Active"],
  };
  return captureTransitionEvidence({
    workflowType: "lease",
    workflowInstanceId: "lease-raw-id",
    currentState: "Draft",
    proposedState: "Active",
    event: "activate",
    context: {
      actorRole: "landlord",
      actorId: "landlord-raw-id",
      authorized: true,
      landlordId: "landlord-raw-id",
    },
    validation,
    occurredAt: "2026-06-01T12:00:00.000Z",
  });
}

describe("provenance review service", () => {
  it("projects admin chains without raw identifiers", async () => {
    const firestore = createProvenanceFirestore([leaseEvent()]);
    const chain = await loadProvenanceReviewChain({
      workflowType: "lease",
      workflowInstanceId: "lease-raw-id",
      role: "admin",
      firestore,
    });

    expect(chain.events).toHaveLength(1);
    expect(chain.events[0].metadataOnly).toBe(true);
    expect(JSON.stringify(chain)).not.toContain("lease-raw-id");
    expect(JSON.stringify(chain)).not.toContain("landlord-raw-id");
  });

  it("allows landlord review only for matching authority reference", async () => {
    const firestore = createProvenanceFirestore([leaseEvent()]);
    const allowed = await queryProvenanceReviewEvents({
      workflowType: "lease",
      role: "landlord",
      landlordRef: "landlord-raw-id",
      firestore,
    });
    const denied = await queryProvenanceReviewEvents({
      workflowType: "lease",
      role: "landlord",
      landlordRef: "other-landlord",
      firestore,
    });

    expect(allowed).toHaveLength(1);
    expect(denied).toHaveLength(0);
    expect(allowed[0].workflowInstanceKey).toContain(stableProvenanceHash("lease-raw-id"));
  });

  it("allows support metadata review without exposing actor references", async () => {
    const firestore = createProvenanceFirestore([leaseEvent()]);
    const events = await queryProvenanceReviewEvents({ workflowType: "lease", role: "support", firestore });

    expect(events).toHaveLength(1);
    expect(events[0].actorRole).toBe("landlord");
    expect(JSON.stringify(events[0])).not.toContain("actor:");
  });
});
