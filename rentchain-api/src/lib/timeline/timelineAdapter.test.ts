import { describe, expect, it } from "vitest";
import type { CanonicalEventV1 } from "../events/eventTypes";
import { canonicalEventToTimelineItem } from "./timelineAdapter";

function buildEvent(overrides?: Partial<CanonicalEventV1>): CanonicalEventV1 {
  return {
    id: "event-1",
    version: "v1",
    type: "controlled_automation.previewed",
    domain: "system",
    action: "controlled_automation_previewed",
    actor: {
      type: "landlord",
      id: "landlord-1",
      role: "landlord",
    },
    resource: {
      type: "analytics_decision",
      id: "decision-1",
    },
    occurredAt: "2026-04-24T00:00:00.000Z",
    recordedAt: "2026-04-24T00:00:00.000Z",
    visibility: "landlord",
    summary: "Controlled automation preview opened for decision-1.",
    metadata: {
      actionLabel: "Open renewals focus",
      workflowCategory: "lease_renewals",
      duplicateGuardActive: false,
      executionGuardKey: "lease.auto_send_notice:lease:lease-1",
    },
    ...overrides,
  };
}

describe("timelineAdapter", () => {
  it("adds readable controlled automation metadata to timeline items", () => {
    const result = canonicalEventToTimelineItem(
      buildEvent({
        type: "controlled_automation.failed",
        metadata: {
          actionLabel: "Open renewals focus",
          workflowCategory: "lease_renewals",
          duplicateGuardActive: true,
          executionGuardKey: "lease.auto_send_notice:lease:lease-1",
          failureReason: "AUTOMATION_EXECUTION_FAILED",
        },
      })
    );

    expect(result.title).toBe("Automation failed");
    expect(result.details).toEqual([
      "Action: Open renewals focus",
      "Workflow: Lease Renewals",
      "Duplicate protection active",
      "Guard key: lease.auto_send_notice:lease:lease-1",
      "Failure reason: AUTOMATION_EXECUTION_FAILED",
    ]);
  });

  it("fails closed when controlled automation metadata is missing", () => {
    const result = canonicalEventToTimelineItem(
      buildEvent({
        metadata: {
          actionLabel: "",
          workflowCategory: "",
          duplicateGuardActive: false,
          executionGuardKey: "",
          failureReason: "",
        },
      })
    );

    expect(result.details).toBeUndefined();
  });

  it("does not project impersonation actor-chain metadata into timeline items", () => {
    const result = canonicalEventToTimelineItem(
      buildEvent({
        id: "impersonation-event-1",
        type: "impersonation.started",
        domain: "system",
        action: "impersonation_started",
        visibility: "internal",
        summary: "Support impersonation started.",
        metadata: {
          realActorId: "admin-1",
          realActorRole: "admin",
          effectiveActorId: "tenant-1",
          effectiveActorRole: "tenant",
          impersonationSessionId: "session-1",
          impersonationReason: "incident_review",
          supportProjectionSafe: true,
          visibilityClass: "admin_support_internal",
          actorChain: {
            realActorId: "admin-1",
            effectiveActorId: "tenant-1",
          },
        },
      })
    );

    expect(result.title).toBe("System Impersonation Started");
    const payload = JSON.stringify(result);
    expect(payload).not.toContain("realActorId");
    expect(payload).not.toContain("effectiveActorId");
    expect(payload).not.toContain("impersonationSessionId");
    expect(payload).not.toContain("supportProjectionSafe");
    expect(payload).not.toContain("admin-1");
    expect(payload).not.toContain("tenant-1");
  });
});
