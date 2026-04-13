import { describe, expect, it } from "vitest";
import { buildLeaseSigningWorkspaceState } from "./leaseSigningWorkspaceState";

describe("leaseSigningWorkspaceState", () => {
  it("stays not ready when execution handoff is still blocked", () => {
    const result = buildLeaseSigningWorkspaceState({
      audience: "landlord",
      executionWorkspace: {
        executionState: "not_ready_for_execution",
        label: "Not ready for execution",
        summary: "Lease execution workspace",
        explanation: "Blocked.",
        blockers: ["Execution handoff is still blocked."],
        nextSteps: ["Wait."],
        timelineEvent: null,
      },
    });

    expect(result.signingState).toBe("not_ready_for_signing");
    expect(result.timelineEvent).toBeNull();
  });

  it("shows ready for signing when execution is ready but no visible lease signing record exists yet", () => {
    const result = buildLeaseSigningWorkspaceState({
      audience: "landlord",
      executionWorkspace: {
        executionState: "ready_for_execution",
        label: "Ready for execution",
        summary: "Lease execution workspace",
        explanation: "Ready.",
        blockers: [],
        nextSteps: ["Move into the next step."],
        timelineEvent: {
          title: "Ready for execution",
          description: "Ready.",
          actionRequired: false,
        },
      },
    });

    expect(result.signingState).toBe("ready_for_signing");
    expect(result.currentActor).toBe("landlord");
    expect(result.timelineEvent?.title).toBe("Lease ready for signing");
  });

  it("shows awaiting tenant signature when the lease document is visible and the lease is sent", () => {
    const result = buildLeaseSigningWorkspaceState({
      audience: "tenant",
      executionWorkspace: {
        executionState: "execution_in_progress",
        label: "Execution in progress",
        summary: "Lease execution workspace",
        explanation: "Started.",
        blockers: [],
        nextSteps: ["Review the lease."],
        timelineEvent: {
          title: "Execution started",
          description: "Started.",
          actionRequired: false,
        },
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "sent",
        documentUrl: "https://example.com/lease.pdf",
      },
    });

    expect(result.signingState).toBe("awaiting_tenant_signature");
    expect(result.currentActor).toBe("tenant");
    expect(result.timelineEvent?.actionRequired).toBe(true);
  });

  it("shows signed when the visible lease status is already signed", () => {
    const result = buildLeaseSigningWorkspaceState({
      audience: "tenant",
      executionWorkspace: {
        executionState: "execution_in_progress",
        label: "Execution in progress",
        summary: "Lease execution workspace",
        explanation: "Started.",
        blockers: [],
        nextSteps: ["Review the lease."],
        timelineEvent: {
          title: "Execution started",
          description: "Started.",
          actionRequired: false,
        },
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "signed",
        documentUrl: "https://example.com/lease.pdf",
      },
    });

    expect(result.signingState).toBe("signed_or_completed");
    expect(result.timelineEvent?.title).toBe("Lease signing completed");
  });
});
