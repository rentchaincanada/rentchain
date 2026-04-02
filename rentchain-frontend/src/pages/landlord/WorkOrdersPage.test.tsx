import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkOrdersPage from "./WorkOrdersPage";

const mocks = vi.hoisted(() => ({
  listWorkOrders: vi.fn(),
  fetchProperties: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    canUseWorkOrders: false,
  }),
}));

vi.mock("../../api/workOrdersApi", () => ({
  addWorkOrderUpdate: vi.fn(),
  completeWorkOrder: vi.fn(),
  getContractorProfileById: vi.fn(),
  listWorkOrderUpdates: vi.fn(),
  listWorkOrders: mocks.listWorkOrders,
  patchWorkOrder: vi.fn(),
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
    mocks.listWorkOrders.mockReset();
    mocks.fetchProperties.mockReset();
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
});
