import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MaintenanceRequestsPage from "./MaintenanceRequestsPage";

const maintenanceWorkflowApi = vi.hoisted(() => ({
  listLandlordMaintenance: vi.fn(),
  patchLandlordMaintenance: vi.fn(),
  assignLandlordMaintenance: vi.fn(),
}));

const workOrdersApi = vi.hoisted(() => ({
  listContractorInvites: vi.fn(),
  getContractorProfileById: vi.fn(),
}));

const showToast = vi.fn();

vi.mock("../api/maintenanceWorkflowApi", async () => {
  const actual = await vi.importActual<any>("../api/maintenanceWorkflowApi");
  return {
    ...actual,
    listLandlordMaintenance: maintenanceWorkflowApi.listLandlordMaintenance,
    patchLandlordMaintenance: maintenanceWorkflowApi.patchLandlordMaintenance,
    assignLandlordMaintenance: maintenanceWorkflowApi.assignLandlordMaintenance,
  };
});

vi.mock("../api/workOrdersApi", () => workOrdersApi);
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

describe("landlord maintenance workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    maintenanceWorkflowApi.listLandlordMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          tenantName: "Taylor Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          title: "Broken heater",
          description: "Heat is not turning on.",
          category: "HVAC",
          priority: "urgent",
          status: "submitted",
          assignedContractorName: null,
          serviceWindowStartAt: null,
          serviceWindowEndAt: null,
          accessRequired: null,
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [
            {
              status: "submitted",
              actorRole: "tenant",
              message: "Submitted through tenant workspace.",
              createdAt: 100,
            },
          ],
        },
      ],
    });
    workOrdersApi.listContractorInvites.mockResolvedValue([]);
  });

  it("renders the landlord maintenance workspace with lifecycle guidance", async () => {
    render(
      <MemoryRouter initialEntries={["/maintenance/maint-1"]}>
        <Routes>
          <Route path="/maintenance/:id" element={<MaintenanceRequestsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Maintenance Workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/A request is waiting for review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Needs attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Broken heater/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lifecycle summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Assignment \/ handling/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No handler has been assigned to this request yet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Scheduling \/ access/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting schedule/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmation \/ access/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not ready for service/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Review the request details/i)).toBeInTheDocument();
    expect(screen.getByText(/Mark reviewed/i)).toBeInTheDocument();
  });

  it("opens the related request from the scheduled maintenance calendar", async () => {
    maintenanceWorkflowApi.listLandlordMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          tenantName: "Taylor Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          title: "Broken heater",
          description: "Heat is not turning on.",
          category: "HVAC",
          priority: "urgent",
          status: "submitted",
          assignedContractorName: null,
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
        {
          id: "maint-2",
          tenantId: "tenant-2",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-8",
          tenantName: "Jordan Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 8",
          title: "Leaky pipe",
          description: "Pipe is dripping behind the vanity.",
          category: "PLUMBING",
          priority: "normal",
          status: "scheduled",
          assignedContractorName: "North Shore Plumbing",
          serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
          serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
          accessRequired: false,
          tenantConfirmationStatus: "confirmed",
          tenantConfirmationUpdatedAt: Date.UTC(2026, 3, 14, 10, 0),
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/maintenance/maint-1"]}>
        <Routes>
          <Route path="/maintenance/:id" element={<MaintenanceRequestsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Scheduled maintenance calendar/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Leaky pipe/i })[0]);

    expect(await screen.findAllByText(/Leaky pipe/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/Ready for service/i).length).toBeGreaterThan(0);
  });
});
