import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OperationalCommandCenterPage, {
  deriveCommandCenterSignals,
  deriveOperationalReviewQueueItems,
  prioritizeOperationalItems,
  reviewWorkspacePreviewForSignal,
  scopedSourceDestinationForSignal,
} from "./OperationalCommandCenterPage";

const mocks = vi.hoisted(() => ({
  fetchDecisionInbox: vi.fn(),
  fetchDashboardSummary: vi.fn(),
  getActiveLeasesForLandlord: vi.fn(),
  fetchProperties: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/decisionInboxApi", async () => {
  const actual = await vi.importActual<any>("@/api/decisionInboxApi");
  return {
    ...actual,
    fetchDecisionInbox: mocks.fetchDecisionInbox,
  };
});

vi.mock("@/api/dashboard", () => ({
  fetchDashboardSummary: mocks.fetchDashboardSummary,
}));

vi.mock("@/api/leasesApi", async () => {
  const actual = await vi.importActual<any>("@/api/leasesApi");
  return {
    ...actual,
    getActiveLeasesForLandlord: mocks.getActiveLeasesForLandlord,
  };
});

vi.mock("@/api/propertiesApi", async () => {
  const actual = await vi.importActual<any>("@/api/propertiesApi");
  return {
    ...actual,
    fetchProperties: mocks.fetchProperties,
  };
});

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode }) => {
    mocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

afterEach(() => {
  cleanup();
});

function decision(overrides: Record<string, any> = {}) {
  return {
    id: "decision-1",
    title: "Review missing payment",
    description: "Expected rent payment needs review.",
    severity: "critical",
    status: "open",
    type: "billing",
    source: "lease_ledger",
    relatedEntity: { kind: "lease", id: "lease-1", label: "North Towers · Unit 101" },
    destination: "/leases/lease-1/ledger",
    automationEligible: false,
    workflow: {
      queue: "delinquency_review",
      workflowState: "new",
      ownershipType: "operations",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
    },
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function lease(overrides: Record<string, any> = {}) {
  return {
    id: "lease-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    propertyName: "North Towers",
    unitId: "unit-101",
    unitNumber: "101",
    tenantName: "John Smith",
    monthlyRent: 1640,
    startDate: "2026-06-01",
    endDate: "2026-07-15",
    status: "active",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    leaseExecution: {
      executionStatus: "blocked",
      executionLabel: "Lease execution blocked",
      executionDescription: "Missing landlord signature.",
      requiredNextAction: "landlord_signature",
      tenantSignatureStatus: "completed",
      landlordSignatureStatus: "needed",
      pdfStatus: "ready",
      completedAt: null,
    },
    stateCoherence: {
      coherenceStatus: "review_required",
      coherenceLabel: "Occupancy review needed",
      coherenceReason: "Lease is active but occupancy state conflicts.",
      leaseExecutionState: "blocked",
      leaseOperationalState: "review_required",
      occupancyState: "review_required",
      tenantOperationalState: "review_required",
      paymentReadinessState: "review_required",
      sourceFields: {},
      flags: {
        leaseMarkedActiveBeforeExecution: true,
        activeLeaseOnVacantUnit: true,
        occupiedUnitWithoutActiveExecutedLease: false,
        tenantActiveWithoutExecutedOccupancy: false,
        paymentActivityWithoutProviderSetup: false,
        hasStateConflict: true,
        requiresReview: true,
      },
    },
    paymentReadiness: {
      readinessStatus: "blocked",
      readinessLabel: "Payment setup blocked",
      readinessDescription: "Review rent terms before payment setup.",
      requiredNextAction: "review_rent_terms",
      rentTerms: {
        rentAmountAvailable: true,
        dueDateAvailable: false,
        leaseDatesAvailable: true,
        tenantLinked: true,
        leaseExecuted: false,
      },
      paymentSetup: {
        processorConnected: false,
        moneyMovementEnabled: false,
        storedPaymentMethod: false,
      },
    },
    signatureStatus: "awaiting_landlord_signature",
    signatureReadinessLabel: "Landlord signature pending",
    signatureReadinessDescription: "Landlord signature is required before execution completes.",
    leasePdfStatus: "pending",
    leasePdfLabel: "Lease package pending",
    leasePdfDescription: "Generated lease package is not ready yet.",
    jurisdictionPolicies: [
      {
        jurisdiction: "NS",
        policyKey: "lease_renewal_review",
        status: "review",
        severity: "warning",
        label: "Lease renewal review recommended",
        reason: "Lease end date is approaching.",
        recommendation: "Review workflow timing.",
        sourceRuleKey: "lease_renewal_review",
        confidence: "medium",
        legalAdvice: false,
        disclaimer: "Workflow guidance only — verify local legal requirements.",
      },
    ],
    ...overrides,
  };
}

describe("deriveCommandCenterSignals", () => {
  it("aggregates decision, lease, occupancy, document, and payment readiness signals without actions", () => {
    const signals = deriveCommandCenterSignals({
      decisions: [decision()],
      leases: [lease()],
      properties: [
        {
          id: "property-1",
          name: "North Towers",
          addressLine1: "1 Main",
          city: "Halifax",
          totalUnits: 2,
          units: [{ id: "unit-102", unitNumber: "102", rent: 1540, status: "vacant" }],
          createdAt: "2026-01-01T00:00:00.000Z",
        } as any,
      ],
      now: new Date("2026-06-15T00:00:00.000Z"),
    });

    expect(signals.map((signal) => signal.category)).toEqual(
      expect.arrayContaining(["payments", "lease_lifecycle", "occupancy", "documents"])
    );
    expect(signals.find((signal) => signal.id === "decision:decision-1")).toMatchObject({
      category: "payments",
      severity: "critical",
      priorityGroup: "critical",
      destination: "/leases/lease-1/ledger",
      workflowStatus: "New",
      reviewStatus: "Open",
      financialStatus: "Review required",
      nextActionLabel: "Review payment evidence",
    });
    expect(signals.some((signal) => signal.title === "Lease ending soon")).toBe(true);
    expect(signals.some((signal) => signal.title === "Vacant units visible")).toBe(true);
  });

  it("routes operational items into deterministic priority groups highest priority first", () => {
    const signals = deriveCommandCenterSignals({
      decisions: [
        decision({ id: "info-1", severity: "info", type: "admin", workflow: { ...decision().workflow, queue: "general_review", escalationLevel: "none" } }),
        decision({ id: "critical-payment", severity: "medium", type: "billing", workflow: { ...decision().workflow, queue: "delinquency_review" } }),
      ],
      leases: [
        lease({
          id: "upcoming-lease",
          endDate: "2026-08-01",
          leaseExecution: { ...lease().leaseExecution, executionStatus: "fully_executed" },
          stateCoherence: { ...lease().stateCoherence, flags: { ...lease().stateCoherence.flags, requiresReview: false, hasStateConflict: false } },
          paymentReadiness: { ...lease().paymentReadiness, readinessStatus: "ready_to_configure" },
          signatureStatus: "signed",
          leasePdfStatus: "ready",
          jurisdictionPolicies: [],
        }),
      ],
      properties: [
        {
          id: "property-1",
          name: "North Towers",
          addressLine1: "1 Main",
          city: "Halifax",
          totalUnits: 1,
          units: [{ id: "unit-102", unitNumber: "102", rent: 1540, status: "vacant" }],
          createdAt: "2026-01-01T00:00:00.000Z",
        } as any,
      ],
      now: new Date("2026-06-15T00:00:00.000Z"),
    });

    expect(signals.map((signal) => signal.priorityGroup)).toEqual(
      expect.arrayContaining(["critical", "upcoming", "informational"])
    );
    expect(signals[0]).toMatchObject({ id: "decision:critical-payment", priorityGroup: "critical" });
    expect(prioritizeOperationalItems([...signals].reverse()).map((signal) => signal.id)).toEqual(signals.map((signal) => signal.id));
  });

  it("normalizes machine reason labels into operator-readable copy", () => {
    const signals = deriveCommandCenterSignals({
      leases: [
        lease({
          stateCoherence: {
            ...lease().stateCoherence,
            coherenceLabel: "Needs review",
            coherenceReason: "lease_status_active_but_execution_incomplete",
          },
        }),
      ],
      properties: [],
    });

    const coherenceSignal = signals.find((signal) => signal.id === "lease-coherence:lease-1");
    expect(coherenceSignal).toMatchObject({
      title: "Active lease needs execution review",
      description: "Lease is marked active, but signing or execution is incomplete.",
    });
    expect(JSON.stringify(signals)).not.toContain("lease_status_active_but_execution_incomplete");
  });

  it("keeps resolved and dismissed decisions out of the active command center queue", () => {
    const signals = deriveCommandCenterSignals({
      decisions: [decision({ id: "resolved-1", status: "resolved" }), decision({ id: "dismissed-1", status: "dismissed" })],
      leases: [],
      properties: [],
    });

    expect(signals).toEqual([]);
  });

  it("derives manual-only review workspace preview metadata from operational signals", () => {
    const signal = deriveCommandCenterSignals({
      decisions: [decision()],
      leases: [lease()],
      properties: [],
    }).find((item) => item.id === "decision:decision-1");

    expect(signal).toBeTruthy();
    const preview = reviewWorkspacePreviewForSignal(signal!);
    expect(preview).toEqual(
      expect.objectContaining({
        workspaceType: "payment_ledger_review",
        reviewStatus: "Open",
        reviewPriority: "Critical",
        routingReason: "Delinquency or payment evidence review",
        visibilityClass: "landlord_operational",
        manualOnly: true,
        autonomousActionsEnabled: false,
      })
    );
    expect(preview.evidenceLinks).toEqual([
      expect.objectContaining({
        label: "Payments / obligations source workflow",
        destination: "/leases/lease-1/ledger",
      }),
    ]);
    expect(preview.relatedResources).toEqual([expect.objectContaining({ label: "North Towers · 101 · John Smith" })]);
    expect(JSON.stringify(preview)).not.toContain("tenantVisible");
    expect(JSON.stringify(preview)).not.toContain("financialMutation");
    expect(JSON.stringify(preview)).not.toContain("institutionalSharing");
    expect(JSON.stringify(preview)).not.toContain("rawPayload");
  });

  it("derives deterministic manual-only operational review queue items", () => {
    const signals = deriveCommandCenterSignals({
      decisions: [decision()],
      leases: [lease()],
      properties: [],
    });

    const queueItems = deriveOperationalReviewQueueItems(signals);
    const paymentItem = queueItems.find((item) => item.queueItemId === "manual-review-queue:decision:decision-1");

    expect(paymentItem).toEqual(
      expect.objectContaining({
        title: "Review missing payment",
        contextLabel: "North Towers · 101 · John Smith",
        workspaceType: "payment_ledger_review",
        reviewStatus: "Open",
        reviewPriority: "Critical",
        routingReason: "Delinquency or payment evidence review",
        assignmentLabel: "Operations owned",
        financialStatus: "Review required",
        sensitivityClass: "sensitive",
        visibilityClass: "landlord_operational",
        manualOnly: true,
        autonomousActionsEnabled: false,
      })
    );
    expect(queueItems.map((item) => item.queueItemId)).toEqual(
      prioritizeOperationalItems(signals).map((signal) => `manual-review-queue:${signal.id}`)
    );
    expect(JSON.stringify(queueItems)).not.toContain("tenantVisible");
    expect(JSON.stringify(queueItems)).not.toContain("rawPayload");
    expect(JSON.stringify(queueItems)).not.toContain("providerPayload");
    expect(JSON.stringify(queueItems)).not.toContain("financialMutation");
    expect(JSON.stringify(queueItems)).not.toContain("institutionalSharing");
  });

  it("uses scoped lease summary links for lease review queue items when a landlord-scoped lease id is available", () => {
    const signals = deriveCommandCenterSignals({
      decisions: [],
      leases: [lease()],
      properties: [],
    });

    const executionSignal = signals.find((signal) => signal.id === "lease-execution:lease-1");
    expect(executionSignal).toEqual(
      expect.objectContaining({
        destination: "/leases",
        scopedLeaseId: "lease-1",
      })
    );
    expect(scopedSourceDestinationForSignal(executionSignal!)).toBe("/leases/lease-1/summary");

    const queueItems = deriveOperationalReviewQueueItems(signals);
    const executionQueueItem = queueItems.find((item) => item.queueItemId === "manual-review-queue:lease-execution:lease-1");
    expect(executionQueueItem).toEqual(
      expect.objectContaining({
        title: "Lease execution blocked",
        destination: "/leases/lease-1/summary",
        contextLabel: "North Towers · 101 · John Smith",
      })
    );
  });

  it("keeps the generic lease fallback when no scoped lease id is available", () => {
    const fallbackSignal = {
      id: "lease-review:unscoped",
      category: "lease_lifecycle",
      severity: "warning",
      priorityGroup: "needs_review",
      title: "Lease review needed",
      description: "Review the lease workflow.",
      contextLabel: "Lease context review",
      destination: "/leases",
      source: "Lease operations",
      workflowStatus: "Review needed",
      reviewStatus: "Review needed",
      financialStatus: null,
      nextActionLabel: "Review lease execution",
      assignmentState: "unassigned",
      assignmentLabel: "Unassigned",
      escalationState: "not_escalated",
      escalationLabel: "Not escalated",
      timingState: "current",
      riskState: "review",
    } as const;

    expect(scopedSourceDestinationForSignal(fallbackSignal)).toBe("/leases");
    expect(deriveOperationalReviewQueueItems([fallbackSignal])[0]).toEqual(
      expect.objectContaining({
        destination: "/leases",
        contextLabel: "Lease context review",
      })
    );
  });

  it("normalizes raw decision context labels with operational lease and property references", () => {
    const signals = deriveCommandCenterSignals({
      decisions: [
        decision({
          id: "decision-lease",
          relatedEntity: { kind: "lease", id: "lease-1", label: "Lease jjua9wFKDV19d5y5sdV7" },
          destination: "/leases/lease-1/ledger",
        }),
        decision({
          id: "decision-property",
          type: "property",
          workflow: {
            queue: "general_review",
            workflowState: "new",
            ownershipType: "operations",
            reviewPriority: "medium",
            escalationLevel: "attention",
            manualOnly: true,
          },
          relatedEntity: { kind: "property", id: "property-1", label: "Property ZaeL9oqpJCSZPguWa6wR" },
          destination: "/properties?propertyId=property-1",
        }),
      ],
      leases: [lease()],
      properties: [
        {
          id: "property-1",
          name: "Center Suites",
          addressLine1: "2 Main",
          city: "Halifax",
          totalUnits: 1,
          units: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        } as any,
      ],
    });

    expect(signals.find((signal) => signal.id === "decision:decision-lease")?.contextLabel).toBe(
      "North Towers · 101 · John Smith"
    );
    expect(signals.find((signal) => signal.id === "decision:decision-property")?.contextLabel).toBe("Center Suites");
    expect(signals.map((signal) => signal.contextLabel).join(" ")).not.toContain("jjua9wFKDV19d5y5sdV7");
    expect(signals.map((signal) => signal.contextLabel).join(" ")).not.toContain("ZaeL9oqpJCSZPguWa6wR");
  });
});

describe("OperationalCommandCenterPage", () => {
  beforeEach(() => {
    mocks.fetchDecisionInbox.mockResolvedValue({
      items: [decision()],
      filters: { severity: [], status: [], type: [], queue: [], workflowState: [], escalationLevel: [] },
      summary: { total: 1, critical: 1, high: 0, open: 1, blocked: 0 },
      workflowSummary: { new: 1, underReview: 0, escalated: 0, critical: 1 },
      automationSummary: { total: 0, pending: 0, derived: 0, blocked: 0, completed: 0, escalationFlagged: 0, reviewRequired: 0 },
      agentActionSummary: { total: 0, suggested: 0, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 0, escalationSuggested: 0 },
    });
    mocks.fetchDashboardSummary.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 2,
        tenantsCount: 1,
        openActionsCount: 3,
        delinquentCount: 1,
        screeningsCount: 0,
      },
      rent: { month: "2026-06", collectedCents: 0, expectedCents: 0, delinquentCents: 0 },
      actions: [],
      properties: [],
      events: [],
    });
    mocks.getActiveLeasesForLandlord.mockResolvedValue({ leases: [lease()] });
    mocks.fetchProperties.mockResolvedValue({
      properties: [
        {
          id: "property-1",
          name: "North Towers",
          addressLine1: "1 Main",
          city: "Halifax",
          totalUnits: 2,
          units: [{ id: "unit-102", unitNumber: "102", rent: 1540, status: "vacant" }],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("renders a read-only operational coordination surface with source workflow links", async () => {
    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Operational command center" })).toBeInTheDocument();
    expect(screen.getByText(/does not execute actions, enforce legal timelines, or modify records/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.fetchDecisionInbox).toHaveBeenCalled();
      expect(mocks.getActiveLeasesForLandlord).toHaveBeenCalled();
      expect(mocks.fetchDashboardSummary).toHaveBeenCalled();
      expect(mocks.fetchProperties).toHaveBeenCalledWith({ status: "active" });
    });

    expect(screen.getAllByText("Payments / obligations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lease lifecycle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documents / workspace").length).toBeGreaterThan(0);
    expect(screen.getByTestId("operations-summary-strip")).toHaveStyle({
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 136px), 1fr))",
    });
    expect(screen.getByTestId("operations-coordination-lanes")).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    });
    expect(screen.getByText("Priority routing queue")).toBeInTheDocument();
    expect(screen.getByText(/Highest priority first by urgency, severity, and source workflow/i)).toBeInTheDocument();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Informational").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Context: North Towers · 101 · John Smith").length).toBeGreaterThan(0);
    expect(screen.getByText("Why: Lease is active but occupancy state conflicts.")).toBeInTheDocument();
    expect(screen.getByText("Workflow status: New")).toBeInTheDocument();
    expect(screen.getByText("Review status: Open")).toBeInTheDocument();
    expect(screen.getAllByText("Financial status: Review required").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Assignment: Operations owned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Escalation: Critical").length).toBeGreaterThan(0);
    expect(screen.getByText("Next action: Review payment evidence")).toBeInTheDocument();
    expect(screen.getAllByText("Review workspace readiness").length).toBeGreaterThan(0);
    expect(screen.getByTestId("operational-review-queue")).toBeInTheDocument();
    expect(screen.getByText("Operational review queue")).toBeInTheDocument();
    expect(screen.getByText(/does not create workspaces, route work automatically, or change source records/i)).toBeInTheDocument();
    expect(screen.getAllByText("Scoped evidence/resource links").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(1);
    expect(screen.getAllByText(/does not create a workspace, route work automatically, or change source records/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Payment Ledger Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delinquency or payment evidence review").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /create review workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/tenant-visible review/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/institutional sharing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/financial mutation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw provider/i)).not.toBeInTheDocument();
    expect(screen.getByText("Saved operational views")).toBeInTheDocument();
    expect(screen.getByTestId("operations-filter-panel")).toHaveStyle({
      display: "grid",
      minWidth: "0",
    });
    expect(screen.getByRole("button", { name: "All Operational" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "High Risk" })).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow type")).toBeInTheDocument();
    expect(screen.getByLabelText("Review status")).toBeInTheDocument();
    expect(screen.getByLabelText("Assignment state")).toBeInTheDocument();
    expect(screen.getByLabelText("Escalation state")).toBeInTheDocument();
    expect(screen.getByLabelText("Timing / risk")).toBeInTheDocument();
    expect(screen.queryByText(/Lease jjua9wFKDV19d5y5sdV7/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Property ZaeL9oqpJCSZPguWa6wR/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Open source workflow").length).toBeGreaterThan(0);
    expect(mocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ title: "Operational command center" }));
  });

  it("filters and searches visible operational items without changing priority sorting", async () => {
    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Lease ending soon").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Upcoming" }));
    expect(screen.queryByText("Review missing payment")).not.toBeInTheDocument();
    expect(screen.getAllByText("Lease ending soon").length).toBeGreaterThan(0);
    expect(screen.getByTestId("operational-review-queue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All operational" }));
    fireEvent.change(screen.getByLabelText("Search operational items"), { target: { value: "North Towers 101" } });
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0);
    expect(screen.queryByText("Vacant units visible")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search operational items"), { target: { value: "no matching workflow" } });
    expect(screen.getByText("No operational items match this triage view.")).toBeInTheDocument();
    expect(screen.getByText(/Current filters:/)).toBeInTheDocument();
  });

  it("supports combined triage facets while preserving search and reset behavior", async () => {
    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole("button", { name: "Delinquent" })[1]);
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0);
    expect(screen.queryByText("Vacant units visible")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Review status"), { target: { value: "open" } });
    fireEvent.change(screen.getByLabelText("Assignment state"), { target: { value: "unassigned" } });
    expect(screen.queryByText("Review missing payment")).not.toBeInTheDocument();
    expect(screen.getByText("No operational items match this triage view.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vacant units visible").length).toBeGreaterThan(0);
  });

  it("applies saved operational views without backend state changes", async () => {
    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "High Risk" }));
    expect(screen.getByRole("button", { name: "High Risk" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0);
    expect(screen.queryByText("Vacant units visible")).not.toBeInTheDocument();
    expect(screen.getByText(/Active view: Critical/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upcoming Deadlines" }));
    expect(screen.queryByText("Review missing payment")).not.toBeInTheDocument();
    expect(screen.getAllByText("Lease ending soon").length).toBeGreaterThan(0);
  });

  it("shows a safe empty state when no signals are visible", async () => {
    mocks.fetchDecisionInbox.mockResolvedValueOnce({
      items: [],
      filters: { severity: [], status: [], type: [], queue: [], workflowState: [], escalationLevel: [] },
      summary: { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
      workflowSummary: { new: 0, underReview: 0, escalated: 0, critical: 0 },
      automationSummary: { total: 0, pending: 0, derived: 0, blocked: 0, completed: 0, escalationFlagged: 0, reviewRequired: 0 },
      agentActionSummary: { total: 0, suggested: 0, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 0, escalationSuggested: 0 },
    });
    mocks.getActiveLeasesForLandlord.mockResolvedValueOnce({ leases: [] });
    mocks.fetchProperties.mockResolvedValueOnce({ properties: [] });

    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No high-signal operational issues are currently visible.")).toBeInTheDocument();
  });
});
