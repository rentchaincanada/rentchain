import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkOrdersPage from "./WorkOrdersPage";

const mocks = vi.hoisted(() => ({
  canUseWorkOrders: false,
  listWorkOrders: vi.fn(),
  listWorkOrderUpdates: vi.fn(),
  getWorkOrder: vi.fn(),
  patchWorkOrder: vi.fn(),
  approveWorkOrderResolution: vi.fn(),
  assignWorkOrderRework: vi.fn(),
  closeWorkOrderReworkDirectly: vi.fn(),
  confirmWorkOrderCompletion: vi.fn(),
  markWorkOrderFollowUpRequired: vi.fn(),
  linkWorkOrderCostToExpense: vi.fn(),
  reopenWorkOrder: vi.fn(),
  requestWorkOrderCostRevision: vi.fn(),
  reviewWorkOrderReworkResolution: vi.fn(),
  reviewWorkOrderCost: vi.fn(),
  rescheduleWorkOrderRework: vi.fn(),
  scheduleWorkOrderRework: vi.fn(),
  startWorkOrderRework: vi.fn(),
  submitLandlordWorkOrderCost: vi.fn(),
  uploadWorkOrderEvidence: vi.fn(),
  uploadWorkOrderCostAttachment: vi.fn(),
  updateWorkOrderEvidence: vi.fn(),
  addWorkOrderUpdate: vi.fn(),
  getContractorProfileById: vi.fn(),
  fetchProperties: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    canUseWorkOrders: mocks.canUseWorkOrders,
  }),
}));

vi.mock("../../api/workOrdersApi", () => ({
  addWorkOrderUpdate: mocks.addWorkOrderUpdate,
  approveWorkOrderResolution: mocks.approveWorkOrderResolution,
  assignWorkOrderRework: mocks.assignWorkOrderRework,
  closeWorkOrderReworkDirectly: mocks.closeWorkOrderReworkDirectly,
  completeWorkOrder: vi.fn(),
  confirmWorkOrderCompletion: mocks.confirmWorkOrderCompletion,
  getContractorProfileById: mocks.getContractorProfileById,
  getWorkOrder: mocks.getWorkOrder,
  linkWorkOrderCostToExpense: mocks.linkWorkOrderCostToExpense,
  listWorkOrderUpdates: mocks.listWorkOrderUpdates,
  listWorkOrders: mocks.listWorkOrders,
  markWorkOrderFollowUpRequired: mocks.markWorkOrderFollowUpRequired,
  patchWorkOrder: mocks.patchWorkOrder,
  requestWorkOrderCostRevision: mocks.requestWorkOrderCostRevision,
  reopenWorkOrder: mocks.reopenWorkOrder,
  reviewWorkOrderReworkResolution: mocks.reviewWorkOrderReworkResolution,
  reviewWorkOrderCost: mocks.reviewWorkOrderCost,
  rescheduleWorkOrderRework: mocks.rescheduleWorkOrderRework,
  scheduleWorkOrderRework: mocks.scheduleWorkOrderRework,
  startWorkOrderRework: mocks.startWorkOrderRework,
  submitLandlordWorkOrderCost: mocks.submitLandlordWorkOrderCost,
  updateWorkOrderEvidence: mocks.updateWorkOrderEvidence,
  uploadWorkOrderCostAttachment: mocks.uploadWorkOrderCostAttachment,
  uploadWorkOrderEvidence: mocks.uploadWorkOrderEvidence,
}));

vi.mock("../../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchProperties,
}));

