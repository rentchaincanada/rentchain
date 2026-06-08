import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkOrderNewPage from "./WorkOrderNewPage";

const mocks = vi.hoisted(() => ({
  createWorkOrder: vi.fn(),
  fetchProperties: vi.fn(),
  fetchUnitsForProperty: vi.fn(),
  listContractorInvites: vi.fn(),
  navigate: vi.fn(),
  track: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchProperties,
}));

vi.mock("../../api/unitsApi", () => ({
  fetchUnitsForProperty: mocks.fetchUnitsForProperty,
}));

vi.mock("../../api/workOrdersApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/workOrdersApi")>("../../api/workOrdersApi");
  return {
    ...actual,
    createWorkOrder: mocks.createWorkOrder,
    listContractorInvites: mocks.listContractorInvites,
  };
});

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord-1", role: "landlord", plan: "starter" },
  }),
}));

vi.mock("../../lib/analytics", () => ({
  track: (...args: unknown[]) => mocks.track(...args),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/work-orders/new"]}>
      <Routes>
        <Route path="/work-orders/new" element={<WorkOrderNewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkOrderNewPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.fetchProperties.mockResolvedValue({
      items: [
        { propertyId: "property-safe-1", address: "Harbour View" },
        { id: "property-safe-2", name: "North Point" },
      ],
    });
    mocks.fetchUnitsForProperty.mockImplementation(async (propertyId: string) => {
      if (propertyId === "property-safe-1") {
        return [{ unitId: "unit-1", unitNumber: "101" }];
      }
      if (propertyId === "property-safe-2") {
        return [{ id: "unit-2", unitNumber: "202" }];
      }
      return [];
    });
    mocks.listContractorInvites.mockResolvedValue([]);
    mocks.createWorkOrder.mockResolvedValue({
      id: "work-order-1",
      propertyId: "property-safe-2",
    });
  });

  it("populates the property dropdown from id and propertyId response shapes", async () => {
    renderPage();

    const propertySelect = await screen.findByLabelText("Property");

    await waitFor(() => {
      expect(propertySelect).toHaveValue("property-safe-1");
    });
    expect(screen.getByRole("option", { name: "Harbour View" })).toHaveValue("property-safe-1");
    expect(screen.getByRole("option", { name: "North Point" })).toHaveValue("property-safe-2");
    expect(mocks.fetchUnitsForProperty).toHaveBeenCalledWith("property-safe-1");
  });

  it("syncs selected property state, clears stale units, and submits the selected propertyId", async () => {
    renderPage();

    const propertySelect = await screen.findByLabelText("Property");
    expect(await screen.findByRole("option", { name: "101" })).toBeInTheDocument();

    fireEvent.change(propertySelect, { target: { value: "property-safe-2" } });

    await waitFor(() => {
      expect(propertySelect).toHaveValue("property-safe-2");
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "202" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("option", { name: "101" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Repair kitchen sink" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Water is leaking under the basin." } });
    fireEvent.click(screen.getByRole("button", { name: "Create Work Order" }));

    await waitFor(() => {
      expect(mocks.createWorkOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: "property-safe-2",
          unitId: null,
          title: "Repair kitchen sink",
          description: "Water is leaking under the basin.",
        })
      );
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/work-orders");
  });
});
