import { describe, expect, it } from "vitest";
import { captureTransitionEvidence, workflowInstanceKey } from "../evidenceProvenance";
import {
  appendProvenanceEvent,
  getProvenanceChain,
  getProvenanceEvent,
  queryProvenanceEvents,
} from "../provenanceStorage";
import type { TransitionValidationResult } from "../types";
import { createProvenanceFirestore } from "./testProvenanceStore";

function eventFor(occurredAt: string) {
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
    occurredAt,
  });
}

describe("provenance storage", () => {
  it("appends events immutably and retrieves a single event", async () => {
    const firestore = createProvenanceFirestore();
    const event = eventFor("2026-06-01T12:00:00.000Z");

    await appendProvenanceEvent(event, { authority: { actorRole: "landlord", landlordRef: "landlord-raw-id" }, firestore });
    await expect(
      appendProvenanceEvent(event, { authority: { actorRole: "landlord", landlordRef: "landlord-raw-id" }, firestore })
    ).rejects.toThrow(
      "already_exists"
    );

    const loaded = await getProvenanceEvent(event.eventId, { authority: { actorRole: "admin" }, firestore });
    expect(loaded?.eventId).toBe(event.eventId);
  });

  it("returns chains in chronological order for authorized readers", async () => {
    const later = eventFor("2026-06-01T13:00:00.000Z");
    const earlier = eventFor("2026-06-01T12:00:00.000Z");
    const firestore = createProvenanceFirestore([later, earlier]);

    const chain = await getProvenanceChain({
      workflowType: "lease",
      workflowInstanceId: "lease-raw-id",
      authority: { actorRole: "admin" },
      firestore,
    });

    expect(chain.workflowInstanceKey).toBe(workflowInstanceKey("lease", "lease-raw-id"));
    expect(chain.events.map((event) => event.occurredAt)).toEqual([
      "2026-06-01T12:00:00.000Z",
      "2026-06-01T13:00:00.000Z",
    ]);
  });

  it("filters audit queries by workflow and outcome", async () => {
    const firestore = createProvenanceFirestore([eventFor("2026-06-01T12:00:00.000Z")]);
    const events = await queryProvenanceEvents({
      workflowType: "lease",
      outcome: "valid",
      authority: { actorRole: "admin" },
      firestore,
    });

    expect(events).toHaveLength(1);
    expect(events[0].workflowType).toBe("lease");
  });

  it("denies tenant access to landlord provenance", async () => {
    const event = eventFor("2026-06-01T12:00:00.000Z");
    const firestore = createProvenanceFirestore([event]);
    const loaded = await getProvenanceEvent(event.eventId, {
      authority: { actorRole: "tenant", tenantRef: "access:not-matching" },
      firestore,
    });
    expect(loaded).toBeNull();
  });
});