vi.mock("../../components/expenses/AddExpenseModal", () => ({
  AddExpenseModal: () => null,
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ title, description }: { title: string; description: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

describe("WorkOrdersPage", () => {
  beforeEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    mocks.canUseWorkOrders = false;
    mocks.listWorkOrders.mockReset();
    mocks.listWorkOrderUpdates.mockReset();
    mocks.getWorkOrder.mockReset();
    mocks.patchWorkOrder.mockReset();
    mocks.approveWorkOrderResolution.mockReset();
    mocks.assignWorkOrderRework.mockReset();
    mocks.closeWorkOrderReworkDirectly.mockReset();
    mocks.confirmWorkOrderCompletion.mockReset();
    mocks.markWorkOrderFollowUpRequired.mockReset();
    mocks.linkWorkOrderCostToExpense.mockReset();
    mocks.reopenWorkOrder.mockReset();
    mocks.requestWorkOrderCostRevision.mockReset();
    mocks.reviewWorkOrderReworkResolution.mockReset();
    mocks.reviewWorkOrderCost.mockReset();
    mocks.rescheduleWorkOrderRework.mockReset();
    mocks.scheduleWorkOrderRework.mockReset();
    mocks.startWorkOrderRework.mockReset();
    mocks.submitLandlordWorkOrderCost.mockReset();
    mocks.uploadWorkOrderEvidence.mockReset();
    mocks.uploadWorkOrderCostAttachment.mockReset();
    mocks.updateWorkOrderEvidence.mockReset();
    mocks.addWorkOrderUpdate.mockReset();
    mocks.getContractorProfileById.mockReset();
    mocks.fetchProperties.mockReset();
    mocks.fetchProperties.mockResolvedValue({ items: [] });
  });

  it("renders the locked free-tier state without crashing", async () => {
    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Work orders start on Starter")).toBeInTheDocument();
    });

    expect(mocks.listWorkOrders).not.toHaveBeenCalled();
  });

  it("shows execution details and lets the landlord confirm and reopen completion", async () => {
    mocks.canUseWorkOrders = true;
    mocks.listWorkOrders.mockResolvedValue([
      {
        id: "wo-1",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        title: "Broken heater",
        description: "Restore heat in unit 3A",
        category: "HVAC",
        priority: "urgent",
        status: "completed",
        visibility: "private",
        budgetMinCents: null,
        budgetMaxCents: null,
        assignedContractorId: "contractor-1",
        invitedContractorIds: [],
        acceptedAtMs: 10,
        startedAtMs: 20,
        completedAtMs: 30,
        scheduledFor: 15,
        serviceStartedAt: 20,
        serviceCompletedAt: 30,
        completionSummary: "Replaced igniter and restored heat.",
        completionOutcome: "completed",
        completedByActorRole: "contractor",
        notifications: {
          landlord: {
            requiresReview: true,
            requiresReschedule: false,
            lastNotifiedAt: 39,
          },
        },
        completionConfirmedByLandlordAt: null,
        completionConfirmedByLandlordBy: null,
        reopenedAt: null,
        reopenedByActorId: null,
        reopenedByActorRole: null,
        reopenReason: null,
        executionBlockedReason: null,
        notesInternal: "",
        linkedExpenseId: null,
        createdAtMs: 1,
        updatedAtMs: 35,
      },
    ]);
    mocks.listWorkOrderUpdates.mockResolvedValue([
      {
        id: "upd-1",
        workOrderId: "wo-1",
        actorRole: "contractor",
        actorId: "contractor-1",
        updateType: "completed",
        message: "Work order marked completed",
        attachmentUrl: null,
        createdAtMs: 30,
      },
    ]);
    mocks.getWorkOrder.mockResolvedValue({
      id: "wo-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Broken heater",
      description: "Restore heat in unit 3A",
      category: "HVAC",
      priority: "urgent",
      status: "completed",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: "contractor-1",
      invitedContractorIds: [],
      acceptedAtMs: 10,
      startedAtMs: 20,
      completedAtMs: 30,
      scheduledFor: 15,
      serviceStartedAt: 20,
      serviceCompletedAt: 30,
      completionSummary: "Replaced igniter and restored heat.",
      completionOutcome: "completed",
      completedByActorRole: "contractor",
      completionConfirmedByLandlordAt: 40,
      completionConfirmedByLandlordBy: "landlord-1",
      resolutionStatus: "completed_pending_review",
      notifications: {
        landlord: {
          requiresReview: true,
          requiresReschedule: false,
          lastNotifiedAt: 39,
        },
      },
      landlordApprovedAt: null,
      tenantSignoffStatus: null,
      followUpRequired: false,
      followUpReason: null,
      finalResolvedAt: null,
      reopenedAt: null,
      reopenedByActorId: null,
      reopenedByActorRole: null,
      reopenReason: null,
      executionBlockedReason: null,
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 40,
    });
    mocks.approveWorkOrderResolution.mockResolvedValue({ ok: true });
    mocks.confirmWorkOrderCompletion.mockResolvedValue({ ok: true });
    mocks.markWorkOrderFollowUpRequired.mockResolvedValue({ ok: true });
    mocks.reopenWorkOrder.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));

    expect(await screen.findByText(/Execution and completion/i)).toBeInTheDocument();
    expect(await screen.findByText(/Action required/i)).toBeInTheDocument();
    expect(screen.getByText(/Review completed rework/i)).toBeInTheDocument();
    expect(screen.getByText(/Replaced igniter and restored heat/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm completion/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve resolution/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm completion/i }));

    await waitFor(() => {
      expect(mocks.confirmWorkOrderCompletion).toHaveBeenCalledWith("wo-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /approve resolution/i }));

    await waitFor(() => {
      expect(mocks.approveWorkOrderResolution).toHaveBeenCalledWith("wo-1");
    });

    fireEvent.change(screen.getByPlaceholderText(/Explain why this work still needs follow-up/i), {
      target: { value: "Heat is still uneven near the bedroom wall." },
    });
    fireEvent.click(screen.getByRole("button", { name: /mark follow-up required/i }));

    await waitFor(() => {
      expect(mocks.markWorkOrderFollowUpRequired).toHaveBeenCalledWith("wo-1", {
        reason: "Heat is still uneven near the bedroom wall.",
      });
    });

    fireEvent.change(screen.getByPlaceholderText(/Explain why this work order needs follow-up/i), {
      target: { value: "Heat output is still inconsistent." },
    });
    fireEvent.click(screen.getByRole("button", { name: /reopen blocked/i }));

    await waitFor(() => {
      expect(mocks.reopenWorkOrder).toHaveBeenCalledWith("wo-1", {
        reason: "Heat output is still inconsistent.",
        status: "blocked",
      });
    });
  });

  it("renders the cost panel and lets the landlord save and review cost details", async () => {
    mocks.canUseWorkOrders = true;
    const item = {
      id: "wo-cost",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Boiler tune-up",
      description: "Seasonal boiler service",
      category: "HVAC",
      priority: "medium",
      status: "completed",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: null,
      invitedContractorIds: [],
      acceptedAtMs: 10,
      startedAtMs: 20,
      completedAtMs: 30,
      serviceCompletedAt: 30,
      completionSummary: "Completed annual tune-up.",
      completionOutcome: "completed",
      completionConfirmedByLandlordAt: 31,
      completionConfirmedByLandlordBy: "landlord-1",
      cost: {
        actualCostCents: 24500,
        currency: "CAD",
        submittedByRole: "contractor",
        submittedById: "contractor-1",
        submittedAt: 32,
        reviewStatus: "pending_review",
        latestRevisionNumber: 1,
      },
      costLineItems: [{ id: "line-1", label: "Labor", amountCents: 24500, category: "labor" }],
      costAttachments: [],
      costReviewHistory: [
        {
          id: "history-1",
          revisionNumber: 1,
          submittedAt: 32,
          submittedByRole: "contractor",
          submittedById: "contractor-1",
          actualCostCents: 24500,
          currency: "CAD",
          reviewStatus: "pending_review",
          reviewNote: null,
        },
      ],
      expenseLink: { status: "not_linked", expenseId: null },
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 35,
    };
    mocks.listWorkOrders.mockResolvedValue([item]);
    mocks.listWorkOrderUpdates.mockResolvedValue([]);
    mocks.getWorkOrder.mockResolvedValue(item);
    mocks.submitLandlordWorkOrderCost.mockResolvedValue(item);
    mocks.reviewWorkOrderCost.mockResolvedValue({
      ...item,
      cost: { ...item.cost, reviewStatus: "approved", reviewNote: "Looks good" },
    });

    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));

    expect(await screen.findByText(/Cost & Invoice/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Actual cost/i), { target: { value: "245.00" } });
    fireEvent.change(screen.getByLabelText(/Cost line items/i), {
      target: { value: '[{"label":"Labor","amountCents":24500,"category":"labor"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save cost/i }));

    await waitFor(() => {
      expect(mocks.submitLandlordWorkOrderCost).toHaveBeenCalledWith(
        "wo-cost",
        expect.objectContaining({
          actualCostCents: 24500,
        })
      );
    });

    fireEvent.change(screen.getByLabelText(/Cost review note/i), { target: { value: "Looks good" } });
    fireEvent.click(screen.getByRole("button", { name: /Approve cost/i }));

    await waitFor(() => {
      expect(mocks.reviewWorkOrderCost).toHaveBeenCalledWith("wo-cost", {
        decision: "approve",
        note: "Looks good",
      });
    });

    expect(screen.getAllByText(/Revision #/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cost review history/i)).toBeInTheDocument();
  });

  it("lets the landlord request a cost revision", async () => {
    mocks.canUseWorkOrders = true;
    const item = {
      id: "wo-cost-link",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Water heater repair",
      description: "Replace failed thermostat.",
      category: "Maintenance",
      priority: "high",
      status: "completed",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: "contractor-1",
      invitedContractorIds: [],
      statusHistory: [],
      cost: {
        actualCostCents: 32000,
        currency: "CAD",
        submittedByRole: "contractor",
        submittedById: "contractor-1",
        submittedAt: 700,
        reviewStatus: "pending_review",
        latestRevisionNumber: 2,
        linkedExpenseStatus: "not_linked",
      },
      costReviewHistory: [
        {
          id: "history-2",
          revisionNumber: 2,
          submittedAt: 700,
          submittedByRole: "contractor",
          submittedById: "contractor-1",
          actualCostCents: 32000,
          currency: "CAD",
          reviewStatus: "pending_review",
          reviewNote: null,
        },
      ],
      costLineItems: [],
      costAttachments: [],
      expenseLink: { status: "not_linked", expenseId: null },
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 35,
    };
    mocks.listWorkOrders.mockResolvedValue([item]);
    mocks.listWorkOrderUpdates.mockResolvedValue([]);
    mocks.getWorkOrder.mockResolvedValue(item);
    mocks.requestWorkOrderCostRevision.mockResolvedValue({
      ...item,
      cost: {
        ...item.cost,
        reviewStatus: "revision_requested",
        reviewNote: "Please break out labor and materials separately.",
      },
    });

    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));
    fireEvent.change(screen.getByLabelText(/Cost review note/i), {
      target: { value: "Please break out labor and materials separately." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request revision/i }));

    await waitFor(() => {
      expect(mocks.requestWorkOrderCostRevision).toHaveBeenCalledWith("wo-cost-link", {
        note: "Please break out labor and materials separately.",
      });
    });
  });

  it("shows expense linkage for approved cost and lets the landlord link it", async () => {
    mocks.canUseWorkOrders = true;
    const item = {
      id: "wo-cost-link-approved",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Water heater repair",
      description: "Replace failed thermostat.",
      category: "Maintenance",
      priority: "high",
      status: "completed",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: "contractor-1",
      invitedContractorIds: [],
      statusHistory: [],
      cost: {
        actualCostCents: 32000,
        currency: "CAD",
        submittedByRole: "contractor",
        submittedById: "contractor-1",
        submittedAt: 700,
        reviewStatus: "approved",
        latestRevisionNumber: 2,
        linkedExpenseStatus: "not_linked",
      },
      costReviewHistory: [],
      costLineItems: [],
      costAttachments: [],
      expenseLink: { status: "not_linked", expenseId: null },
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 35,
    };
    mocks.listWorkOrders.mockResolvedValue([item]);
    mocks.listWorkOrderUpdates.mockResolvedValue([]);
    mocks.getWorkOrder.mockResolvedValue(item);
    mocks.linkWorkOrderCostToExpense.mockResolvedValue({
      ...item,
      cost: {
        ...item.cost,
        linkedExpenseStatus: "linked",
        linkedExpenseId: "expense-1",
      },
      linkedExpenseId: "expense-1",
      expenseLink: { status: "linked", expenseId: "expense-1", linkedAt: 900, linkedBy: "landlord-1" },
    });

    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));

    fireEvent.click(screen.getByRole("button", { name: /Link to expense/i }));

    await waitFor(() => {
      expect(mocks.linkWorkOrderCostToExpense).toHaveBeenCalledWith("wo-cost-link-approved");
    });
  });

  it("uploads evidence and lets the landlord mark it tenant-safe", async () => {
    mocks.canUseWorkOrders = true;
    const baseItem = {
      id: "wo-2",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Hallway repaint",
      description: "Repaint the hallway after drywall patching.",
      category: "Painting",
      priority: "medium",
      status: "in_progress",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: "contractor-1",
      invitedContractorIds: [],
      acceptedAtMs: 10,
      startedAtMs: 20,
      completedAtMs: null,
      scheduledFor: 15,
      serviceStartedAt: 20,
      serviceCompletedAt: null,
      completionSummary: null,
      completionOutcome: null,
      completedByActorRole: null,
      completionConfirmedByLandlordAt: null,
      completionConfirmedByLandlordBy: null,
      reopenedAt: null,
      reopenedByActorId: null,
      reopenedByActorRole: null,
      reopenReason: null,
      executionBlockedReason: null,
      evidence: [
        {
          id: "evidence-1",
          url: "https://example.com/evidence-1.jpg",
          filename: "before.jpg",
          contentType: "image/jpeg",
          uploadedAt: 35,
          uploadedByActorRole: "contractor",
          uploadedByActorId: "contractor-1",
          evidenceType: "before",
          caption: "Before repainting",
          visibility: "landlord_contractor",
        },
      ],
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 35,
    };
    mocks.listWorkOrders.mockResolvedValue([baseItem]);
    mocks.listWorkOrderUpdates.mockResolvedValue([]);
    mocks.uploadWorkOrderEvidence.mockResolvedValue({
      ...baseItem,
      evidence: [
        ...baseItem.evidence,
        {
          id: "evidence-2",
          url: "https://example.com/evidence-2.jpg",
          filename: "after.jpg",
          contentType: "image/jpeg",
          uploadedAt: 40,
          uploadedByActorRole: "landlord",
          uploadedByActorId: "landlord-1",
          evidenceType: "completion",
          caption: "Final walkthrough",
          visibility: "internal",
        },
      ],
    });
    mocks.updateWorkOrderEvidence.mockResolvedValue({
      ...baseItem,
      evidence: [
        {
          ...baseItem.evidence[0],
          visibility: "tenant_safe",
        },
      ],
    });

    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));

    fireEvent.change(screen.getByLabelText(/Evidence file/i), {
      target: {
        files: [new File(["photo"], "after.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.change(screen.getByLabelText(/^Evidence type$/i), { target: { value: "completion" } });
    fireEvent.change(screen.getByLabelText(/Evidence visibility/i), { target: { value: "internal" } });
    fireEvent.change(screen.getByLabelText(/Evidence caption/i), { target: { value: "Final walkthrough" } });
    fireEvent.click(screen.getByRole("button", { name: /Upload evidence/i }));

    await waitFor(() => {
      expect(mocks.uploadWorkOrderEvidence).toHaveBeenCalledWith(
        "wo-2",
        expect.objectContaining({
          evidenceType: "completion",
          caption: "Final walkthrough",
          visibility: "internal",
        })
      );
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Mark tenant-safe/i })[0]);

    await waitFor(() => {
      expect(mocks.updateWorkOrderEvidence).toHaveBeenCalledWith("wo-2", "evidence-1", {
        visibility: "tenant_safe",
      });
    });
  });

  it("renders the rework workflow and lets the landlord review a completed second-pass visit", async () => {
    mocks.canUseWorkOrders = true;
    mocks.listWorkOrders.mockResolvedValue([
      {
        id: "wo-rework",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        title: "Return visit for heater",
        description: "Second pass needed to balance airflow.",
        category: "HVAC",
        priority: "high",
        status: "completed",
        visibility: "private",
        budgetMinCents: null,
        budgetMaxCents: null,
        assignedContractorId: "contractor-1",
        invitedContractorIds: [],
        acceptedAtMs: 10,
        startedAtMs: 20,
        completedAtMs: 30,
        resolutionStatus: "completed_pending_review",
        followUpRequired: false,
        followUpReason: null,
        reworkCycle: {
          cycleNumber: 1,
          status: "completed",
          createdAt: 40,
          createdBy: "landlord-1",
          assignedContractorId: "contractor-2",
          assignedAt: 41,
          completedAt: 60,
          completionSummary: "Adjusted vents and rebalanced output.",
        },
        reworkReview: {
          status: "pending_review",
          reviewedAt: null,
          tenantSignoffStatus: null,
          tenantSignedOffAt: null,
          tenantDeclinedAt: null,
          tenantDeclineReason: null,
          closureOutcome: null,
          closedAt: null,
        },
        reworkHistory: [],
        notesInternal: "",
        linkedExpenseId: null,
        createdAtMs: 1,
        updatedAtMs: 35,
      },
    ]);
    mocks.listWorkOrderUpdates.mockResolvedValue([]);
    mocks.getWorkOrder.mockResolvedValueOnce({
      id: "wo-rework",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Return visit for heater",
      description: "Second pass needed to balance airflow.",
      category: "HVAC",
      priority: "high",
      status: "completed",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: "contractor-2",
      invitedContractorIds: [],
      acceptedAtMs: 10,
      startedAtMs: 20,
      completedAtMs: 30,
      resolutionStatus: "completed_pending_review",
      followUpRequired: false,
      reworkCycle: {
        cycleNumber: 1,
        status: "completed",
        createdAt: 40,
        createdBy: "landlord-1",
        assignedContractorId: "contractor-2",
        assignedAt: 41,
        completedAt: 60,
        completionSummary: "Adjusted vents and rebalanced output.",
      },
      reworkReview: {
        status: "pending_review",
        reviewedAt: null,
        tenantSignoffStatus: null,
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        closureOutcome: null,
        closedAt: null,
      },
      reworkHistory: [],
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 60,
    });
    mocks.reviewWorkOrderReworkResolution.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));
    expect((await screen.findAllByText(/Rework cycle/i)).length).toBeGreaterThan(0);

    fireEvent.change(await screen.findByPlaceholderText(/Add a landlord review note for this second-pass visit/i), {
      target: { value: "Follow-up complete after vent balancing." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Approve rework resolution/i }));

    await waitFor(() => {
      expect(mocks.reviewWorkOrderReworkResolution).toHaveBeenCalledWith("wo-rework", {
        decision: "approve",
        note: "Follow-up complete after vent balancing.",
      });
    });
  });

  it("lets the landlord schedule and reschedule a return visit for rework", async () => {
    mocks.canUseWorkOrders = true;
    mocks.listWorkOrders.mockResolvedValue([
      {
        id: "wo-rework",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        title: "Return visit for heater",
        description: "Second pass needed to balance airflow.",
        category: "HVAC",
        priority: "high",
        status: "assigned",
        visibility: "private",
        budgetMinCents: null,
        budgetMaxCents: null,
        assignedContractorId: "contractor-1",
        invitedContractorIds: [],
        acceptedAtMs: 10,
        startedAtMs: null,
        completedAtMs: 30,
        resolutionStatus: "completed_pending_review",
        followUpRequired: false,
        reworkCycle: {
          cycleNumber: 1,
          status: "assigned",
          createdAt: 40,
          createdBy: "landlord-1",
          assignedContractorId: "contractor-1",
          assignedAt: 41,
          schedule: {
            scheduledFor: Date.UTC(2026, 4, 3, 14, 0),
            timeWindowStart: null,
            timeWindowEnd: null,
            status: "tenant_pending",
            requiresTenantAccess: true,
            tenantAccessStatus: "pending",
            contractorScheduleStatus: "pending",
            scheduledBy: "landlord-1",
            scheduledAt: 45,
            rescheduleReason: null,
            lastUpdatedAt: 45,
          },
        },
        notesInternal: "",
        linkedExpenseId: null,
        createdAtMs: 1,
        updatedAtMs: 41,
      },
    ]);
    mocks.listWorkOrderUpdates.mockResolvedValue([]);
    mocks.getWorkOrder.mockResolvedValueOnce({
      id: "wo-rework",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Return visit for heater",
      description: "Second pass needed to balance airflow.",
      category: "HVAC",
      priority: "high",
      status: "assigned",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: "contractor-1",
      invitedContractorIds: [],
      acceptedAtMs: 10,
      startedAtMs: null,
      completedAtMs: 30,
      resolutionStatus: "completed_pending_review",
      followUpRequired: false,
      reworkCycle: {
        cycleNumber: 1,
        status: "assigned",
        createdAt: 40,
        createdBy: "landlord-1",
        assignedContractorId: "contractor-1",
        assignedAt: 41,
        schedule: {
          scheduledFor: Date.UTC(2026, 4, 3, 14, 0),
          timeWindowStart: null,
          timeWindowEnd: null,
          status: "tenant_pending",
          requiresTenantAccess: true,
          tenantAccessStatus: "pending",
          contractorScheduleStatus: "pending",
          scheduledBy: "landlord-1",
          scheduledAt: 45,
          rescheduleReason: null,
          lastUpdatedAt: 45,
        },
      },
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 41,
    });
    mocks.getWorkOrder.mockResolvedValueOnce({
      id: "wo-rework",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Return visit for heater",
      description: "Second pass needed to balance airflow.",
      category: "HVAC",
      priority: "high",
      status: "assigned",
      visibility: "private",
      budgetMinCents: null,
      budgetMaxCents: null,
      assignedContractorId: "contractor-1",
      invitedContractorIds: [],
      acceptedAtMs: 10,
      startedAtMs: null,
      completedAtMs: 30,
      resolutionStatus: "completed_pending_review",
      followUpRequired: false,
      reworkCycle: {
        cycleNumber: 1,
        status: "assigned",
        createdAt: 40,
        createdBy: "landlord-1",
        assignedContractorId: "contractor-1",
        assignedAt: 41,
        schedule: {
          scheduledFor: Date.UTC(2026, 4, 4, 14, 0),
          timeWindowStart: null,
          timeWindowEnd: null,
          status: "tenant_pending",
          requiresTenantAccess: true,
          tenantAccessStatus: "pending",
          contractorScheduleStatus: "pending",
          scheduledBy: "landlord-1",
          scheduledAt: 50,
          rescheduleReason: null,
          lastUpdatedAt: 50,
        },
      },
      notesInternal: "",
      linkedExpenseId: null,
      createdAtMs: 1,
      updatedAtMs: 50,
    });
    mocks.scheduleWorkOrderRework.mockResolvedValue({ ok: true });
    mocks.rescheduleWorkOrderRework.mockResolvedValue({ ok: true });

    const { container } = render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));

    const scheduledInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement | null;
    expect(scheduledInput).not.toBeNull();
    fireEvent.change(scheduledInput!, {
      target: { value: "2026-05-04T14:00" },
    });
    fireEvent.click(screen.getByLabelText(/Require tenant access confirmation/i));
    fireEvent.click(screen.getByRole("button", { name: /^Schedule return visit$/i }));

    await waitFor(() => {
      expect(mocks.scheduleWorkOrderRework).toHaveBeenCalledWith("wo-rework", {
        scheduledFor: expect.any(Number),
        timeWindowStart: undefined,
        timeWindowEnd: undefined,
        requiresTenantAccess: false,
      });
    });

    expect(screen.getByRole("button", { name: /^Reschedule return visit$/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Reason for rescheduling this return visit/i), {
      target: { value: "Tenant asked for the next afternoon." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Reschedule return visit$/i }));

    await waitFor(() => {
      expect(mocks.rescheduleWorkOrderRework).toHaveBeenCalledWith("wo-rework", {
        scheduledFor: expect.any(Number),
        timeWindowStart: undefined,
        timeWindowEnd: undefined,
        requiresTenantAccess: true,
        reason: "Tenant asked for the next afternoon.",
      });
    });
  });
});
