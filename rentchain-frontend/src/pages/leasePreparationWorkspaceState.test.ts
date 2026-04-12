import { describe, expect, it } from "vitest";
import { buildLeasePreparationWorkspaceState } from "./leasePreparationWorkspaceState";

const readyPackageCategories = [
  { key: "profile_details", label: "Profile details", status: "ready", detail: "Ready." },
  { key: "rental_history", label: "Rental history", status: "ready", detail: "Ready." },
  { key: "documents_records", label: "Documents & records", status: "ready", detail: "Ready." },
  { key: "consent_identity_status", label: "Consent / identity status", status: "ready", detail: "Ready." },
  { key: "application_readiness", label: "Application readiness", status: "ready", detail: "Ready." },
] as const;

describe("leasePreparationWorkspaceState", () => {
  it("stays not started when the lease step is not ready", () => {
    const result = buildLeasePreparationWorkspaceState({
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
      packageCategories: readyPackageCategories as any,
    });

    expect(result.preparationState).toBe("not_started");
    expect(result.timelineEvent).toBeNull();
  });

  it("shows awaiting next action when the file is ready but no lease record is visible", () => {
    const result = buildLeasePreparationWorkspaceState({
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
        explanation: "Ready for lease step.",
        blockers: [],
        nextActions: ["Start lease step."],
        timelineEvent: { title: "Lease ready", description: "Lease ready", actionRequired: false },
      },
      packageCategories: readyPackageCategories as any,
    });

    expect(result.preparationState).toBe("awaiting_next_action");
    expect(result.timelineEvent?.title).toBe("Lease preparation awaiting next action");
  });

  it("shows preparing lease when a lease record is visible but no document is available yet", () => {
    const result = buildLeasePreparationWorkspaceState({
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

    expect(result.preparationState).toBe("preparing_lease");
    expect(result.outstandingItems.some((item) => item.label === "Lease document availability")).toBe(true);
  });

  it("shows ready for execution when the visible preparation record includes a document", () => {
    const result = buildLeasePreparationWorkspaceState({
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

    expect(result.preparationState).toBe("ready_for_execution");
    expect(result.timelineEvent?.title).toBe("Lease preparation ready for execution");
  });
});
