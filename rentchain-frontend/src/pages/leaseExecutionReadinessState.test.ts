import { describe, expect, it } from "vitest";
import { buildLeaseExecutionReadinessState } from "./leaseExecutionReadinessState";

const readyPackageCategories = [
  { key: "profile_details", label: "Profile details", status: "ready", detail: "Ready." },
  { key: "rental_history", label: "Rental history", status: "ready", detail: "Ready." },
  { key: "documents_records", label: "Documents & records", status: "ready", detail: "Ready." },
  { key: "consent_identity_status", label: "Consent / identity status", status: "ready", detail: "Ready." },
  { key: "application_readiness", label: "Application readiness", status: "ready", detail: "Ready." },
] as const;

describe("leaseExecutionReadinessState", () => {
  it("stays not ready when lease preparation and move-in readiness have not advanced enough", () => {
    const result = buildLeaseExecutionReadinessState({
      audience: "landlord",
      decisionOutcome: {
        outcomeState: "hold_for_later",
        label: "Hold for later",
        source: "derived",
        sourceLabel: "Derived",
        description: "Still on hold.",
        tenantDescription: "Still on hold.",
        blockers: ["Follow-up is still open."],
        landlordNextSteps: ["Wait."],
        tenantNextSteps: ["Wait."],
        timelineEvent: { title: "Hold", description: "Hold", actionRequired: true },
      },
      leasePreparation: {
        preparationState: "not_started",
        label: "Not started",
        summary: "Lease preparation",
        explanation: "Not started.",
        completedItems: [],
        outstandingItems: [],
        blockers: ["Lease prep has not started."],
        nextActions: ["Wait."],
        timelineEvent: null,
      },
      moveInReadiness: {
        readinessState: "not_started",
        label: "Not started",
        summary: "Move-in readiness",
        explanation: "Not started.",
        completedItems: [],
        outstandingItems: [],
        blockers: ["Move-in readiness has not started."],
        nextActions: ["Wait."],
        timelineEvent: null,
      },
      packageCategories: readyPackageCategories as any,
    });

    expect(result.readinessState).toBe("not_ready_for_execution");
    expect(result.timelineEvent).toBeNull();
  });

  it("shows awaiting next action when move-in readiness is organized but no distinct execution step is visible", () => {
    const result = buildLeaseExecutionReadinessState({
      audience: "landlord",
      decisionOutcome: {
        outcomeState: "ready_for_next_step",
        label: "Ready for next step",
        source: "derived",
        sourceLabel: "Derived",
        description: "Ready.",
        tenantDescription: "Ready.",
        blockers: [],
        landlordNextSteps: ["Proceed."],
        tenantNextSteps: ["Wait."],
        timelineEvent: { title: "Ready", description: "Ready", actionRequired: false },
      },
      leasePreparation: {
        preparationState: "ready_for_execution",
        label: "Ready for execution",
        summary: "Lease preparation",
        explanation: "Ready.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Proceed."],
        timelineEvent: { title: "Prep ready", description: "Ready", actionRequired: false },
      },
      moveInReadiness: {
        readinessState: "awaiting_next_action",
        label: "Awaiting next action",
        summary: "Move-in readiness",
        explanation: "Awaiting.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Wait."],
        timelineEvent: { title: "Move-in", description: "Waiting", actionRequired: false },
      },
      packageCategories: readyPackageCategories as any,
    });

    expect(result.readinessState).toBe("awaiting_next_action");
    expect(result.timelineEvent?.title).toBe("Lease execution readiness updated");
  });

  it("shows preparing for execution when the final visible checklist is still forming", () => {
    const result = buildLeaseExecutionReadinessState({
      audience: "tenant",
      decisionOutcome: {
        outcomeState: "ready_for_next_step",
        label: "Ready for next step",
        source: "derived",
        sourceLabel: "Derived",
        description: "Ready.",
        tenantDescription: "Ready.",
        blockers: [],
        landlordNextSteps: ["Proceed."],
        tenantNextSteps: ["Wait."],
        timelineEvent: { title: "Ready", description: "Ready", actionRequired: false },
      },
      leasePreparation: {
        preparationState: "preparing_lease",
        label: "Preparing lease",
        summary: "Lease preparation",
        explanation: "Preparing.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Review lease."],
        timelineEvent: { title: "Prep", description: "Preparing", actionRequired: false },
      },
      moveInReadiness: {
        readinessState: "in_progress",
        label: "Preparing for move-in",
        summary: "Move-in readiness",
        explanation: "In progress.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Review move-in."],
        timelineEvent: { title: "Move-in", description: "Progress", actionRequired: false },
      },
      packageCategories: readyPackageCategories as any,
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 180000,
        status: "draft",
        documentUrl: null,
      },
    });

    expect(result.readinessState).toBe("preparing_for_execution");
    expect(result.outstandingItems.some((item) => item.label === "Final execution-readiness signal")).toBe(true);
    expect(result.timelineEvent?.title).toBe("Lease execution readiness started");
  });

  it("shows ready for execution when visible preparation and move-in requirements are fully organized", () => {
    const result = buildLeaseExecutionReadinessState({
      audience: "tenant",
      decisionOutcome: {
        outcomeState: "ready_for_next_step",
        label: "Ready for next step",
        source: "derived",
        sourceLabel: "Derived",
        description: "Ready.",
        tenantDescription: "Ready.",
        blockers: [],
        landlordNextSteps: ["Proceed."],
        tenantNextSteps: ["Wait."],
        timelineEvent: { title: "Ready", description: "Ready", actionRequired: false },
      },
      leasePreparation: {
        preparationState: "ready_for_execution",
        label: "Ready for execution",
        summary: "Lease preparation",
        explanation: "Ready.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Review lease."],
        timelineEvent: { title: "Prep", description: "Ready", actionRequired: false },
      },
      moveInReadiness: {
        readinessState: "ready_for_move_in",
        label: "Ready for move-in",
        summary: "Move-in readiness",
        explanation: "Ready.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Review move-in."],
        timelineEvent: { title: "Move-in", description: "Ready", actionRequired: false },
      },
      packageCategories: readyPackageCategories as any,
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 180000,
        status: "draft",
        documentUrl: "https://example.com/lease.pdf",
      },
    });

    expect(result.readinessState).toBe("ready_for_execution");
    expect(result.timelineEvent?.title).toBe("Ready for execution");
  });
});
