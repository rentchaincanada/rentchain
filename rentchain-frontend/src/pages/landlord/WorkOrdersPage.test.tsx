import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkOrdersPage from "./WorkOrdersPage";

const mocks = vi.hoisted(() => ({
  canUseWorkOrders: false,
  listWorkOrders: vi.fn(),
  listWorkOrderUpdates: vi.fn(),
  getWorkOrder: vi.fn(),
  patchWorkOrder: vi.fn(),
  confirmWorkOrderCompletion: vi.fn(),
  reopenWorkOrder: vi.fn(),
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
  completeWorkOrder: vi.fn(),
  confirmWorkOrderCompletion: mocks.confirmWorkOrderCompletion,
  getContractorProfileById: mocks.getContractorProfileById,
  getWorkOrder: mocks.getWorkOrder,
  listWorkOrderUpdates: mocks.listWorkOrderUpdates,
  listWorkOrders: mocks.listWorkOrders,
  patchWorkOrder: mocks.patchWorkOrder,
  reopenWorkOrder: mocks.reopenWorkOrder,
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
    mocks.confirmWorkOrderCompletion.mockReset();
    mocks.reopenWorkOrder.mockReset();
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
    mocks.confirmWorkOrderCompletion.mockResolvedValue({ ok: true });
    mocks.reopenWorkOrder.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <WorkOrdersPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /timeline/i }));

    expect(await screen.findByText(/Execution and completion/i)).toBeInTheDocument();
    expect(screen.getByText(/Replaced igniter and restored heat/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm completion/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm completion/i }));

    await waitFor(() => {
      expect(mocks.confirmWorkOrderCompletion).toHaveBeenCalledWith("wo-1");
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
});
