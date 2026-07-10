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
  fetchOperatorReviewManualMetadata: vi.fn(),
  updateOperatorReviewManualMetadata: vi.fn(),
  fetchProperties: vi.fn(),
  macShellProps: vi.fn(),
  useEntitlements: vi.fn(),
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

vi.mock("@/api/operatorReviewApi", async () => {
  const actual = await vi.importActual<any>("@/api/operatorReviewApi");
  return {
    ...actual,
    fetchOperatorReviewManualMetadata: mocks.fetchOperatorReviewManualMetadata,
    updateOperatorReviewManualMetadata: mocks.updateOperatorReviewManualMetadata,
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

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => mocks.useEntitlements(),
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ featureKey }: { featureKey: string }) => <div>Locked feature: {featureKey}</div>,
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
      nextActionLabel: "Open payment ledger",
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
        label: "Payment ledger source workflow",
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

  it("preserves review audit continuity from source signal into workspace preview and queue item metadata", () => {
    const signals = deriveCommandCenterSignals({
      decisions: [decision()],
      leases: [lease()],
      properties: [],
    });
    const sourceSignal = signals.find((signal) => signal.id === "decision:decision-1");

    expect(sourceSignal).toEqual(
      expect.objectContaining({
        id: "decision:decision-1",
        source: "Decision inbox · Delinquency Review",
        destination: "/leases/lease-1/ledger",
        contextLabel: "North Towers · 101 · John Smith",
        reviewStatus: "Open",
        assignmentLabel: "Operations owned",
        financialStatus: "Review required",
      })
    );

    const preview = reviewWorkspacePreviewForSignal(sourceSignal!);
    expect(preview).toEqual(
      expect.objectContaining({
        workspaceReference: "manual-review-preview:decision:decision-1",
        workspaceType: "payment_ledger_review",
        reviewStatus: "Open",
        reviewPriority: "Critical",
        routingReason: "Delinquency or payment evidence review",
        assignmentLabel: "Operations owned",
        manualOnly: true,
        autonomousActionsEnabled: false,
      })
    );
    expect(preview.evidenceLinks).toEqual([
      expect.objectContaining({
        label: "Payment ledger source workflow",
        destination: "/leases/lease-1/ledger",
        sensitivityClass: "sensitive",
      }),
    ]);
    expect(preview.relatedResources).toEqual([
      expect.objectContaining({
        label: "North Towers · 101 · John Smith",
        resourceType: "lease",
      }),
    ]);

    const queueItem = deriveOperationalReviewQueueItems(signals).find(
      (item) => item.queueItemId === "manual-review-queue:decision:decision-1"
    );
    expect(queueItem).toEqual(
      expect.objectContaining({
        title: "Review missing payment",
        sourceLabel: "Decision inbox · Delinquency Review",
        destination: "/leases/lease-1/ledger",
        routingReason: "Delinquency or payment evidence review",
        evidenceLabel: "Payment ledger source workflow",
        relatedResourceLabel: "North Towers · 101 · John Smith",
        reviewStatus: "Open",
        assignmentLabel: "Operations owned",
        manualOnly: true,
        autonomousActionsEnabled: false,
      })
    );
    expect(JSON.stringify({ preview, queueItem })).not.toContain("autoCreate");
    expect(JSON.stringify({ preview, queueItem })).not.toContain("autoAssign");
    expect(JSON.stringify({ preview, queueItem })).not.toContain("autoResolve");
    expect(JSON.stringify({ preview, queueItem })).not.toContain("tenantVisible");
    expect(JSON.stringify({ preview, queueItem })).not.toContain("financialMutation");
    expect(JSON.stringify({ preview, queueItem })).not.toContain("institutionalSharing");
    expect(JSON.stringify({ preview, queueItem })).not.toContain("rawPayload");
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

    const renewalTimingSignal = signals.find((signal) => signal.id === "lease-ending:lease-1");
    expect(renewalTimingSignal).toEqual(
      expect.objectContaining({
        destination: "/leases/lease-1/workflows/renewal",
        scopedLeaseId: "lease-1",
      })
    );
    expect(scopedSourceDestinationForSignal(renewalTimingSignal!)).toBe("/leases/lease-1/workflows/renewal");

    const renewalPolicySignal = signals.find((signal) => signal.id === "policy:lease-1:lease_renewal_review");
    expect(renewalPolicySignal).toEqual(
      expect.objectContaining({
        destination: "/leases/lease-1/workflows/renewal",
        scopedLeaseId: "lease-1",
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
    mocks.fetchDecisionInbox.mockReset();
    mocks.fetchDashboardSummary.mockReset();
    mocks.getActiveLeasesForLandlord.mockReset();
    mocks.fetchOperatorReviewManualMetadata.mockReset();
    mocks.updateOperatorReviewManualMetadata.mockReset();
    mocks.fetchProperties.mockReset();
    mocks.macShellProps.mockReset();
    mocks.useEntitlements.mockReset();
    mocks.useEntitlements.mockReturnValue({
      loading: false,
      hasCapability: (key: string) => key === "leases",
      requiredPlanFor: () => "starter",
    });
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
    mocks.fetchOperatorReviewManualMetadata.mockResolvedValue([]);
    mocks.updateOperatorReviewManualMetadata.mockImplementation(async (input: any) => ({
      manualMetadataId: `metadata:${input.scope}:${input.scopeId}`,
      landlordId: "landlord-1",
      scope: input.scope,
      scopeId: input.scopeId,
      reviewStatus: input.reviewStatus,
      assignmentTarget: input.assignmentTarget,
      manualOnly: true,
      systemGenerated: false,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    }));
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
    expect(screen.getByText("Operational inbox bridge")).toBeInTheDocument();
    expect(screen.getByText(/Review messages and source-linked actions tied to applications, leases, maintenance, payments, or work orders/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open operational inbox" })).toHaveAttribute("href", "/landlord/unified-inbox");
    expect(screen.getAllByRole("link", { name: "Open decision inbox" })[0]).toHaveAttribute("href", "/decision-inbox");

    await waitFor(() => {
      expect(mocks.fetchDecisionInbox).toHaveBeenCalled();
      expect(mocks.getActiveLeasesForLandlord).toHaveBeenCalled();
      expect(mocks.fetchDashboardSummary).toHaveBeenCalled();
      expect(mocks.fetchProperties).toHaveBeenCalledWith({ status: "active" });
    });

    expect(screen.getByTestId("operations-daily-summary")).toBeInTheDocument();
    expect(screen.getByText("Today's operational summary")).toBeInTheDocument();
    expect(screen.getByText("Urgent / overdue work")).toBeInTheDocument();
    expect(screen.getByText("Urgent / blocked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review urgent work:/i })).toHaveAttribute("href", "#operations-urgent-work");
    expect(screen.getByText("Needs landlord review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review landlord-owned items:/i })).toHaveAttribute("href", "#operations-review-queue");
    expect(screen.getByText("Evidence/source attached")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open evidence-ready items:/i })).toHaveAttribute("href", "#operations-evidence-ready");
    expect(screen.getByRole("link", { name: /Review upcoming deadlines:/i })).toHaveAttribute("href", "#operations-upcoming-work");
    expect(screen.getByTestId("operations-waiting-lanes")).toBeInTheDocument();
    expect(screen.getByText("Waiting lanes")).toBeInTheDocument();
    expect(screen.getByText("Waiting on tenant")).toBeInTheDocument();
    expect(screen.getByText("Waiting on landlord")).toBeInTheDocument();
    expect(screen.getByText("Waiting on contractor")).toBeInTheDocument();
    expect(screen.getByTestId("operations-waiting-lane-count-tenant")).toHaveStyle({
      whiteSpace: "nowrap",
      flex: "0 0 auto",
      minWidth: "max-content",
    });
    expect(screen.getByTestId("operations-work-buckets")).toBeInTheDocument();
    expect(screen.getByText("Main work buckets")).toBeInTheDocument();
    expect(screen.getByText("Maintenance and repairs")).toBeInTheDocument();
    expect(screen.getByText("Lease actions")).toBeInTheDocument();
    expect(screen.getByText("Notices and compliance")).toBeInTheDocument();
    expect(screen.getByText("Payments and arrears")).toBeInTheDocument();
    expect(screen.getByText("Tenant/application requests")).toBeInTheDocument();
    expect(screen.getByText("Contractor follow-ups")).toBeInTheDocument();
    expect(screen.getAllByText("Evidence-ready items").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Payments / obligations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lease lifecycle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documents / workspace").length).toBeGreaterThan(0);
    expect(screen.getByTestId("operations-coordination-lanes")).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    });
    expect(screen.getByText("Advanced triage queue")).toBeInTheDocument();
    expect(screen.getByText(/Search, saved views, and compact manual review controls/i)).toBeInTheDocument();
    expect(screen.getByText(/Showing 6 of 9 reviewable items/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all in review queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show detailed priority lists" })).toBeInTheDocument();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Informational").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("North Towers · 101 · John Smith").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Next: Open payment ledger").length).toBeGreaterThan(0);
    expect(screen.getByTestId("operational-review-queue")).toBeInTheDocument();
    expect(screen.getByText("Operational review queue")).toBeInTheDocument();
    expect(screen.getByText(/does not create workspaces, route work automatically, or change source records/i)).toBeInTheDocument();
    expect(screen.getAllByText("Details and manual controls").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Details and manual controls for Review missing payment/i }));
    expect(screen.getAllByText("Related resource context").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Payment Ledger Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delinquency or payment evidence review").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("/leases/lease-1/ledger");
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

  it("does not recreate a missing-payment review card when the decision inbox suppresses a paid ledger", async () => {
    mocks.fetchDecisionInbox.mockResolvedValueOnce({
      items: [],
      filters: { severity: [], status: [], type: [], queue: [], workflowState: [], escalationLevel: [] },
      summary: { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
      workflowSummary: { new: 0, underReview: 0, escalated: 0, critical: 0 },
      automationSummary: { total: 0, pending: 0, derived: 0, blocked: 0, completed: 0, escalationFlagged: 0, reviewRequired: 0 },
      agentActionSummary: { total: 0, suggested: 0, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 0, escalationSuggested: 0 },
    });
    mocks.getActiveLeasesForLandlord.mockResolvedValueOnce({
      leases: [
        lease({
          id: "76c2961b-eae5-4574-9f51-66096976b5dc",
          paymentReadiness: {
            readinessStatus: "ready_to_configure",
            readinessLabel: "Payment setup ready",
            readinessDescription: "Rent terms and payment setup are ready.",
            requiredNextAction: "none",
            rentTerms: {
              rentAmountAvailable: true,
              dueDateAvailable: true,
              leaseDatesAvailable: true,
              tenantLinked: true,
              leaseExecuted: true,
            },
            paymentSetup: {
              processorConnected: true,
              moneyMovementEnabled: true,
              storedPaymentMethod: true,
            },
          },
          stateCoherence: { ...lease().stateCoherence, flags: { ...lease().stateCoherence.flags, requiresReview: false, hasStateConflict: false } },
          leaseExecution: { ...lease().leaseExecution, executionStatus: "fully_executed" },
          signatureStatus: "signed",
          leasePdfStatus: "ready",
          jurisdictionPolicies: [],
          endDate: "2027-07-31",
        }),
      ],
    });

    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Operational command center" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchDecisionInbox).toHaveBeenCalled());

    expect(screen.queryByText("Payment Ledger Review")).not.toBeInTheDocument();
    expect(screen.queryByText(/Review Missing Payment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Decision inbox · Delinquency Review/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Financial status: Review required/i)).not.toBeInTheDocument();
  });

  it("keeps free-safe operations content visible when lease-driven signals are locked", async () => {
    mocks.useEntitlements.mockReturnValue({
      loading: false,
      hasCapability: () => false,
      requiredPlanFor: () => "starter",
    });

    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Operational command center" })).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.fetchDecisionInbox).toHaveBeenCalled();
      expect(mocks.fetchDashboardSummary).toHaveBeenCalled();
      expect(mocks.fetchProperties).toHaveBeenCalledWith({ status: "active" });
    });

    expect(mocks.getActiveLeasesForLandlord).not.toHaveBeenCalled();
    expect(screen.getAllByText("Locked feature: operations_signals").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Operational command center could not load/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Upgrade required/i)).not.toBeInTheDocument();
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

  it("rehydrates persisted manual review metadata for payment and non-payment operations cards", async () => {
    mocks.fetchOperatorReviewManualMetadata.mockResolvedValueOnce([
      {
        manualMetadataId: "metadata:decision:decision-1",
        landlordId: "landlord-1",
        scope: "decision",
        scopeId: "decision-1",
        reviewStatus: "in_review",
        assignmentTarget: "finance_reviewer",
        manualOnly: true,
        systemGenerated: false,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      },
      {
        manualMetadataId: "metadata:workflow:lease-coherence:lease-1",
        landlordId: "landlord-1",
        scope: "workflow",
        scopeId: "lease-coherence:lease-1",
        reviewStatus: "blocked",
        assignmentTarget: "property_manager",
        manualOnly: true,
        systemGenerated: false,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(mocks.fetchOperatorReviewManualMetadata).toHaveBeenCalled());

    expect(screen.getAllByText("Manual status: In review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Assigned reviewer: Finance reviewer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual status: Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Assigned reviewer: Property manager").length).toBeGreaterThan(0);
  });

  it("persists manual review status and assigned reviewer changes from Operations controls", async () => {
    render(
      <MemoryRouter>
        <OperationalCommandCenterPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText("Review missing payment").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /Details and manual controls for Review missing payment/i }));

    fireEvent.change(screen.getAllByLabelText("Review status for Review missing payment")[0], {
      target: { value: "in_review" },
    });
    fireEvent.change(screen.getAllByLabelText("Assigned reviewer for Review missing payment")[0], {
      target: { value: "finance_reviewer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm changes/i }));

    await waitFor(() =>
      expect(mocks.updateOperatorReviewManualMetadata).toHaveBeenCalledWith({
        scope: "decision",
        scopeId: "decision-1",
        reviewStatus: "in_review",
        assignmentTarget: "finance_reviewer",
      })
    );

    await waitFor(() => expect(screen.getAllByText("Manual status: In review").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Assigned reviewer: Finance reviewer").length).toBeGreaterThan(0);
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
