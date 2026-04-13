import { describe, expect, it } from "vitest";
import { buildMoveInReadinessWorkspaceState } from "./moveInReadinessWorkspaceState";

const readyPackageCategories = [
  { key: "profile_details", label: "Profile details", status: "ready", detail: "Ready." },
  { key: "rental_history", label: "Rental history", status: "ready", detail: "Ready." },
  { key: "documents_records", label: "Documents & records", status: "ready", detail: "Ready." },
  { key: "consent_identity_status", label: "Consent / identity status", status: "ready", detail: "Ready." },
  { key: "application_readiness", label: "Application readiness", status: "ready", detail: "Ready." },
] as const;

describe("moveInReadinessWorkspaceState", () => {
  it("stays not started when lease and preparation flow have not advanced enough", () => {
    const result = buildMoveInReadinessWorkspaceState({
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
      leaseTransition: {
        transitionState: "not_ready_for_lease",
        label: "Not ready for lease step",
        summary: "Lease transition",
        explanation: "Not ready yet.",
        blockers: ["Follow-up is still open."],
        nextActions: ["Finish follow-up."],
        timelineEvent: null,
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
      packageCategories: readyPackageCategories as any,
    });

    expect(result.readinessState).toBe("not_started");
    expect(result.timelineEvent).toBeNull();
  });

  it("shows awaiting next action when lease preparation is organized but no move-in step is visible", () => {
    const result = buildMoveInReadinessWorkspaceState({
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
      leaseTransition: {
        transitionState: "ready_for_lease_step",
        label: "Ready for lease step",
        summary: "Lease transition",
        explanation: "Ready.",
        blockers: [],
        nextActions: ["Start lease step."],
        timelineEvent: { title: "Lease ready", description: "Lease ready", actionRequired: false },
      },
      leasePreparation: {
        preparationState: "awaiting_next_action",
        label: "Awaiting next action",
        summary: "Lease preparation",
        explanation: "Awaiting next action.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Start prep."],
        timelineEvent: { title: "Lease prep", description: "Awaiting", actionRequired: false },
      },
      packageCategories: readyPackageCategories as any,
    });

    expect(result.readinessState).toBe("awaiting_next_action");
    expect(result.timelineEvent?.title).toBe("Move-in readiness updated");
  });

  it("shows in progress when a lease record is visible but the move-in checklist is still forming", () => {
    const result = buildMoveInReadinessWorkspaceState({
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
      leaseTransition: {
        transitionState: "lease_step_started",
        label: "Lease step started",
        summary: "Lease transition",
        explanation: "Started.",
        blockers: [],
        nextActions: ["Review lease step."],
        timelineEvent: { title: "Lease started", description: "Started", actionRequired: false },
      },
      leasePreparation: {
        preparationState: "preparing_lease",
        label: "Preparing lease",
        summary: "Lease preparation",
        explanation: "Preparing lease.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Review lease."],
        timelineEvent: { title: "Prep", description: "Prep", actionRequired: false },
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

    expect(result.readinessState).toBe("in_progress");
    expect(result.outstandingItems.some((item) => item.label === "Lease document visibility")).toBe(true);
    expect(result.timelineEvent?.title).toBe("Move-in readiness started");
  });

  it("shows ready for move-in when the visible lease and preparation details are fully organized", () => {
    const result = buildMoveInReadinessWorkspaceState({
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
      leaseTransition: {
        transitionState: "lease_step_started",
        label: "Lease step started",
        summary: "Lease transition",
        explanation: "Started.",
        blockers: [],
        nextActions: ["Review lease step."],
        timelineEvent: { title: "Lease started", description: "Started", actionRequired: false },
      },
      leasePreparation: {
        preparationState: "ready_for_execution",
        label: "Ready for execution",
        summary: "Lease preparation",
        explanation: "Ready for execution.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Review lease."],
        timelineEvent: { title: "Prep", description: "Prep", actionRequired: false },
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

    expect(result.readinessState).toBe("ready_for_move_in");
    expect(result.timelineEvent?.title).toBe("Ready for move-in");
  });
});
