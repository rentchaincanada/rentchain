import { describe, expect, it } from "vitest";
import {
  captureTransitionEvidence,
  hasRestrictedProvenanceContent,
  validateProvenanceIntegrity,
} from "../evidenceProvenance";
import type { TransitionValidationResult } from "../types";

describe("evidence provenance capture", () => {
  it("creates immutable metadata-only transition events with safe actor references", () => {
    const validation: TransitionValidationResult<"Pending" | "Processing"> = {
      valid: true,
      currentState: "Pending",
      proposedState: "Processing",
      allowedTransitions: ["Pending"],
    };

    const event = captureTransitionEvidence({
      workflowType: "payment",
      workflowInstanceId: "payment-raw-id",
      currentState: "Pending",
      proposedState: "Processing",
      event: "start_processing",
      context: {
        actorRole: "landlord",
        actorId: "landlord-raw-id",
        authorized: true,
        landlordId: "landlord-raw-id",
      },
      validation,
      occurredAt: "2026-06-01T12:00:00.000Z",
    });

    expect(event.immutable).toBe(true);
    expect(event.metadata.metadataOnly).toBe(true);
    expect(event.metadata.tenantVisible).toBe(false);
    expect(event.metadata.landlordVisible).toBe(false);
    expect(event.actor.actorRef).toMatch(/^actor:/);
    expect(JSON.stringify(event)).not.toContain("landlord-raw-id");
    expect(JSON.stringify(event)).not.toContain("payment-raw-id");
    expect(validateProvenanceIntegrity(event)).toEqual({ valid: true });
  });

  it("marks invalid transitions without exposing sensitive context", () => {
    const validation: TransitionValidationResult<"Pending" | "Confirmed" | "Processing"> = {
      valid: false,
      currentState: "Pending",
      proposedState: "Confirmed",
      allowedTransitions: ["Processing"],
      reason: "Transition from Pending to Confirmed is not allowed.",
    };

    const event = captureTransitionEvidence({
      workflowType: "payment",
      workflowInstanceId: "payment-raw-id",
      currentState: "Pending",
      proposedState: "Confirmed",
      event: "confirm",
      context: { actorRole: "tenant", authorized: false },
      validation,
      occurredAt: "2026-06-01T12:00:00.000Z",
    });

    expect(event.transition.outcome).toBe("invalid");
    expect(event.contextSummary.authorityResolved).toBe(false);
    expect(validateProvenanceIntegrity(event).valid).toBe(true);
  });

  it("detects restricted payload-like evidence content", () => {
    expect(hasRestrictedProvenanceContent({ label: "token secret" })).toBe(true);
  });
});
