import { describe, expect, it } from "vitest";
import { buildLeaseFlowTransitionState } from "./leaseFlowTransitionState";

describe("leaseFlowTransitionState", () => {
  it("keeps the lease step blocked when the decision outcome is not ready", () => {
    const result = buildLeaseFlowTransitionState({
      audience: "landlord",
      decisionOutcome: {
        outcomeState: "hold_for_later",
        label: "Hold for later",
        source: "derived",
        sourceLabel: "Derived from current review state",
        description: "Still in review.",
        tenantDescription: "Still in review.",
        blockers: ["Documents still need follow-up."],
        landlordNextSteps: ["Finish follow-up."],
        tenantNextSteps: ["Wait for updates."],
        timelineEvent: {
          title: "Application placed on hold",
          description: "Still in review.",
          actionRequired: true,
        },
      },
    });

    expect(result).toMatchObject({
      transitionState: "not_ready_for_lease",
      label: "Not ready for lease step",
      blockers: ["Documents still need follow-up."],
      timelineEvent: null,
    });
  });

  it("marks the file ready for the lease step for landlords when the outcome is ready", () => {
    const result = buildLeaseFlowTransitionState({
      audience: "landlord",
      decisionOutcome: {
        outcomeState: "ready_for_next_step",
        label: "Ready for next step",
        source: "derived",
        sourceLabel: "Derived from current review state",
        description: "Ready to move forward.",
        tenantDescription: "Ready to move forward.",
        blockers: [],
        landlordNextSteps: ["Proceed."],
        tenantNextSteps: ["Watch for updates."],
        timelineEvent: {
          title: "Application marked Ready for next step",
          description: "Ready.",
          actionRequired: false,
        },
      },
    });

    expect(result).toMatchObject({
      transitionState: "ready_for_lease_step",
      label: "Ready for lease step",
    });
    expect(result.timelineEvent?.title).toBe("Application marked ready for lease step");
  });

  it("shows awaiting-next-action for tenants until a lease record is visible", () => {
    const result = buildLeaseFlowTransitionState({
      audience: "tenant",
      decisionOutcome: {
        outcomeState: "ready_for_next_step",
        label: "Ready for next step",
        source: "derived",
        sourceLabel: "Derived from current review state",
        description: "Ready to move forward.",
        tenantDescription: "Ready to move forward.",
        blockers: [],
        landlordNextSteps: ["Proceed."],
        tenantNextSteps: ["Watch for updates."],
        timelineEvent: {
          title: "Application marked Ready for next step",
          description: "Ready.",
          actionRequired: false,
        },
      },
    });

    expect(result).toMatchObject({
      transitionState: "awaiting_next_action",
      label: "Awaiting next lease action",
    });
  });

  it("shows lease-step-started when a lease workspace record is already visible", () => {
    const result = buildLeaseFlowTransitionState({
      audience: "tenant",
      decisionOutcome: {
        outcomeState: "ready_for_next_step",
        label: "Ready for next step",
        source: "derived",
        sourceLabel: "Derived from current review state",
        description: "Ready to move forward.",
        tenantDescription: "Ready to move forward.",
        blockers: [],
        landlordNextSteps: ["Proceed."],
        tenantNextSteps: ["Watch for updates."],
        timelineEvent: {
          title: "Application marked Ready for next step",
          description: "Ready.",
          actionRequired: false,
        },
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 180000,
        status: "draft",
        documentUrl: null,
      },
    });

    expect(result).toMatchObject({
      transitionState: "lease_step_started",
      label: "Lease step started",
    });
    expect(result.timelineEvent?.title).toBe("Lease step started");
  });
});
